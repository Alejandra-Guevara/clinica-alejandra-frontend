import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { allowRoles, authenticate } from '../middlewares/auth.js';
import { asyncRoute, httpError, ok } from '../utils/http.js';

const router=Router();
export const recipeInputSchema=z.object({id_consulta:z.coerce.number().int().positive(),indicaciones_generales:z.string().max(5000).optional().or(z.literal('')),detalles:z.array(z.object({id_medicamento:z.coerce.number().int().positive(),dosis:z.string().trim().min(1).max(100),via_administracion:z.string().max(80).optional().or(z.literal('')),frecuencia:z.string().max(100).optional().or(z.literal('')),duracion:z.string().max(100).optional().or(z.literal('')),cantidad:z.string().max(80).optional().or(z.literal('')),indicaciones:z.string().max(5000).optional().or(z.literal(''))}).strict()).min(1).max(50)}).strict();
export const examOrderInputSchema=z.object({id_consulta:z.coerce.number().int().positive(),observaciones:z.string().max(5000).optional().or(z.literal('')),examenes:z.array(z.object({id_examen:z.coerce.number().int().positive()}).strict()).min(1).max(50)}).strict();
const consultationAccess=async(connection,id,user)=>{
  const [rows]=await connection.execute('SELECT c.id_consulta,c.id_medico,c.estado,h.estado AS historia_estado FROM consultas c JOIN historias_clinicas h ON h.id_historia=c.id_historia WHERE c.id_consulta=? FOR UPDATE',[id]);
  if(!rows.length) throw httpError(404,'Consulta no encontrada');
  if(rows[0].estado!=='borrador') throw httpError(409,'Solo se pueden crear prescripciones y órdenes en consultas en borrador');
  if(rows[0].historia_estado!=='activa') throw httpError(409,'No se pueden agregar órdenes a una historia archivada');
  if(user.roles.includes('Médico')&&!user.roles.includes('Administrador')) {
    const [doctors]=await connection.execute('SELECT id_medico FROM medicos WHERE id_usuario=? AND activo=1',[user.id_usuario]);
    if(!doctors.length||String(doctors[0].id_medico)!==String(rows[0].id_medico)) throw httpError(403,'No tienes acceso a esta consulta');
  }
};
const audit=async(connection,userId,action,entity,id,ip,details)=>connection.execute('INSERT INTO auditoria_accesos (id_usuario,accion,entidad,id_registro,ip_origen,detalles) VALUES (?,?,?,?,?,?)',[userId,action,entity,id,ip,details?JSON.stringify(details):null]);

router.post('/recetas',authenticate,allowRoles('Administrador','Médico'),asyncRoute(async(req,res)=>{
  const body=recipeInputSchema.parse(req.body);
  const connection=await pool.getConnection();
  try { await connection.beginTransaction();await consultationAccess(connection,body.id_consulta,req.user);
    const [header]=await connection.execute('INSERT INTO recetas(id_consulta,indicaciones_generales) VALUES (?,?)',[body.id_consulta,body.indicaciones_generales||null]);
    for(const item of body.detalles) await connection.execute('INSERT INTO receta_detalle(id_receta,id_medicamento,dosis,via_administracion,frecuencia,duracion,cantidad,indicaciones) VALUES (?,?,?,?,?,?,?,?)',[header.insertId,item.id_medicamento,item.dosis,item.via_administracion||null,item.frecuencia||null,item.duracion||null,item.cantidad||null,item.indicaciones||null]);
    await audit(connection,req.user.id_usuario,'creacion','recetas',header.insertId,req.ip,{lineas:body.detalles.length});await connection.commit();res.status(201);ok(res,{id:header.insertId,detalles:body.detalles.length});
  } catch(error) { await connection.rollback();throw error; } finally { connection.release(); }
}));

router.post('/ordenes-examen',authenticate,allowRoles('Administrador','Médico'),asyncRoute(async(req,res)=>{
  const body=examOrderInputSchema.parse(req.body);
  const connection=await pool.getConnection();
  try { await connection.beginTransaction();await consultationAccess(connection,body.id_consulta,req.user);
    const [header]=await connection.execute('INSERT INTO ordenes_examen(id_consulta,observaciones) VALUES (?,?)',[body.id_consulta,body.observaciones||null]);
    for(const item of body.examenes) await connection.execute("INSERT INTO orden_examen_detalle(id_orden,id_examen,estado) VALUES (?,?,'solicitado')",[header.insertId,item.id_examen]);
    await audit(connection,req.user.id_usuario,'creacion','ordenes_examen',header.insertId,req.ip,{lineas:body.examenes.length});await connection.commit();res.status(201);ok(res,{id:header.insertId,detalles:body.examenes.length});
  } catch(error) { await connection.rollback();throw error; } finally { connection.release(); }
}));

export default router;
