import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { asyncRoute, httpError, ok } from '../utils/http.js';
import { clearCsrfCookie, clearSessionCookie, issueSession, setCsrfCookie, setSessionCookie } from '../utils/session.js';
import { authenticate, requireCsrf } from '../middlewares/auth.js';
import { writeAudit } from '../services/audit.js';

const router = Router();
const loginSchema = z.object({ email: z.email(), password: z.string().min(1).max(200) });
router.get('/csrf', (_req, res) => { const token = crypto.randomBytes(32).toString('base64url'); setCsrfCookie(res, token); ok(res, { token }); });
router.post('/login', requireCsrf, asyncRoute(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const [rows] = await pool.execute('SELECT id_usuario,nombres,apellidos,email,password_hash,estado,session_version FROM usuarios WHERE email=? LIMIT 1', [input.email]);
  const user = rows[0];
  if (!user || user.estado !== 'activo' || !(await bcrypt.compare(input.password, user.password_hash))) throw httpError(401, 'Correo o contraseña incorrectos', 'LOGIN_FAILED');
  const [roles] = await pool.execute('SELECT r.nombre FROM roles r JOIN usuario_rol ur ON ur.id_rol=r.id_rol WHERE ur.id_usuario=?', [user.id_usuario]);
  setSessionCookie(res, issueSession(user.id_usuario,user.session_version));
  const csrf = crypto.randomBytes(32).toString('base64url'); setCsrfCookie(res, csrf);
  ok(res, { user: { id_usuario: user.id_usuario, nombres: user.nombres, apellidos: user.apellidos, email: user.email, roles: roles.map((r) => r.nombre) }, csrfToken: csrf });
}));
router.post('/logout', requireCsrf, (_req, res) => { clearSessionCookie(res); clearCsrfCookie(res); res.status(204).end(); });
router.get('/me', authenticate, (req, res) => ok(res, { user: req.user }));
router.patch('/password', authenticate, requireCsrf, asyncRoute(async (req, res) => {
  const input = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12).max(200) }).parse(req.body);
  const [rows] = await pool.execute('SELECT password_hash FROM usuarios WHERE id_usuario=?', [req.user.id_usuario]);
  if (!(await bcrypt.compare(input.currentPassword, rows[0].password_hash))) throw httpError(400, 'La contraseña actual no coincide');
  const hash = await bcrypt.hash(input.newPassword, 12);
  await pool.execute('UPDATE usuarios SET password_hash=?,session_version=session_version+1 WHERE id_usuario=?', [hash, req.user.id_usuario]);
  try { await writeAudit({userId:req.user.id_usuario,action:'modificacion',entity:'usuarios',recordId:req.user.id_usuario,ip:req.ip,details:{passwordChanged:true}}); }
  finally { clearSessionCookie(res); clearCsrfCookie(res); }
  res.status(204).end();
}));
export default router;
