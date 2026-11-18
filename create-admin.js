import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from '../src/config/db.js';

const [email,nombres,apellidos]=process.argv.slice(2);
const password=process.env.ADMIN_INITIAL_PASSWORD;
if(!email||!nombres||!apellidos||!password||password.length<12){console.error('Uso: configure ADMIN_INITIAL_PASSWORD de forma segura y ejecute npm run admin:create -- correo nombres apellidos');process.exit(1);}
try{
 const connection=await pool.getConnection();
 try{await connection.beginTransaction();
  const hash=await bcrypt.hash(password,12);
  const [user]=await connection.execute('INSERT INTO usuarios(nombres,apellidos,email,password_hash) VALUES (?,?,?,?)',[nombres,apellidos,email,hash]);
  const [[role]]=await connection.execute("SELECT id_rol FROM roles WHERE nombre='Administrador'");
  if(!role) throw new Error('Ejecute npm run db:roles primero');
  await connection.execute('INSERT INTO usuario_rol(id_usuario,id_rol) VALUES (?,?)',[user.insertId,role.id_rol]);
  await connection.commit();console.log(`Administrador creado (id ${user.insertId})`);
 }catch(error){await connection.rollback();throw error;}finally{connection.release();}
}finally{await pool.end();}
