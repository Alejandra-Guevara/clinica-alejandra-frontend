import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate } from '../middlewares/auth.js';
import { asyncRoute, ok } from '../utils/http.js';
import { writeAudit } from '../services/audit.js';

const router=Router();
router.get('/',authenticate,asyncRoute(async(req,res)=>{
 const clinicWide=req.user.roles.some((role)=>['Administrador','Personal administrativo'].includes(role));
 const [[patients]]=clinicWide?await pool.query('SELECT COUNT(*) total FROM pacientes'):await pool.execute("SELECT COUNT(DISTINCT h.id_paciente) total FROM historias_clinicas h JOIN historia_medico hm ON hm.id_historia=h.id_historia JOIN medicos m ON m.id_medico=hm.id_medico WHERE hm.estado='activa' AND m.id_usuario=? AND m.activo=1",[req.user.id_usuario]);
 const [[doctors]]=await pool.query('SELECT COUNT(*) total FROM medicos WHERE activo=1');
 const consultationJoin=' FROM consultas c JOIN historias_clinicas h ON h.id_historia=c.id_historia JOIN medicos m ON m.id_medico=c.id_medico';
 const consultationFilter=clinicWide?'':' WHERE m.id_usuario=? AND m.activo=1';
 const params=clinicWide?[]:[req.user.id_usuario];
 const [[consultations]]=await pool.execute(`SELECT COUNT(*) total${consultationJoin}${consultationFilter}`,params);
 const [[today]]=await pool.execute(`SELECT COUNT(*) total${consultationJoin}${consultationFilter}${clinicWide?' WHERE':' AND'} DATE(c.fecha_hora)=CURRENT_DATE`,params);
 const [states]=await pool.execute(`SELECT c.estado,COUNT(*) total${consultationJoin}${consultationFilter} GROUP BY c.estado`,params);
 const [period]=await pool.execute(`SELECT DATE_FORMAT(c.fecha_hora,'%Y-%m') periodo,COUNT(*) total${consultationJoin}${consultationFilter}${clinicWide?' WHERE':' AND'} c.fecha_hora >= DATE_SUB(CURRENT_DATE, INTERVAL 5 MONTH) GROUP BY periodo ORDER BY periodo`,params);
 const [recent]=await pool.execute(`SELECT c.id_consulta,c.fecha_hora,c.estado,c.tipo_consulta,p.nombres,p.apellidos,m.id_medico${consultationJoin} JOIN pacientes p ON p.id_paciente=h.id_paciente${consultationFilter} ORDER BY c.fecha_hora DESC LIMIT 8`,params);
 for(const row of recent) await writeAudit({userId:req.user.id_usuario,action:'consulta',entity:'consultas',recordId:row.id_consulta,ip:req.ip});
 ok(res,{totalPacientes:Number(patients.total),medicosActivos:Number(doctors.total),totalConsultas:Number(consultations.total),consultasHoy:Number(today.total),consultasPorEstado:states.map(x=>({estado:x.estado,total:Number(x.total)})),consultasPorPeriodo:period.map(x=>({periodo:x.periodo,total:Number(x.total)})),consultasRecientes:recent});
}));
export default router;
