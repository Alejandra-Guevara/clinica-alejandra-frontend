import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { allowRoles, authenticate } from '../middlewares/auth.js';
import { asyncRoute, httpError, ok } from '../utils/http.js';
import { writeAudit } from '../services/audit.js';

// La lista blanca refleja únicamente tablas/campos presentes en el SQL entregado.
export const resources = {
  pacientes: { table:'pacientes', pk:'id_paciente', fields:['id_usuario','tipo_documento','numero_documento','nombres','apellidos','fecha_nacimiento','sexo_registrado','telefono','email','direccion','grupo_sanguineo'], search:['numero_documento','nombres','apellidos','email'], roles:['Administrador','Personal administrativo','Médico'] },
  medicos: { table:'medicos', pk:'id_medico', fields:['id_usuario','numero_registro_profesional','activo'], sortFields:['nombres','apellidos','email'], writeRoles:['Administrador'], search:['numero_registro_profesional','nombres','apellidos','email'], roles:['Administrador','Personal administrativo','Médico'], select:'SELECT m.*,u.nombres,u.apellidos,u.email FROM medicos m JOIN usuarios u ON u.id_usuario=m.id_usuario' },
  especialidades: { table:'especialidades', pk:'id_especialidad', fields:['nombre','descripcion'], search:['nombre','descripcion'], roles:['Administrador','Personal administrativo','Médico'] },
  'medico-especialidades': { table:'medico_especialidad', pk:'id_medico', sortKey:'id_especialidad', fields:['id_medico','id_especialidad'], search:[], roles:['Administrador','Personal administrativo'], composite:true },
  'historias-clinicas': { table:'historias_clinicas', pk:'id_historia', fields:['id_paciente','numero_historia','estado'], sortFields:['fecha_apertura'], editFields:['estado'], enums:{estado:['activa','archivada']}, search:['numero_historia'], roles:['Administrador','Personal administrativo','Médico'] },
  'asignaciones-historia': { table:'historia_medico', pk:'id_asignacion', fields:['id_historia','id_medico'], editFields:['estado'], enums:{estado:['activa','inactiva']}, search:['numero_historia','paciente_nombres','paciente_apellidos','medico_nombres','medico_apellidos'], writeRoles:['Administrador','Personal administrativo'], roles:['Administrador','Personal administrativo'], select:'SELECT hm.*,h.numero_historia,p.nombres AS paciente_nombres,p.apellidos AS paciente_apellidos,u.nombres AS medico_nombres,u.apellidos AS medico_apellidos FROM historia_medico hm JOIN historias_clinicas h ON h.id_historia=hm.id_historia JOIN pacientes p ON p.id_paciente=h.id_paciente JOIN medicos m ON m.id_medico=hm.id_medico JOIN usuarios u ON u.id_usuario=m.id_usuario' },
  alergias: { table:'alergias', pk:'id_alergia', fields:['nombre','tipo','descripcion'], enums:{tipo:['medicamento','alimento','ambiental','otra']}, search:['nombre','descripcion'], roles:['Administrador','Personal administrativo','Médico'] },
  'paciente-alergias': { table:'paciente_alergia', pk:'id_paciente_alergia', fields:['id_paciente','id_alergia','reaccion','severidad'], enums:{severidad:['leve','moderada','grave','desconocida']}, search:['reaccion'], roles:['Administrador','Personal administrativo','Médico'] },
  antecedentes: { table:'antecedentes', pk:'id_antecedente', fields:['nombre','descripcion'], search:['nombre','descripcion'], roles:['Administrador','Personal administrativo','Médico'] },
  'paciente-antecedentes': { table:'paciente_antecedente', pk:'id_paciente_antecedente', fields:['id_paciente','id_antecedente','tipo','parentesco','detalle','fecha_referencia'], enums:{tipo:['personal','familiar','quirurgico','farmacologico','habito','otro']}, search:['detalle','parentesco'], roles:['Administrador','Personal administrativo','Médico'] },
  consultas: { table:'consultas', pk:'id_consulta', fields:['id_historia','id_medico','fecha_hora','tipo_consulta','motivo_consulta','enfermedad_actual','anamnesis','revision_sistemas','examen_fisico','analisis_clinico','plan_manejo','observaciones'], sortFields:['estado'], filterEnums:{estado:['borrador','finalizada','anulada']}, enums:{tipo_consulta:['primera_vez','control','urgencia','otra']}, search:['motivo_consulta','observaciones'], roles:['Administrador','Médico'], custom:true },
  diagnosticos: { table:'diagnosticos', pk:'id_diagnostico', fields:['codigo_cie10','nombre','descripcion'], search:['codigo_cie10','nombre'], roles:['Administrador','Médico'] },
  'consulta-diagnosticos': { table:'consulta_diagnostico', pk:'id_consulta', fields:['id_consulta','id_diagnostico','tipo','observaciones'], enums:{tipo:['principal','secundario','presuntivo']}, search:['observaciones'], roles:['Administrador','Médico'], composite:true },
  'signos-vitales': { table:'signos_vitales', pk:'id_signos', fields:['id_consulta','medido_en','presion_sistolica','presion_diastolica','frecuencia_cardiaca','frecuencia_respiratoria','temperatura_c','peso_kg','talla_cm','saturacion_oxigeno_pct'], search:[], roles:['Administrador','Médico'] },
  medicamentos: { table:'medicamentos', pk:'id_medicamento', fields:['nombre','concentracion','forma_farmaceutica','codigo_catalogo'], search:['nombre','concentracion','codigo_catalogo'], roles:['Administrador','Médico'] },
  recetas: { table:'recetas', pk:'id_receta', fields:['id_consulta','indicaciones_generales'], search:[], roles:['Administrador','Médico'], createOnly:true },
  'receta-detalles': { table:'receta_detalle', pk:'id_receta_detalle', fields:['id_receta','id_medicamento','dosis','via_administracion','frecuencia','duracion','cantidad','indicaciones'], search:['dosis','indicaciones'], roles:['Administrador','Médico'], createOnly:true, noCreate:true },
  examenes: { table:'examenes', pk:'id_examen', fields:['nombre','descripcion','codigo_catalogo'], search:['nombre','codigo_catalogo'], roles:['Administrador','Médico'] },
  'ordenes-examen': { table:'ordenes_examen', pk:'id_orden', fields:['id_consulta','observaciones'], sortFields:['fecha_emision'], search:['observaciones'], roles:['Administrador','Médico'], createOnly:true },
  'orden-examen-detalles': { table:'orden_examen_detalle', pk:'id_orden_detalle', fields:['id_orden','id_examen','estado','resultado_resumen','fecha_resultado'], enums:{estado:['solicitado','en_proceso','informado','cancelado']}, search:['resultado_resumen'], roles:['Administrador','Médico'], noCreate:true },
};

function parseResourceInput(config, input, updating = false) {
  const fields=updating?(config.editFields||config.fields):config.fields;
  const body=z.object(Object.fromEntries(fields.map((field)=>[field,z.unknown().optional()]))).strict().parse(input);
  for(const [field,allowed] of Object.entries(config.enums||{})) if(body[field]!==undefined && !allowed.includes(body[field])) throw httpError(400,`Valor inválido para ${field}`,'VALIDATION_ERROR');
  if(config.table==='signos_vitales') {
    for(const field of ['presion_sistolica','presion_diastolica','frecuencia_cardiaca','frecuencia_respiratoria']) if(body[field]!==undefined&&body[field]!==null&&(!Number.isInteger(Number(body[field]))||Number(body[field])<0||Number(body[field])>65535)) throw httpError(400,`Valor inválido para ${field}`,'VALIDATION_ERROR');
    const decimals={temperatura_c:{scale:1,max:999.9},peso_kg:{scale:2,max:9999.99},talla_cm:{scale:2,max:999.99},saturacion_oxigeno_pct:{scale:2,max:100}};
    for(const [field,{scale,max}] of Object.entries(decimals)) if(body[field]!==undefined&&body[field]!==null){
      const value=Number(body[field]),fraction=String(body[field]).split('.')[1]||'';
      if(!Number.isFinite(value)||value<0||value>max||fraction.length>scale) throw httpError(400,`Valor inválido para ${field}`,'VALIDATION_ERROR');
    }
  }
  return body;
}

function routerFor(name, config) {
  const router = Router();
  router.use(authenticate, allowRoles(...config.roles));
  const doctorScopes = {
    pacientes: 'EXISTS (SELECT 1 FROM historias_clinicas h JOIN historia_medico hm ON hm.id_historia=h.id_historia JOIN medicos m ON m.id_medico=hm.id_medico WHERE h.id_paciente=r.id_paciente AND hm.estado=\'activa\' AND m.id_usuario=? AND m.activo=1)',
    'historias-clinicas': 'EXISTS (SELECT 1 FROM historia_medico hm JOIN medicos m ON m.id_medico=hm.id_medico WHERE hm.id_historia=r.id_historia AND hm.estado=\'activa\' AND m.id_usuario=? AND m.activo=1)',
    consultas: 'EXISTS (SELECT 1 FROM medicos m WHERE m.id_medico=r.id_medico AND m.id_usuario=? AND m.activo=1)',
    'paciente-alergias': 'EXISTS (SELECT 1 FROM historias_clinicas h JOIN historia_medico hm ON hm.id_historia=h.id_historia JOIN medicos m ON m.id_medico=hm.id_medico WHERE h.id_paciente=r.id_paciente AND hm.estado=\'activa\' AND m.id_usuario=? AND m.activo=1)',
    'paciente-antecedentes': 'EXISTS (SELECT 1 FROM historias_clinicas h JOIN historia_medico hm ON hm.id_historia=h.id_historia JOIN medicos m ON m.id_medico=hm.id_medico WHERE h.id_paciente=r.id_paciente AND hm.estado=\'activa\' AND m.id_usuario=? AND m.activo=1)',
    'consulta-diagnosticos': 'EXISTS (SELECT 1 FROM consultas c JOIN medicos m ON m.id_medico=c.id_medico WHERE c.id_consulta=r.id_consulta AND m.id_usuario=? AND m.activo=1)',
    'signos-vitales': 'EXISTS (SELECT 1 FROM consultas c JOIN medicos m ON m.id_medico=c.id_medico WHERE c.id_consulta=r.id_consulta AND m.id_usuario=? AND m.activo=1)',
    recetas: 'EXISTS (SELECT 1 FROM consultas c JOIN medicos m ON m.id_medico=c.id_medico WHERE c.id_consulta=r.id_consulta AND m.id_usuario=? AND m.activo=1)',
    'receta-detalles': 'EXISTS (SELECT 1 FROM recetas x JOIN consultas c ON c.id_consulta=x.id_consulta JOIN medicos m ON m.id_medico=c.id_medico WHERE x.id_receta=r.id_receta AND m.id_usuario=? AND m.activo=1)',
    'ordenes-examen': 'EXISTS (SELECT 1 FROM consultas c JOIN medicos m ON m.id_medico=c.id_medico WHERE c.id_consulta=r.id_consulta AND m.id_usuario=? AND m.activo=1)',
    'orden-examen-detalles': 'EXISTS (SELECT 1 FROM ordenes_examen x JOIN consultas c ON c.id_consulta=x.id_consulta JOIN medicos m ON m.id_medico=c.id_medico WHERE x.id_orden=r.id_orden AND m.id_usuario=? AND m.activo=1)',
  };
  router.get('/', asyncRoute(async (req,res) => {
    const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || '').trim().slice(0,120);
    const where = [], params = [];
    if (!req.user.roles.includes('Administrador') && !req.user.roles.includes('Personal administrativo') && doctorScopes[name]) { where.push(doctorScopes[name]); params.push(req.user.id_usuario); }
    if (search && config.search.length) { where.push(`(${config.search.map((field) => `\`${field}\` LIKE ?`).join(' OR ')})`); for (const _field of config.search) params.push(`%${search}%`); }
    const filterable=new Set([...config.fields,...Object.keys(config.enums||{}),...Object.keys(config.filterEnums||{})]);
    for (const field of filterable) if (req.query[field] !== undefined && String(req.query[field]).length) {
      const value=String(req.query[field]), allowed=config.enums?.[field]||config.filterEnums?.[field];
      if (allowed&&!allowed.includes(value)) throw httpError(400,`Valor de filtro inválido para ${field}`,'VALIDATION_ERROR');
      if (allowed||/^\d{1,20}$/.test(value)) { where.push(`\`${field}\`=?`); params.push(value); }
    }
    const from = config.select ? `(${config.select}) AS r` : `\`${config.table}\` r`;
    const pk = config.sortKey || (config.composite ? 'id_consulta' : config.pk);
    const sortable = new Set([...config.fields,...config.search,...(config.sortFields||[]),config.pk,config.sortKey].filter(Boolean));
    const requestedSort=String(req.query.sort||'');
    const sort=sortable.has(requestedSort)?requestedSort:pk;
    const direction=String(req.query.direction||'').toLowerCase()==='asc'?'ASC':'DESC';
    const [countRows] = await pool.execute(`SELECT COUNT(*) total FROM ${from}${where.length?` WHERE ${where.join(' AND ')}`:''}`, params);
    const [rows] = await pool.execute(`SELECT r.* FROM ${from}${where.length?` WHERE ${where.join(' AND ')}`:''} ORDER BY r.\`${sort}\` ${direction}, r.\`${pk}\` DESC LIMIT ? OFFSET ?`, [...params,limit,(page-1)*limit]);
    if (req.query.audit === 'true') for (const row of rows) await writeAudit({userId:req.user.id_usuario,action:'consulta',entity:name,recordId:row[pk],ip:req.ip});
    ok(res, rows, {page,limit,total:Number(countRows[0].total)});
  }));
  router.get('/:id', asyncRoute(async (req,res) => {
    const scope = !req.user.roles.includes('Administrador') && !req.user.roles.includes('Personal administrativo') ? doctorScopes[name] : null;
    const params = [req.params.id]; if (scope) params.push(req.user.id_usuario);
    const [rows] = await pool.execute(`SELECT * FROM \`${config.table}\` r WHERE r.\`${config.pk}\`=?${scope?` AND (${scope})`:''} LIMIT 1`, params);
    if (!rows.length) throw httpError(404,'Registro no encontrado');
    await writeAudit({userId:req.user.id_usuario,action:'consulta',entity:name,recordId:req.params.id,ip:req.ip});
    ok(res,rows[0]);
  }));
  router.post('/', asyncRoute(async (req,res) => {
    if (config.readonly || config.noCreate) throw httpError(405,'Este recurso no permite alta directa');
    if (config.writeRoles && !req.user.roles.some((role)=>config.writeRoles.includes(role))) throw httpError(403,'No tienes permiso para crear este recurso');
    const body = parseResourceInput(config,req.body);
    const fields = config.fields.filter((field) => body[field] !== undefined);
    if (!fields.length) throw httpError(400,'No se recibieron campos válidos');
    if(name==='asignaciones-historia') {
      for(const field of ['id_historia','id_medico']) if(!/^\d{1,20}$/.test(String(body[field]??''))||/^0+$/.test(String(body[field]))) throw httpError(400,`Identificador inválido: ${field}`,'VALIDATION_ERROR');
      fields.push('asignado_por');
    }
    if (name==='historias-clinicas' && body.estado && body.estado!=='activa') throw httpError(400,'Una historia clínica debe abrirse activa');
    if (name==='asignaciones-historia') {
      const [histories]=await pool.execute('SELECT estado FROM historias_clinicas WHERE id_historia=?',[body.id_historia]);
      const [doctors]=await pool.execute('SELECT activo FROM medicos WHERE id_medico=?',[body.id_medico]);
      if(!histories.length) throw httpError(404,'Historia clínica no encontrada');
      if(histories[0].estado!=='activa') throw httpError(409,'No se asignan médicos a historias archivadas');
      if(!doctors.length||!doctors[0].activo) throw httpError(409,'Solo se asignan médicos activos');
    }
    if (['consultas','signos-vitales','recetas','ordenes-examen'].includes(name)) {
      const consultationId = name==='consultas' ? null : name==='signos-vitales' ? body.id_consulta : name==='recetas'||name==='ordenes-examen' ? body.id_consulta : null;
      if (consultationId) { const [consultations]=await pool.execute('SELECT estado FROM consultas WHERE id_consulta=?',[consultationId]); if(!consultations.length) throw httpError(404,'Consulta no encontrada'); if(consultations[0].estado!=='borrador') throw httpError(409,'La consulta debe estar en borrador para agregar información'); }
      if (name==='consultas') {
        const [assigned]=await pool.execute("SELECT 1 FROM historia_medico hm JOIN historias_clinicas h ON h.id_historia=hm.id_historia WHERE hm.id_historia=? AND hm.id_medico=? AND hm.estado='activa' AND h.estado='activa' LIMIT 1",[body.id_historia,body.id_medico]);
        if(!assigned.length) throw httpError(403,'Asigna la historia al médico antes de registrar una consulta');
        if(req.user.roles.includes('Médico')&&!req.user.roles.includes('Administrador')) {
          const [doctor]=await pool.execute('SELECT id_medico FROM medicos WHERE id_usuario=? AND activo=1',[req.user.id_usuario]);
          if(!doctor.length||String(body.id_medico)!==String(doctor[0].id_medico)) throw httpError(403,'Solo puedes registrar consultas a tu nombre');
        }
      }
    }
    if (req.user.roles.includes('Médico') && !req.user.roles.includes('Administrador')) {
      if (name==='historias-clinicas') throw httpError(403,'La apertura de historias requiere gestión administrativa');
      const related = {
        'paciente-alergias': ["SELECT 1 FROM historias_clinicas h JOIN historia_medico hm ON hm.id_historia=h.id_historia JOIN medicos m ON m.id_medico=hm.id_medico WHERE h.id_paciente=? AND hm.estado='activa' AND m.id_usuario=? AND m.activo=1 LIMIT 1",[body.id_paciente,req.user.id_usuario]],
        'paciente-antecedentes': ["SELECT 1 FROM historias_clinicas h JOIN historia_medico hm ON hm.id_historia=h.id_historia JOIN medicos m ON m.id_medico=hm.id_medico WHERE h.id_paciente=? AND hm.estado='activa' AND m.id_usuario=? AND m.activo=1 LIMIT 1",[body.id_paciente,req.user.id_usuario]],
        'consulta-diagnosticos': ['SELECT 1 FROM consultas c JOIN medicos m ON m.id_medico=c.id_medico WHERE c.id_consulta=? AND m.id_usuario=? AND m.activo=1 AND c.estado=\'borrador\' LIMIT 1',[body.id_consulta,req.user.id_usuario]],
        'signos-vitales': ['SELECT 1 FROM consultas c JOIN medicos m ON m.id_medico=c.id_medico WHERE c.id_consulta=? AND m.id_usuario=? AND m.activo=1 AND c.estado=\'borrador\' LIMIT 1',[body.id_consulta,req.user.id_usuario]],
        recetas: ['SELECT 1 FROM consultas c JOIN medicos m ON m.id_medico=c.id_medico WHERE c.id_consulta=? AND m.id_usuario=? AND m.activo=1 AND c.estado=\'borrador\' LIMIT 1',[body.id_consulta,req.user.id_usuario]],
        'ordenes-examen': ['SELECT 1 FROM consultas c JOIN medicos m ON m.id_medico=c.id_medico WHERE c.id_consulta=? AND m.id_usuario=? AND m.activo=1 AND c.estado=\'borrador\' LIMIT 1',[body.id_consulta,req.user.id_usuario]],
        'receta-detalles': ['SELECT 1 FROM recetas r JOIN consultas c ON c.id_consulta=r.id_consulta JOIN medicos m ON m.id_medico=c.id_medico WHERE r.id_receta=? AND m.id_usuario=? AND m.activo=1 AND c.estado=\'borrador\' LIMIT 1',[body.id_receta,req.user.id_usuario]],
        'orden-examen-detalles': ['SELECT 1 FROM ordenes_examen o JOIN consultas c ON c.id_consulta=o.id_consulta JOIN medicos m ON m.id_medico=c.id_medico WHERE o.id_orden=? AND m.id_usuario=? AND m.activo=1 AND c.estado=\'borrador\' LIMIT 1',[body.id_orden,req.user.id_usuario]],
      };
      if (related[name]) { const [allowed]=await pool.execute(related[name][0],related[name][1]); if(!allowed.length) throw httpError(403,'No tienes acceso a ese registro o no admite modificaciones'); }
    }
    const values = fields.map((field)=>field==='asignado_por'?req.user.id_usuario:body[field]);
    const [result] = await pool.execute(`INSERT INTO \`${config.table}\` (${fields.map((f)=>`\`${f}\``).join(',')}) VALUES (${fields.map(()=>'?').join(',')})`,values);
    const recordId=config.composite?body[config.pk]:result.insertId;
    await writeAudit({userId:req.user.id_usuario,action:'creacion',entity:name,recordId,ip:req.ip});
    res.status(201); ok(res,{id:recordId});
  }));
  if(name==='consulta-diagnosticos') router.put('/:id/:relatedId',authenticate,allowRoles('Administrador','Médico'),asyncRoute(async(req,res)=>{
    const body=z.object({tipo:z.enum(['principal','secundario','presuntivo']).optional(),observaciones:z.string().max(255).nullable().optional()}).strict().refine((value)=>Object.keys(value).length>0).parse(req.body);
    const params=[req.params.id,req.params.relatedId];
    const [rows]=await pool.execute("SELECT c.estado,c.id_medico FROM consulta_diagnostico cd JOIN consultas c ON c.id_consulta=cd.id_consulta WHERE cd.id_consulta=? AND cd.id_diagnostico=?",params);
    if(!rows.length) throw httpError(404,'Asociación diagnóstica no encontrada');
    if(rows[0].estado!=='borrador') throw httpError(409,'Los diagnósticos solo se modifican mientras la consulta está en borrador');
    if(req.user.roles.includes('Médico')&&!req.user.roles.includes('Administrador')) { const [[doctor]]=await pool.execute('SELECT id_medico FROM medicos WHERE id_usuario=? AND activo=1',[req.user.id_usuario]); if(!doctor||String(doctor.id_medico)!==String(rows[0].id_medico)) throw httpError(403,'No tienes acceso a esta consulta'); }
    const fields=Object.keys(body); await pool.execute(`UPDATE consulta_diagnostico SET ${fields.map((field)=>`\`${field}\`=?`).join(',')} WHERE id_consulta=? AND id_diagnostico=?`,[...fields.map((field)=>body[field]),...params]);
    await writeAudit({userId:req.user.id_usuario,action:'modificacion',entity:name,recordId:params[0],ip:req.ip,details:{relatedId:params[1]}}); ok(res,{updated:true});
  }));
  if(name==='consulta-diagnosticos'||name==='medico-especialidades') router.delete('/:id/:relatedId',authenticate,allowRoles(...config.roles),asyncRoute(async(req,res)=>{
    const params=[req.params.id,req.params.relatedId];
    if(name==='consulta-diagnosticos') {
      const [rows]=await pool.execute("SELECT c.estado,c.id_medico FROM consulta_diagnostico cd JOIN consultas c ON c.id_consulta=cd.id_consulta WHERE cd.id_consulta=? AND cd.id_diagnostico=?",params);
      if(!rows.length) throw httpError(404,'Asociación diagnóstica no encontrada');
      if(rows[0].estado!=='borrador') throw httpError(409,'Los diagnósticos solo se retiran mientras la consulta está en borrador');
      if(req.user.roles.includes('Médico')&&!req.user.roles.includes('Administrador')) { const [[doctor]]=await pool.execute('SELECT id_medico FROM medicos WHERE id_usuario=? AND activo=1',[req.user.id_usuario]); if(!doctor||String(doctor.id_medico)!==String(rows[0].id_medico)) throw httpError(403,'No tienes acceso a esta consulta'); }
    }
    const [result]=await pool.execute(`DELETE FROM \`${config.table}\` WHERE \`${config.fields[0]}\`=? AND \`${config.fields[1]}\`=?`,params);
    if(!result.affectedRows) throw httpError(404,'Asociación no encontrada');
    await writeAudit({userId:req.user.id_usuario,action:'modificacion',entity:name,recordId:params[0],ip:req.ip,details:{relatedId:params[1],deletion:true}}); res.status(204).end();
  }));
  router.put('/:id', asyncRoute(async (req,res) => {
    if (config.readonly || config.createOnly || config.composite) throw httpError(405,'Este recurso no permite edición directa');
    if (config.writeRoles && !req.user.roles.some((role)=>config.writeRoles.includes(role))) throw httpError(403,'No tienes permiso para editar este recurso');
    const body = parseResourceInput(config,req.body,true);
    const fields = (config.editFields||config.fields).filter((field)=>body[field]!==undefined);
    if (!fields.length) throw httpError(400,'No se recibieron campos válidos');
    const scope = !req.user.roles.includes('Administrador') && !req.user.roles.includes('Personal administrativo') ? doctorScopes[name] : null;
    const scopeParams = scope ? [req.params.id,req.user.id_usuario] : [req.params.id];
    const [existing] = await pool.execute(`SELECT * FROM \`${config.table}\` r WHERE r.\`${config.pk}\`=?${scope?` AND (${scope})`:''} LIMIT 1`,scopeParams);
    if(!existing.length) throw httpError(404,'Registro no encontrado');
    if(name==='consultas') {
      const old=existing[0];
      if(old.estado!=='borrador') throw httpError(409,'Las consultas finalizadas o anuladas no se editan');
    }
    if(name==='historias-clinicas' && (existing[0].estado!=='activa' || body.estado!=='archivada' || fields.some((field)=>field!=='estado'))) throw httpError(409,'Solo se permite archivar una historia activa');
    if(name==='historias-clinicas'&&body.estado==='archivada') {
      const [drafts]=await pool.execute("SELECT 1 FROM consultas WHERE id_historia=? AND estado='borrador' LIMIT 1",[req.params.id]);
      if(drafts.length) throw httpError(409,'Finaliza o anula los borradores antes de archivar la historia');
    }
    if(name==='asignaciones-historia'&&body.estado==='activa') {
      const [[history]]=await pool.execute('SELECT h.estado,m.activo FROM historia_medico hm JOIN historias_clinicas h ON h.id_historia=hm.id_historia JOIN medicos m ON m.id_medico=hm.id_medico WHERE hm.id_asignacion=?',[req.params.id]);
      if(!history||history.estado!=='activa'||!history.activo) throw httpError(409,'La historia y el médico deben estar activos para asignar el acceso');
    }
    if(name==='orden-examen-detalles' && body.estado) {
      const allowed={solicitado:['en_proceso','cancelado'],en_proceso:['informado','cancelado'],informado:[],cancelado:[]};
      if(!allowed[existing[0].estado]?.includes(body.estado)) throw httpError(409,'Transición de estado de examen inválida');
      if(body.estado==='informado' && (!body.resultado_resumen || !body.fecha_resultado)) throw httpError(400,'Para informar el examen se requiere resultado y fecha');
    }
    await pool.execute(`UPDATE \`${config.table}\` AS r SET ${fields.map(f=>`\`${f}\`=?`).join(',')} WHERE r.\`${config.pk}\`=?${scope?` AND (${scope})`:''}`,[...fields.map(f=>body[f]),...scopeParams]);
    await writeAudit({userId:req.user.id_usuario,action:'modificacion',entity:name,recordId:req.params.id,ip:req.ip});
    ok(res,{updated:true});
  }));
  if (['especialidades','alergias','antecedentes','diagnosticos','medicamentos','examenes'].includes(name)) router.delete('/:id', allowRoles('Administrador'), asyncRoute(async(req,res)=>{
    const [result]=await pool.execute(`DELETE FROM \`${config.table}\` WHERE \`${config.pk}\`=?`,[req.params.id]);
    if(!result.affectedRows) throw httpError(404,'Registro no encontrado');
    await writeAudit({userId:req.user.id_usuario,action:'modificacion',entity:name,recordId:req.params.id,ip:req.ip,details:{deletion:true}});
    res.status(204).end();
  }));
  if(['paciente-alergias','paciente-antecedentes'].includes(name)) router.delete('/:id',authenticate,allowRoles(...config.roles),asyncRoute(async(req,res)=>{
    const [rows]=await pool.execute(`SELECT id_paciente FROM \`${config.table}\` WHERE \`${config.pk}\`=?`,[req.params.id]);
    if(!rows.length) throw httpError(404,'Asociación no encontrada');
    if(req.user.roles.includes('Médico')&&!req.user.roles.includes('Administrador')) { const [allowed]=await pool.execute("SELECT 1 FROM historias_clinicas h JOIN historia_medico hm ON hm.id_historia=h.id_historia JOIN medicos m ON m.id_medico=hm.id_medico WHERE h.id_paciente=? AND hm.estado='activa' AND m.id_usuario=? AND m.activo=1 LIMIT 1",[rows[0].id_paciente,req.user.id_usuario]); if(!allowed.length) throw httpError(403,'No tienes acceso a este paciente'); }
    await pool.execute(`DELETE FROM \`${config.table}\` WHERE \`${config.pk}\`=?`,[req.params.id]);
    await writeAudit({userId:req.user.id_usuario,action:'modificacion',entity:name,recordId:req.params.id,ip:req.ip,details:{deletion:true}}); res.status(204).end();
  }));
  const deletableResources=['pacientes','medicos','asignaciones-historia','consultas','signos-vitales','recetas','receta-detalles','ordenes-examen','orden-examen-detalles'];
  const deleteRoles={pacientes:['Administrador'],medicos:['Administrador'],'asignaciones-historia':['Administrador','Personal administrativo'],consultas:['Administrador','Médico'],'signos-vitales':['Administrador','Médico'],recetas:['Administrador','Médico'],'receta-detalles':['Administrador','Médico'],'ordenes-examen':['Administrador','Médico'],'orden-examen-detalles':['Administrador','Médico']}[name];
  if(deletableResources.includes(name)) router.delete('/:id',allowRoles(...deleteRoles),asyncRoute(async(req,res)=>{
    const [rows]=await pool.execute(`SELECT * FROM \`${config.table}\` WHERE \`${config.pk}\`=? LIMIT 1`,[req.params.id]);
    if(!rows.length) throw httpError(404,'Registro no encontrado');
    const record=rows[0];
    if(name==='pacientes') {
      const [histories]=await pool.execute('SELECT 1 FROM historias_clinicas WHERE id_paciente=? LIMIT 1',[req.params.id]);
      if(histories.length) throw httpError(409,'No se puede eliminar un paciente con historias clínicas; conserva el registro clínico.');
    }
    if(name==='medicos') {
      const [linked]=await pool.execute('SELECT 1 FROM consultas WHERE id_medico=? UNION ALL SELECT 1 FROM historia_medico WHERE id_medico=? LIMIT 1',[req.params.id,req.params.id]);
      if(linked.length) throw httpError(409,'No se puede eliminar un médico con consultas o asignaciones; desactiva su cuenta.');
    }
    if(name==='consultas') {
      if(record.estado!=='borrador') throw httpError(409,'Solo se pueden eliminar consultas en borrador; las finalizadas o anuladas deben conservarse.');
      if(req.user.roles.includes('Médico')&&!req.user.roles.includes('Administrador')&&String(record.id_medico)!==String((await pool.execute('SELECT id_medico FROM medicos WHERE id_usuario=? AND activo=1',[req.user.id_usuario]))[0][0]?.id_medico)) throw httpError(403,'No tienes acceso a esta consulta');
      const [children]=await pool.execute('SELECT 1 FROM signos_vitales WHERE id_consulta=? UNION ALL SELECT 1 FROM consulta_diagnostico WHERE id_consulta=? UNION ALL SELECT 1 FROM recetas WHERE id_consulta=? UNION ALL SELECT 1 FROM ordenes_examen WHERE id_consulta=? LIMIT 1',[req.params.id,req.params.id,req.params.id,req.params.id]);
      if(children.length) throw httpError(409,'Elimina primero los signos, diagnósticos, recetas y órdenes asociados a esta consulta.');
    }
    const consultationLookup={
      'signos-vitales':['SELECT c.estado,c.id_medico FROM consultas c JOIN signos_vitales s ON s.id_consulta=c.id_consulta WHERE s.id_signos=?',[req.params.id]],
      recetas:['SELECT c.estado,c.id_medico FROM consultas c JOIN recetas r ON r.id_consulta=c.id_consulta WHERE r.id_receta=?',[req.params.id]],
      'receta-detalles':['SELECT c.estado,c.id_medico FROM consultas c JOIN recetas r ON r.id_consulta=c.id_consulta JOIN receta_detalle d ON d.id_receta=r.id_receta WHERE d.id_receta_detalle=?',[req.params.id]],
      'ordenes-examen':['SELECT c.estado,c.id_medico FROM consultas c JOIN ordenes_examen o ON o.id_consulta=c.id_consulta WHERE o.id_orden=?',[req.params.id]],
      'orden-examen-detalles':['SELECT c.estado,c.id_medico,oed.estado AS item_estado FROM consultas c JOIN ordenes_examen o ON o.id_consulta=c.id_consulta JOIN orden_examen_detalle oed ON oed.id_orden=o.id_orden WHERE oed.id_orden_detalle=?',[req.params.id]],
    }[name];
    if(consultationLookup) {
      const [parents]=await pool.execute(...consultationLookup);
      if(!parents.length) throw httpError(404,'Registro clínico no encontrado');
      if(parents[0].estado!=='borrador') throw httpError(409,'Solo se puede eliminar información vinculada a una consulta en borrador.');
      if(name==='orden-examen-detalles'&&parents[0].item_estado==='informado') throw httpError(409,'Un resultado informado debe conservarse en la historia clínica.');
      if(req.user.roles.includes('Médico')&&!req.user.roles.includes('Administrador')) {
        const [[doctor]]=await pool.execute('SELECT id_medico FROM medicos WHERE id_usuario=? AND activo=1',[req.user.id_usuario]);
        if(!doctor||String(doctor.id_medico)!==String(parents[0].id_medico)) throw httpError(403,'No tienes acceso a esta consulta');
      }
    }
    const [result]=await pool.execute(`DELETE FROM \`${config.table}\` WHERE \`${config.pk}\`=?`,[req.params.id]);
    if(!result.affectedRows) throw httpError(404,'Registro no encontrado');
    await writeAudit({userId:req.user.id_usuario,action:'modificacion',entity:name,recordId:req.params.id,ip:req.ip,details:{deletion:true}});
    res.status(204).end();
  }));
  return router;
}

const router = Router();
for (const [name,config] of Object.entries(resources)) router.use(`/${name}`,routerFor(name,config));
router.get('/usuarios', authenticate, allowRoles('Administrador'), asyncRoute(async(req,res)=>{
  const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(1,Number(req.query.limit)||20)),search=String(req.query.search||'').trim().slice(0,120);
  const where=search?" WHERE (u.nombres LIKE ? OR u.apellidos LIKE ? OR u.email LIKE ? OR u.estado LIKE ?)":'',params=search?[`%${search}%`,`%${search}%`,`%${search}%`,`%${search}%`]:[];
  const [[count]]=await pool.execute(`SELECT COUNT(*) AS total FROM usuarios u${where}`,params);
  const [rows]=await pool.execute(`SELECT u.id_usuario,u.nombres,u.apellidos,u.email,u.estado,u.creado_en,GROUP_CONCAT(r.nombre ORDER BY r.nombre SEPARATOR ',') roles FROM usuarios u LEFT JOIN usuario_rol ur ON ur.id_usuario=u.id_usuario LEFT JOIN roles r ON r.id_rol=ur.id_rol${where} GROUP BY u.id_usuario ORDER BY u.id_usuario DESC LIMIT ? OFFSET ?`,[...params,limit,(page-1)*limit]);
  ok(res,rows,{page,limit,total:Number(count.total)});
}));
router.post('/usuarios', authenticate, allowRoles('Administrador'), asyncRoute(async(req,res)=>{
 const body=z.object({nombres:z.string().min(1).max(100),apellidos:z.string().min(1).max(100),email:z.email().max(190),password:z.string().min(12).max(200),roles:z.array(z.string().min(1)).min(1)}).parse(req.body);
 const connection=await pool.getConnection();let userId;
 try{await connection.beginTransaction();const hash=await bcrypt.hash(body.password,12);const [user]=await connection.execute('INSERT INTO usuarios(nombres,apellidos,email,password_hash) VALUES (?,?,?,?)',[body.nombres,body.apellidos,body.email,hash]);userId=user.insertId;
  for(const roleName of [...new Set(body.roles)]){const [roles]=await connection.execute('SELECT id_rol FROM roles WHERE nombre=?',[roleName]);if(!roles.length)throw httpError(400,`Rol no existente: ${roleName}`);await connection.execute('INSERT INTO usuario_rol(id_usuario,id_rol) VALUES (?,?)',[userId,roles[0].id_rol]);}
  await connection.commit();
 }catch(error){await connection.rollback();throw error;}finally{connection.release();}
 await writeAudit({userId:req.user.id_usuario,action:'creacion',entity:'usuarios',recordId:userId,ip:req.ip});res.status(201);ok(res,{id:userId});
}));
router.put('/usuarios/:id', authenticate, allowRoles('Administrador'), asyncRoute(async(req,res)=>{
 const body=z.object({nombres:z.string().min(1).max(100).optional(),apellidos:z.string().min(1).max(100).optional(),email:z.email().max(190).optional(),estado:z.enum(['activo','inactivo','bloqueado']).optional(),roles:z.array(z.string()).optional()}).parse(req.body);
 const connection=await pool.getConnection();
 try{await connection.beginTransaction();const [targets]=await connection.execute('SELECT id_usuario,estado FROM usuarios WHERE id_usuario=? FOR UPDATE',[req.params.id]);if(!targets.length)throw httpError(404,'Usuario no encontrado');const [currentRoles]=await connection.execute('SELECT r.nombre FROM usuario_rol ur JOIN roles r ON r.id_rol=ur.id_rol WHERE ur.id_usuario=?',[req.params.id]);const wasAdmin=currentRoles.some((role)=>role.nombre==='Administrador');
  if(String(req.params.id)===String(req.user.id_usuario)&&body.estado&&body.estado!=='activo')throw httpError(409,'No puedes bloquear o desactivar tu propia cuenta');
  if(wasAdmin&&(body.estado&&body.estado!=='activo'||body.roles&&!body.roles.includes('Administrador'))){const [[count]]=await connection.query("SELECT COUNT(*) total FROM usuarios u JOIN usuario_rol ur ON ur.id_usuario=u.id_usuario JOIN roles r ON r.id_rol=ur.id_rol WHERE u.estado='activo' AND r.nombre='Administrador'");if(Number(count.total)<=1)throw httpError(409,'No se puede retirar el último administrador activo');}
  const fields=['nombres','apellidos','email','estado'].filter((f)=>body[f]!==undefined);if(fields.length)await connection.execute(`UPDATE usuarios SET ${fields.map((f)=>`\`${f}\`=?`).join(',')} WHERE id_usuario=?`,[...fields.map((f)=>body[f]),req.params.id]);
  if(body.roles){await connection.execute('DELETE FROM usuario_rol WHERE id_usuario=?',[req.params.id]);for(const name of [...new Set(body.roles)]){const [roles]=await connection.execute('SELECT id_rol FROM roles WHERE nombre=?',[name]);if(!roles.length)throw httpError(400,`Rol no existente: ${name}`);await connection.execute('INSERT INTO usuario_rol(id_usuario,id_rol) VALUES (?,?)',[req.params.id,roles[0].id_rol]);}}
  await connection.commit();
 }catch(error){await connection.rollback();throw error;}finally{connection.release();}
 await writeAudit({userId:req.user.id_usuario,action:'modificacion',entity:'usuarios',recordId:req.params.id,ip:req.ip});ok(res,{updated:true});
}));
router.get('/roles', authenticate, allowRoles('Administrador'), asyncRoute(async(_req,res)=>{const [rows]=await pool.query('SELECT id_rol,nombre,descripcion FROM roles ORDER BY nombre');ok(res,rows);}));
router.post('/roles', authenticate, allowRoles('Administrador'), asyncRoute(async(req,res)=>{
 const body=z.object({nombre:z.string().trim().min(1).max(50),descripcion:z.string().max(255).optional()}).strict().parse(req.body);
 const [result]=await pool.execute('INSERT INTO roles(nombre,descripcion) VALUES (?,?)',[body.nombre,body.descripcion||null]);
 await writeAudit({userId:req.user.id_usuario,action:'creacion',entity:'roles',recordId:result.insertId,ip:req.ip});res.status(201);ok(res,{id:result.insertId});
}));
router.put('/roles/:id', authenticate, allowRoles('Administrador'), asyncRoute(async(req,res)=>{
 const body=z.object({nombre:z.string().trim().min(1).max(50),descripcion:z.string().max(255).optional()}).strict().parse(req.body);
 const [current]=await pool.execute('SELECT nombre FROM roles WHERE id_rol=?',[req.params.id]);
 if(!current.length) throw httpError(404,'Rol no encontrado');
 if(['Administrador','Médico','Personal administrativo','Paciente'].includes(current[0].nombre)&&body.nombre!==current[0].nombre) throw httpError(409,'No se puede cambiar el nombre de un rol del sistema');
 const [result]=await pool.execute('UPDATE roles SET nombre=?,descripcion=? WHERE id_rol=?',[body.nombre,body.descripcion||null,req.params.id]);
 if(!result.affectedRows) throw httpError(404,'Rol no encontrado');
 await writeAudit({userId:req.user.id_usuario,action:'modificacion',entity:'roles',recordId:req.params.id,ip:req.ip});ok(res,{updated:true});
}));
router.delete('/roles/:id', authenticate, allowRoles('Administrador'), asyncRoute(async(req,res)=>{
 const [current]=await pool.execute('SELECT nombre FROM roles WHERE id_rol=?',[req.params.id]);
 if(!current.length) throw httpError(404,'Rol no encontrado');
 if(['Administrador','Médico','Personal administrativo','Paciente'].includes(current[0].nombre)) throw httpError(409,'No se puede eliminar un rol del sistema');
 const [result]=await pool.execute('DELETE FROM roles WHERE id_rol=?',[req.params.id]);
 if(!result.affectedRows) throw httpError(404,'Rol no encontrado');
 await writeAudit({userId:req.user.id_usuario,action:'modificacion',entity:'roles',recordId:req.params.id,ip:req.ip,details:{deletion:true}});res.status(204).end();
}));
router.get('/auditoria-accesos', authenticate, allowRoles('Administrador'), asyncRoute(async(req,res)=>{
 const limit=Math.min(100,Math.max(1,Number(req.query.limit)||50));
 const [rows]=await pool.execute(`SELECT a.id_auditoria,a.id_usuario,u.nombres,u.apellidos,a.accion,a.entidad,a.id_registro,a.fecha_hora,a.ip_origen,a.detalles FROM auditoria_accesos a JOIN usuarios u ON u.id_usuario=a.id_usuario ORDER BY a.fecha_hora DESC LIMIT ?`,[limit]);ok(res,rows);
}));
async function accessibleConsultation(connection,id,user){
 const [rows]=await connection.execute('SELECT id_consulta,id_medico,estado FROM consultas WHERE id_consulta=?',[id]);
 if(!rows.length)throw httpError(404,'Consulta no encontrada');
 if(user.roles.includes('Médico')&&!user.roles.includes('Administrador')){
  const [doctors]=await connection.execute('SELECT id_medico FROM medicos WHERE id_usuario=? AND activo=1',[user.id_usuario]);
  if(!doctors.length||String(doctors[0].id_medico)!==String(rows[0].id_medico))throw httpError(403,'No tienes acceso a esta consulta');
 }
 return rows[0];
}
router.patch('/consultas/:id/finalizacion',authenticate,allowRoles('Administrador','Médico'),asyncRoute(async(req,res)=>{
 const connection=await pool.getConnection();
 try{await connection.beginTransaction();const consultation=await accessibleConsultation(connection,req.params.id,req.user);if(consultation.estado!=='borrador')throw httpError(409,'Solo se finalizan consultas en borrador');
  await connection.execute("UPDATE consultas SET estado='finalizada',finalizada_en=CURRENT_TIMESTAMP WHERE id_consulta=? AND estado='borrador'",[req.params.id]);
  await connection.execute('INSERT INTO auditoria_accesos (id_usuario,accion,entidad,id_registro,ip_origen,detalles) VALUES (?,?,?,?,?,?)',[req.user.id_usuario,'modificacion','consultas',req.params.id,req.ip,JSON.stringify({transicion:'finalizada'})]);await connection.commit();
 }catch(error){await connection.rollback();throw error;}finally{connection.release();}
 ok(res,{id:req.params.id,estado:'finalizada'});
}));
router.patch('/consultas/:id/anulacion',authenticate,allowRoles('Administrador'),asyncRoute(async(req,res)=>{
 const {motivo}=z.object({motivo:z.string().trim().min(10).max(255)}).strict().parse(req.body);
 const connection=await pool.getConnection();
 try{await connection.beginTransaction();const [rows]=await connection.execute('SELECT estado FROM consultas WHERE id_consulta=? FOR UPDATE',[req.params.id]);if(!rows.length)throw httpError(404,'Consulta no encontrada');if(rows[0].estado==='anulada')throw httpError(409,'La consulta ya está anulada');
  await connection.execute("UPDATE consultas SET estado='anulada',motivo_anulacion=?,anulada_en=CURRENT_TIMESTAMP WHERE id_consulta=?",[motivo,req.params.id]);
  await connection.execute('INSERT INTO auditoria_accesos (id_usuario,accion,entidad,id_registro,ip_origen,detalles) VALUES (?,?,?,?,?,?)',[req.user.id_usuario,'anulacion','consultas',req.params.id,req.ip,JSON.stringify({motivoRegistrado:true})]);
  await connection.commit();
 }catch(error){await connection.rollback();throw error;}finally{connection.release();}
 ok(res,{id:req.params.id,estado:'anulada'});
}));
router.get('/consultas/:id/adendas',authenticate,allowRoles('Administrador','Médico'),asyncRoute(async(req,res)=>{
 const connection=await pool.getConnection();
 try{await accessibleConsultation(connection,req.params.id,req.user);const [rows]=await connection.execute(`SELECT a.id_adenda,a.id_consulta,a.id_usuario,u.nombres,u.apellidos,a.contenido,a.creado_en FROM consultas_adendas a JOIN usuarios u ON u.id_usuario=a.id_usuario WHERE a.id_consulta=? ORDER BY a.creado_en`,[req.params.id]);for(const row of rows)await writeAudit({userId:req.user.id_usuario,action:'consulta',entity:'consultas_adendas',recordId:row.id_adenda,ip:req.ip});ok(res,rows);}finally{connection.release();}
}));
router.post('/consultas/:id/adendas',authenticate,allowRoles('Administrador','Médico'),asyncRoute(async(req,res)=>{
 const {contenido}=z.object({contenido:z.string().trim().min(1).max(20000)}).strict().parse(req.body);
 const connection=await pool.getConnection();
 try{await connection.beginTransaction();const consultation=await accessibleConsultation(connection,req.params.id,req.user);if(!['finalizada','anulada'].includes(consultation.estado))throw httpError(409,'Las adendas solo se agregan a consultas finalizadas o anuladas');
  const [insert]=await connection.execute('INSERT INTO consultas_adendas(id_consulta,id_usuario,contenido) VALUES (?,?,?)',[req.params.id,req.user.id_usuario,contenido]);
  await connection.execute('INSERT INTO auditoria_accesos (id_usuario,accion,entidad,id_registro,ip_origen,detalles) VALUES (?,?,?,?,?,?)',[req.user.id_usuario,'creacion','consultas_adendas',insert.insertId,req.ip,null]);await connection.commit();res.status(201);ok(res,{id:insert.insertId});
 }catch(error){await connection.rollback();throw error;}finally{connection.release();}
}));
export default router;
