import { Router } from 'express';
import { pool } from '../config/db.js';
import { allowRoles, authenticate } from '../middlewares/auth.js';
import { asyncRoute, httpError, ok } from '../utils/http.js';
import { writeAudit } from '../services/audit.js';

const router=Router();

async function patientAccess(connection,id,user){
  const [patients]=await connection.execute('SELECT * FROM pacientes WHERE id_paciente=?',[id]);
  if(!patients.length) throw httpError(404,'Paciente no encontrado');
  const patient=patients[0],patientOnly=user.roles.includes('Paciente')&&!user.roles.some((role)=>['Administrador','Personal administrativo','Médico'].includes(role));
  if(patientOnly&&String(patient.id_usuario)!==String(user.id_usuario)) throw httpError(403,'Solo puedes consultar tu propia historia clínica');
  const [histories]=await connection.execute('SELECT * FROM historias_clinicas WHERE id_paciente=?',[id]);
  const history=histories[0]||null,doctorOnly=user.roles.includes('Médico')&&!user.roles.includes('Administrador')&&!user.roles.includes('Personal administrativo');
  if(doctorOnly){
    if(!history) throw httpError(403,'No tienes acceso a la historia de este paciente');
    const [access]=await connection.execute("SELECT 1 FROM historia_medico hm JOIN medicos m ON m.id_medico=hm.id_medico WHERE hm.id_historia=? AND hm.estado='activa' AND m.id_usuario=? AND m.activo=1 LIMIT 1",[history.id_historia,user.id_usuario]);
    if(!access.length) throw httpError(403,'No tienes acceso a la historia de este paciente');
  }
  return {patient,history,patientOnly};
}


router.get('/portal/me',authenticate,allowRoles('Paciente'),asyncRoute(async(req,res)=>{
  const [patients]=await pool.execute('SELECT id_paciente,tipo_documento,numero_documento,nombres,apellidos,fecha_nacimiento,sexo_registrado,telefono,email,grupo_sanguineo FROM pacientes WHERE id_usuario=? LIMIT 1',[req.user.id_usuario]);
  if(!patients.length)throw httpError(404,'La cuenta no está vinculada a un paciente');
  ok(res,{patient:patients[0]});
}));

router.get('/:id/record',authenticate,allowRoles('Administrador','Personal administrativo','Médico','Paciente'),asyncRoute(async(req,res)=>{
  if(!/^\d{1,20}$/.test(req.params.id)) throw httpError(400,'Identificador de paciente inválido','VALIDATION_ERROR');
  const connection=await pool.getConnection();
  try {
    const {patient,history,patientOnly}=await patientAccess(connection,req.params.id,req.user);
    let consultations=[],diagnoses=[],vitals=[],prescriptions=[],prescriptionItems=[],orders=[],orderItems=[];
    if(history) {
      const consultationParams=[history.id_historia];
      const finalizedOnly=patientOnly?" AND c.estado='finalizada'":'';
      [consultations]=await connection.execute(`SELECT c.*,u.nombres AS medico_nombres,u.apellidos AS medico_apellidos FROM consultas c JOIN medicos m ON m.id_medico=c.id_medico JOIN usuarios u ON u.id_usuario=m.id_usuario WHERE c.id_historia=?${finalizedOnly} ORDER BY c.fecha_hora DESC`,consultationParams);
      [diagnoses]=await connection.execute(`SELECT d.id_consulta,d.id_diagnostico,x.codigo_cie10,x.nombre,d.tipo,d.observaciones FROM consulta_diagnostico d JOIN diagnosticos x ON x.id_diagnostico=d.id_diagnostico JOIN consultas c ON c.id_consulta=d.id_consulta WHERE c.id_historia=?${finalizedOnly} ORDER BY c.fecha_hora DESC`,consultationParams);
      [vitals]=await connection.execute(`SELECT v.*,c.fecha_hora FROM signos_vitales v JOIN consultas c ON c.id_consulta=v.id_consulta WHERE c.id_historia=?${finalizedOnly} ORDER BY v.medido_en DESC`,consultationParams);
      [prescriptions]=await connection.execute(`SELECT r.*,c.fecha_hora FROM recetas r JOIN consultas c ON c.id_consulta=r.id_consulta WHERE c.id_historia=?${finalizedOnly} ORDER BY r.fecha_emision DESC`,consultationParams);
      [prescriptionItems]=await connection.execute(`SELECT rd.*,m.nombre AS medicamento_nombre,m.concentracion,m.forma_farmaceutica,r.id_consulta FROM receta_detalle rd JOIN medicamentos m ON m.id_medicamento=rd.id_medicamento JOIN recetas r ON r.id_receta=rd.id_receta JOIN consultas c ON c.id_consulta=r.id_consulta WHERE c.id_historia=?${finalizedOnly} ORDER BY r.fecha_emision DESC,rd.id_receta_detalle`,consultationParams);
      [orders]=await connection.execute(`SELECT o.*,c.fecha_hora FROM ordenes_examen o JOIN consultas c ON c.id_consulta=o.id_consulta WHERE c.id_historia=?${finalizedOnly} ORDER BY o.fecha_emision DESC`,consultationParams);
      [orderItems]=await connection.execute(`SELECT od.*,e.nombre AS examen_nombre,o.id_consulta FROM orden_examen_detalle od JOIN examenes e ON e.id_examen=od.id_examen JOIN ordenes_examen o ON o.id_orden=od.id_orden JOIN consultas c ON c.id_consulta=o.id_consulta WHERE c.id_historia=?${finalizedOnly} ORDER BY o.fecha_emision DESC,od.id_orden_detalle`,consultationParams);
    }
    const [allergies]=await connection.execute('SELECT pa.*,a.nombre,a.tipo FROM paciente_alergia pa JOIN alergias a ON a.id_alergia=pa.id_alergia WHERE pa.id_paciente=? ORDER BY a.nombre',[req.params.id]);
    const [background]=await connection.execute('SELECT pa.*,a.nombre FROM paciente_antecedente pa JOIN antecedentes a ON a.id_antecedente=pa.id_antecedente WHERE pa.id_paciente=? ORDER BY pa.tipo,a.nombre',[req.params.id]);
    let audit=[];
    if(req.user.roles.includes('Administrador')) {
      const historyId=history?.id_historia||0;
      [audit]=await connection.execute(`SELECT a.id_auditoria,a.id_usuario,u.nombres,u.apellidos,a.accion,a.entidad,a.id_registro,a.fecha_hora,a.ip_origen
        FROM auditoria_accesos a JOIN usuarios u ON u.id_usuario=a.id_usuario
        WHERE (a.entidad='pacientes' AND a.id_registro=?)
          OR (a.entidad='historias-clinicas' AND a.id_registro=?)
          OR (a.entidad='consultas' AND a.id_registro IN (SELECT id_consulta FROM consultas WHERE id_historia=?))
          OR (a.entidad='consulta-diagnosticos' AND a.id_registro IN (SELECT id_consulta FROM consultas WHERE id_historia=?))
          OR (a.entidad='signos-vitales' AND a.id_registro IN (SELECT v.id_signos FROM signos_vitales v JOIN consultas c ON c.id_consulta=v.id_consulta WHERE c.id_historia=?))
          OR (a.entidad='recetas' AND a.id_registro IN (SELECT r.id_receta FROM recetas r JOIN consultas c ON c.id_consulta=r.id_consulta WHERE c.id_historia=?))
          OR (a.entidad='ordenes-examen' AND a.id_registro IN (SELECT o.id_orden FROM ordenes_examen o JOIN consultas c ON c.id_consulta=o.id_consulta WHERE c.id_historia=?))
          OR (a.entidad='orden-examen-detalles' AND a.id_registro IN (SELECT d.id_orden_detalle FROM orden_examen_detalle d JOIN ordenes_examen o ON o.id_orden=d.id_orden JOIN consultas c ON c.id_consulta=o.id_consulta WHERE c.id_historia=?))
          OR (a.entidad='paciente-alergias' AND a.id_registro IN (SELECT id_paciente_alergia FROM paciente_alergia WHERE id_paciente=?))
          OR (a.entidad='paciente-antecedentes' AND a.id_registro IN (SELECT id_paciente_antecedente FROM paciente_antecedente WHERE id_paciente=?))
          OR (a.entidad='asignaciones-historia' AND a.id_registro IN (SELECT id_asignacion FROM historia_medico WHERE id_historia=?))
          OR (a.entidad='consultas_adendas' AND a.id_registro IN (SELECT a2.id_adenda FROM consultas_adendas a2 JOIN consultas c ON c.id_consulta=a2.id_consulta WHERE c.id_historia=?))
        ORDER BY a.fecha_hora DESC LIMIT 100`,[req.params.id,historyId,historyId,historyId,historyId,historyId,historyId,historyId,req.params.id,req.params.id,historyId,historyId]);
    }
    await writeAudit({userId:req.user.id_usuario,action:'consulta',entity:'pacientes',recordId:req.params.id,ip:req.ip,details:{view:'ficha_clinica'}});
    ok(res,{patient,history,consultations,diagnoses,vitals,prescriptions,prescriptionItems,orders,orderItems,allergies,background,audit});
  } finally { connection.release(); }
}));


router.post('/:id/record/export',authenticate,allowRoles('Administrador','Personal administrativo','Médico','Paciente'),asyncRoute(async(req,res)=>{
  if(!/^\d{1,20}$/.test(req.params.id)) throw httpError(400,'Identificador de paciente inválido','VALIDATION_ERROR');
  const connection=await pool.getConnection();
  try{
    await patientAccess(connection,req.params.id,req.user);
    await writeAudit({userId:req.user.id_usuario,action:'exportacion',entity:'pacientes',recordId:req.params.id,ip:req.ip,details:{format:'impresion_ficha'}});
    ok(res,{registered:true});
  }finally{connection.release();}
}));

export default router;
