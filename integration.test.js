import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { test } from 'node:test';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';

const enabled=process.env.INTEGRATION_TESTS==='1';

test('API y MySQL respetan el flujo clínico y el alcance por médico', {skip:!enabled}, async(t)=>{
  assert.match(process.env.DB_NAME||'',/_test$/,'La integración solo puede usar una base cuyo nombre termine en _test');
  const [databaseRows]=await pool.query('SELECT DATABASE() AS name');
  assert.match(databaseRows[0].name,/_test$/,'La conexión efectiva debe apuntar a una base de pruebas');
  process.env.SESSION_SECRET=randomBytes(48).toString('base64url');

  let server;
  t.after(async()=>{
    if(server){server.close();await once(server,'close');}
    await pool.end();
  });

  for(const [name,description] of [['Administrador','Pruebas de integración'],['Médico','Pruebas de integración']]){
    await pool.execute('INSERT INTO roles(nombre,descripcion) VALUES (?,?) ON DUPLICATE KEY UPDATE descripcion=VALUES(descripcion)',[name,description]);
  }
  await pool.execute('INSERT INTO roles(nombre,descripcion) VALUES (?,?) ON DUPLICATE KEY UPDATE descripcion=VALUES(descripcion)',['Paciente','Acceso al portal propio']);
  const email=`integration-${randomUUID()}@example.test`;
  const password=`Temp-${randomBytes(20).toString('hex')}-9A`;
  const hash=await bcrypt.hash(password,4);
  const [user]=await pool.execute('INSERT INTO usuarios(nombres,apellidos,email,password_hash) VALUES (?,?,?,?)',['Admin','Integration',email,hash]);
  const [[adminRole]]=await pool.execute("SELECT id_rol FROM roles WHERE nombre='Administrador'");
  await pool.execute('INSERT INTO usuario_rol(id_usuario,id_rol) VALUES (?,?)',[user.insertId,adminRole.id_rol]);

  server=app.listen(0,'127.0.0.1');
  await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}/api`;
  const makeClient=()=>{
    const cookies=new Map();
    const absorb=(response)=>{
      for(const value of response.headers.getSetCookie()){
        const [pair]=value.split(';'),index=pair.indexOf('=');
        if(index>0)cookies.set(pair.slice(0,index),pair.slice(index+1));
      }
    };
    const cookieHeader=()=>[...cookies].map(([key,value])=>`${key}=${value}`).join('; ');
    return {
      async request(path,{method='GET',body,csrf=false,expectedStatus}={}){
        const headers={};
        if(body!==undefined)headers['content-type']='application/json';
        if(cookies.size)headers.cookie=cookieHeader();
        if(csrf)headers['x-csrf-token']=cookies.get('ca_csrf');
        const response=await fetch(`${base}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
        absorb(response);
        const text=await response.text();
        const data=text?JSON.parse(text):null;
        assert.equal(response.status,expectedStatus??200,`${method} ${path}: ${JSON.stringify(data)}`);
        return data;
      },
      async login(loginEmail,loginPassword){
        await this.request('/auth/csrf');
        await this.request('/auth/login',{method:'POST',csrf:true,body:{email:loginEmail,password:loginPassword}});
      },
    };
  };

  const admin=makeClient();
  const health=await admin.request('/health');
  assert.equal(health.data.database,databaseRows[0].name);
  await admin.login(email,password);
  const adminSession=await admin.request('/auth/me');
  assert.equal(adminSession.data.user.email,email);

  const document=`IT-${randomUUID().slice(0,12)}`;
  const patient=await admin.request('/pacientes',{method:'POST',expectedStatus:201,body:{tipo_documento:'CC',numero_documento:document,nombres:'Patient',apellidos:'Integration',fecha_nacimiento:'1990-01-01'}});
  const patientId=patient.data.id;
  const otherPatient=await admin.request('/pacientes',{method:'POST',expectedStatus:201,body:{tipo_documento:'CC',numero_documento:`OTHER-${document}`,nombres:'Other',apellidos:'Patient',fecha_nacimiento:'1991-01-01'}});
  const orderedPatients=await admin.request('/pacientes?sort=nombres&direction=asc&limit=100');
  assert.ok(orderedPatients.data.findIndex((row)=>row.nombres==='Other')<orderedPatients.data.findIndex((row)=>row.nombres==='Patient'));
  await admin.request(`/pacientes/${patientId}`,{method:'PUT',body:{telefono:'3000000000'}});
  const patientEmail=`patient-${randomUUID()}@example.test`;
  const patientPassword=`Temp-${randomBytes(20).toString('hex')}-9A`;
  const patientUser=await admin.request('/usuarios',{method:'POST',expectedStatus:201,body:{nombres:'Patient',apellidos:'Portal',email:patientEmail,password:patientPassword,roles:['Paciente']}});
  await admin.request(`/pacientes/${patientId}`,{method:'PUT',body:{id_usuario:patientUser.data.id}});
  const history=await admin.request('/historias-clinicas',{method:'POST',expectedStatus:201,body:{id_paciente:patientId,numero_historia:`HC-${document}`}});
  const historyId=history.data.id;

  const doctorEmail=`doctor-${randomUUID()}@example.test`;
  const doctorPassword=`Temp-${randomBytes(20).toString('hex')}-9A`;
  const doctorUser=await admin.request('/usuarios',{method:'POST',expectedStatus:201,body:{nombres:'Doctor',apellidos:'Integration',email:doctorEmail,password:doctorPassword,roles:['Médico']}});
  const doctor=await admin.request('/medicos',{method:'POST',expectedStatus:201,body:{id_usuario:doctorUser.data.id,numero_registro_profesional:`RM-${randomUUID()}`}});
  const userSearch=await admin.request(`/usuarios?search=${encodeURIComponent(doctorEmail)}&page=1&limit=10`);
  assert.equal(userSearch.meta.total,1);
  assert.equal(userSearch.data[0].email,doctorEmail);
  await admin.request(`/usuarios/${doctorUser.data.id}`,{method:'PUT',body:{nombres:'Doctor Actualizado',estado:'activo',roles:['Médico']}});
  const updatedUser=await admin.request(`/usuarios?search=${encodeURIComponent(doctorEmail)}&page=1&limit=10`);
  assert.equal(updatedUser.data[0].nombres,'Doctor Actualizado');
  assert.equal(updatedUser.data[0].roles,'Médico');
  await admin.request(`/usuarios/${doctorUser.data.id}`,{method:'PUT',body:{roles:['Rol inexistente']},expectedStatus:400});
  assert.equal((await admin.request(`/usuarios?search=${encodeURIComponent(doctorEmail)}&page=1&limit=10`)).data[0].roles,'Médico');
  const doctorId=doctor.data.id;
  const assignment=await admin.request('/asignaciones-historia',{method:'POST',expectedStatus:201,body:{id_historia:historyId,id_medico:doctorId}});
  assert.ok((await admin.request('/asignaciones-historia?estado=activa')).data.some((row)=>row.id_asignacion===assignment.data.id));
  await admin.request('/medico-especialidades',{method:'POST',expectedStatus:201,body:{id_medico:doctorId,id_especialidad:(await admin.request('/especialidades',{method:'POST',expectedStatus:201,body:{nombre:`Specialty ${document}`}})).data.id}});
  const [specialtyRows]=await pool.execute('SELECT id_especialidad FROM medico_especialidad WHERE id_medico=?',[doctorId]);
  await admin.request(`/medico-especialidades/${doctorId}/${specialtyRows[0].id_especialidad}`,{method:'DELETE',expectedStatus:204});

  const clinician=makeClient();
  await clinician.login(doctorEmail,doctorPassword);
  const visiblePatients=await clinician.request('/pacientes');
  assert.deepEqual(visiblePatients.data.map((row)=>row.id_paciente),[patientId]);
  assert.equal((await clinician.request(`/pacientes/${patientId}/record`)).data.patient.id_paciente,patientId);
  await clinician.request(`/pacientes/${patientId}/record/export`,{method:'POST'});
  await clinician.request(`/pacientes/${otherPatient.data.id}/record/export`,{method:'POST',expectedStatus:403});
  const protectedAllergy=await admin.request('/alergias',{method:'POST',expectedStatus:201,body:{nombre:`Protected ${document}`,tipo:'otra'}});
  const protectedLink=await admin.request('/paciente-alergias',{method:'POST',expectedStatus:201,body:{id_paciente:otherPatient.data.id,id_alergia:protectedAllergy.data.id,severidad:'leve'}});
  await clinician.request(`/paciente-alergias/${protectedLink.data.id}`,{method:'DELETE',expectedStatus:403});
  await clinician.request('/asignaciones-historia',{expectedStatus:403});

  const consultation=await clinician.request('/consultas',{method:'POST',expectedStatus:201,body:{id_historia:historyId,id_medico:doctorId,fecha_hora:'2026-11-13 10:00:00',tipo_consulta:'primera_vez',motivo_consulta:'Prueba de integración'}});
  const diagnosis=await clinician.request('/diagnosticos',{method:'POST',expectedStatus:201,body:{codigo_cie10:`Z-${randomUUID().slice(0,8)}`,nombre:`Diagnosis ${document}`}});
  await clinician.request('/consulta-diagnosticos',{method:'POST',expectedStatus:201,body:{id_consulta:consultation.data.id,id_diagnostico:diagnosis.data.id,tipo:'principal',observaciones:'Registro de prueba'}});
  await clinician.request(`/consulta-diagnosticos/${consultation.data.id}/${diagnosis.data.id}`,{method:'PUT',body:{tipo:'secundario',observaciones:'Actualizado en borrador'}});
  const extraDiagnosis=await clinician.request('/diagnosticos',{method:'POST',expectedStatus:201,body:{codigo_cie10:`Y-${randomUUID().slice(0,8)}`,nombre:`Extra diagnosis ${document}`}});
  await clinician.request('/consulta-diagnosticos',{method:'POST',expectedStatus:201,body:{id_consulta:consultation.data.id,id_diagnostico:extraDiagnosis.data.id,tipo:'presuntivo'}});
  await clinician.request(`/consulta-diagnosticos/${consultation.data.id}/${extraDiagnosis.data.id}`,{method:'DELETE',expectedStatus:204});
  await clinician.request('/signos-vitales',{method:'POST',expectedStatus:201,body:{id_consulta:consultation.data.id,presion_sistolica:120,presion_diastolica:80,frecuencia_cardiaca:72,temperatura_c:36.5,saturacion_oxigeno_pct:98}});
  await clinician.request('/signos-vitales',{method:'POST',body:{id_consulta:consultation.data.id,saturacion_oxigeno_pct:101},expectedStatus:400});
  await clinician.request('/signos-vitales',{method:'POST',body:{id_consulta:consultation.data.id,frecuencia_cardiaca:65536},expectedStatus:400});
  await clinician.request('/signos-vitales',{method:'POST',body:{id_consulta:consultation.data.id,temperatura_c:36.55},expectedStatus:400});
  const allergy=await clinician.request('/alergias',{method:'POST',expectedStatus:201,body:{nombre:`Allergy ${document}`,tipo:'medicamento'}});
  const allergyLink=await clinician.request('/paciente-alergias',{method:'POST',expectedStatus:201,body:{id_paciente:patientId,id_alergia:allergy.data.id,reaccion:'Rash',severidad:'moderada'}});
  assert.ok(allergyLink.data.id>0);
  const extraAllergy=await clinician.request('/alergias',{method:'POST',expectedStatus:201,body:{nombre:`Temporary allergy ${document}`,tipo:'otra'}});
  const extraAllergyLink=await clinician.request('/paciente-alergias',{method:'POST',expectedStatus:201,body:{id_paciente:patientId,id_alergia:extraAllergy.data.id,severidad:'leve'}});
  await clinician.request(`/paciente-alergias/${extraAllergyLink.data.id}`,{method:'DELETE',expectedStatus:204});
  const antecedent=await clinician.request('/antecedentes',{method:'POST',expectedStatus:201,body:{nombre:`Antecedent ${document}`}});
  const antecedentLink=await clinician.request('/paciente-antecedentes',{method:'POST',expectedStatus:201,body:{id_paciente:patientId,id_antecedente:antecedent.data.id,tipo:'personal',detalle:'Integracion'}});
  await clinician.request(`/paciente-antecedentes/${antecedentLink.data.id}`,{method:'DELETE',expectedStatus:204});
  await clinician.request('/paciente-antecedentes',{method:'POST',expectedStatus:201,body:{id_paciente:patientId,id_antecedente:antecedent.data.id,tipo:'personal',detalle:'Persistente'}});
  const medication=await admin.request('/medicamentos',{method:'POST',expectedStatus:201,body:{nombre:`Medication ${document}`,codigo_catalogo:`M-${randomUUID()}`}});
  const exam=await admin.request('/examenes',{method:'POST',expectedStatus:201,body:{nombre:`Exam ${document}`,codigo_catalogo:`E-${randomUUID()}`}});
  await clinician.request('/recetas',{method:'POST',expectedStatus:201,body:{id_consulta:consultation.data.id,detalles:[{id_medicamento:medication.data.id,dosis:'1 tableta'}]}});
  const examOrder=await clinician.request('/ordenes-examen',{method:'POST',expectedStatus:201,body:{id_consulta:consultation.data.id,examenes:[{id_examen:exam.data.id}]}});
  const [examDetailRows]=await pool.execute('SELECT id_orden_detalle FROM orden_examen_detalle WHERE id_orden=?',[examOrder.data.id]);
  const examDetailId=examDetailRows[0].id_orden_detalle;
  await clinician.request(`/orden-examen-detalles/${examDetailId}`,{method:'PUT',body:{estado:'en_proceso'}});
  await clinician.request(`/orden-examen-detalles/${examDetailId}`,{method:'PUT',body:{estado:'informado'},expectedStatus:400});
  await clinician.request(`/orden-examen-detalles/${examDetailId}`,{method:'PUT',body:{estado:'informado',resultado_resumen:'Resultado de prueba',fecha_resultado:'2026-11-13'}});
  await clinician.request(`/orden-examen-detalles/${examDetailId}`,{method:'PUT',body:{estado:'solicitado'},expectedStatus:409});
  await clinician.request(`/consultas/${consultation.data.id}/finalizacion`,{method:'PATCH',body:{}});
  await clinician.request(`/consulta-diagnosticos/${consultation.data.id}/${diagnosis.data.id}`,{method:'PUT',body:{tipo:'principal'},expectedStatus:409});
  await clinician.request(`/consultas/${consultation.data.id}/adendas`,{method:'POST',expectedStatus:201,body:{contenido:'Aclaración de prueba'}});
  await clinician.request('/consultas',{method:'POST',expectedStatus:201,body:{id_historia:historyId,id_medico:doctorId,fecha_hora:'2026-11-13 11:00:00',tipo_consulta:'control',motivo_consulta:'Borrador no visible al paciente'}});
  const draftRows=await clinician.request('/consultas?limit=100');
  const draftId=draftRows.data.find((row)=>row.motivo_consulta==='Borrador no visible al paciente').id_consulta;
  await admin.request(`/consultas/${draftId}/anulacion`,{method:'PATCH',body:{motivo:'Anulacion de prueba controlada'}});
  const auditRows=await admin.request('/auditoria-accesos?limit=100');
  assert.ok(auditRows.data.some((row)=>row.accion==='exportacion'&&String(row.id_registro)===String(patientId)));
  assert.ok(auditRows.data.some((row)=>row.accion==='anulacion'&&String(row.id_registro)===String(draftId)));

  const record=await clinician.request(`/pacientes/${patientId}/record`);
  assert.equal(record.data.consultations.length,2);
  assert.equal(record.data.prescriptions.length,1);
  assert.equal(record.data.orders.length,1);
  assert.equal((await clinician.request(`/consulta-diagnosticos?id_consulta=${consultation.data.id}`)).data.length,1);
  assert.equal((await clinician.request(`/signos-vitales?id_consulta=${consultation.data.id}`)).data.length,1);
  assert.equal((await clinician.request(`/paciente-alergias?id_paciente=${patientId}`)).data.length,1);
  assert.equal((await clinician.request(`/paciente-antecedentes?id_paciente=${patientId}`)).data.length,1);
  assert.equal(assignment.data.id>0,true);
  const patientPortal=makeClient();
  await patientPortal.login(patientEmail,patientPassword);
  const linkedProfile=await patientPortal.request('/pacientes/portal/me');
  assert.equal(linkedProfile.data.patient.id_paciente,patientId);
  await patientPortal.request(`/pacientes/${patientId}/record/export`,{method:'POST'});
  await patientPortal.request(`/pacientes/${otherPatient.data.id}/record/export`,{method:'POST',expectedStatus:403});
  const portalRecord=await patientPortal.request(`/pacientes/${patientId}/record`);
  assert.equal(portalRecord.data.consultations.length,1);
  await patientPortal.request('/pacientes',{expectedStatus:403});
  await patientPortal.request(`/pacientes/${otherPatient.data.id}/record`,{expectedStatus:403});

});
