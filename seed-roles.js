import 'dotenv/config';
import { pool } from '../src/config/db.js';

const roles=[['Administrador','Administración global del sistema'],['Médico','Atención clínica autorizada'],['Personal administrativo','Gestión administrativa de pacientes'],['Paciente','Portal del paciente']];
try{for(const [name,description] of roles) await pool.execute('INSERT INTO roles(nombre,descripcion) VALUES (?,?) ON DUPLICATE KEY UPDATE descripcion=VALUES(descripcion)',[name,description]);console.log('Roles inicializados de forma idempotente');}finally{await pool.end();}
