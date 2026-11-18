import { pool } from '../config/db.js';

export async function writeAudit({ userId, action, entity, recordId, ip, details }) {
  await pool.execute('INSERT INTO auditoria_accesos (id_usuario,accion,entidad,id_registro,ip_origen,detalles) VALUES (?,?,?,?,?,?)', [userId, action, entity, recordId, ip, details ? JSON.stringify(details) : null]);
}
