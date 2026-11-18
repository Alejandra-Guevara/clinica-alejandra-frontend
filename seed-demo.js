import 'dotenv/config';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { pool } from '../src/config/db.js';

// This loader is deliberately restricted to a local development database.
const dbName = process.env.DB_NAME || 'clinica-alejandra';
const dbHost = (process.env.DB_HOST || '127.0.0.1').toLowerCase();
if (dbName !== 'clinica-alejandra' || !['localhost', '127.0.0.1', '::1'].includes(dbHost)
  || process.env.NODE_ENV === 'production' || process.env.DEMO_SEED_CONFIRM !== 'CONFIRM_DEMO_SEED') {
  console.error('Carga cancelada: requiere la base local clinica-alejandra, NODE_ENV distinto de production y DEMO_SEED_CONFIRM=CONFIRM_DEMO_SEED.');
  await pool.end();
  process.exit(1);
}

const patients = [
  ['DEMO-0001','Valentina','Montoya','1994-03-12','Femenino','O+'],['DEMO-0002','Samuel','Restrepo','1988-07-24','Masculino','A+'],
  ['DEMO-0003','Lucía','Vélez','2001-11-05','Femenino','B+'],['DEMO-0004','Tomás','Arango','1979-01-30','Masculino','AB+'],
  ['DEMO-0005','Mariana','Ospina','2012-06-16','Femenino','O-'],['DEMO-0006','Nicolás','Quintero','1966-09-08','Masculino','A-'],
  ['DEMO-0007','Isabella','Castaño','1998-02-19','Femenino','A+'],['DEMO-0008','Julián','Mejía','1990-10-03','Masculino','O+'],
  ['DEMO-0009','Sara','Londoño','1983-05-28','Femenino','B-'],['DEMO-0010','Emilio','Giraldo','2008-12-11','Masculino','A+'],
  ['DEMO-0011','Catalina','Restrepo','1972-04-21','Femenino','O+'],['DEMO-0012','Manuel','Cárdenas','1958-08-14','Masculino','B+'],
  ['DEMO-0013','Antonia','Pardo','1995-07-09','Femenino','AB-'],['DEMO-0014','Simón','Valencia','1986-01-17','Masculino','O-'],
  ['DEMO-0015','Gabriela','Soto','2003-09-30','Femenino','A-'],
].map(([doc,nombres,apellidos,birth,sex,blood])=>({doc,nombres,apellidos,birth,sex,blood}));

const doctors = [
  ['Laura','Pineda','Medicina general'],['Mateo','Salas','Pediatría'],['Inés','Cárdenas','Dermatología'],
  ['Andrés','Mejía','Medicina interna'],['Camila','Rojas','Ginecología'],['Felipe','Navarro','Cardiología'],
].map(([nombres,apellidos,specialty],i)=>({nombres,apellidos,specialty,reg:`DEMO-RM-${String(i+1).padStart(3,'0')}`}));

const diagnoses = [
  ['Z108','Otros exámenes generales de personas sin quejas o diagnóstico informado','Control general de salud.'],
  ['J069','Infección aguda de las vías respiratorias superiores, no especificada','Cuadro respiratorio agudo no complicado.'],
  ['L309','Dermatitis, no especificada','Dermatitis de evolución reciente.'],
  ['I10','Hipertensión esencial (primaria)','Elevación crónica de la presión arterial.'],
  ['K219','Enfermedad del reflujo gastroesofágico sin esofagitis','Síntomas compatibles con reflujo gastroesofágico.'],
  ['M545','Lumbago no especificado','Dolor lumbar sin signos de alarma descritos.'],
  ['R51X','Cefalea','Cefalea sin signos de alarma descritos.'],
  ['J039','Amigdalitis aguda, no especificada','Odinofagia y hallazgos faríngeos agudos.'],
];

const visitPlans = [
  [0,0,6,'cefalea leve episódica','Cefalea bilateral leve tras varias horas de trabajo frente a pantalla.','Mejora con descanso; niega fiebre, vómito, traumatismo reciente o déficit neurológico.','Sin antecedentes neurológicos relevantes consignados. Sueño algo irregular durante la última semana.','Niega alteraciones visuales persistentes, debilidad y síntomas infecciosos.','Alerta, lenguaje y marcha conservados; examen neurológico general sin hallazgos focales.','Cefalea episódica sin signos de alarma descritos.','Hidratación, pausas visuales y descanso; se explican signos de alarma y control si persiste.'],
  [1,0,1,'congestión nasal y tos seca','Tres días de rinorrea, congestión y tos ocasional, sin dificultad respiratoria.','Evolución gradual, sin fiebre persistente ni dolor torácico. Tolera líquidos y alimentos.','Sin antecedentes respiratorios relevantes. No refiere alergias medicamentosas.','Rinorrea y tos; niega disnea, dolor torácico y síntomas gastrointestinales.','Mucosas húmedas, faringe discretamente eritematosa, ventilación pulmonar conservada.','Cuadro compatible con infección respiratoria alta no complicada.','Manejo sintomático e hidratación; se explican signos de alarma y control si hay empeoramiento.'],
  [2,2,2,'prurito y enrojecimiento en antebrazo','Lesión pruriginosa localizada de cinco días, posterior al uso de un producto cosmético nuevo.','Sin fiebre, dolor intenso ni compromiso de mucosas.','Niega alergias a medicamentos; refiere reacción cutánea previa a fragancias.','Prurito localizado; sin síntomas sistémicos.','Placa eritematosa pequeña en antebrazo, sin secreción ni signos de infección.','Dermatitis localizada posiblemente relacionada con irritante de contacto.','Evitar el producto asociado, cuidado suave de la piel y revisión si progresa o aparecen signos de infección.'],
  [3,3,3,'seguimiento de presión arterial','Consulta de control; refiere cumplimiento del plan previamente establecido y no presenta síntomas agudos.','Registros domiciliarios variables; niega dolor torácico, disnea o síntomas neurológicos.','Antecedente personal de hipertensión. Refiere adherencia y seguimiento periódico.','Niega cefalea intensa, alteraciones visuales, disnea y dolor torácico.','Alerta, sin dificultad respiratoria; cifras tensionales elevadas en la medición actual.','Hipertensión en seguimiento; requiere valoración integral de tendencia y riesgo cardiovascular.','Revisar registros domiciliarios, mantener seguimiento con su profesional tratante y solicitar laboratorios de control.'],
  [4,1,7,'dolor de garganta','Dos días de odinofagia leve, congestión nasal y tos ocasional.','Sin dificultad para deglutir líquidos, fiebre persistente ni dificultad respiratoria.','Sin antecedentes de importancia consignados.','Odinofagia leve; niega disnea, dolor torácico y exantema.','Hidratación adecuada; faringe eritematosa sin exudado visible; respiración tranquila.','Cuadro faríngeo agudo sin signos de complicación en la valoración.','Hidratación, observación y educación sobre signos de alarma; reevaluación si persiste o empeora.'],
  [5,3,6,'dolor lumbar mecánico','Molestia lumbar intermitente tras actividad física, sin irradiación ni limitación importante.','Inicio hace una semana; mejora con reposo relativo. Niega trauma significativo.','Sin antecedentes quirúrgicos de columna ni síntomas similares persistentes.','Niega debilidad, alteración sensitiva, fiebre y cambios esfinterianos.','Marcha conservada; movilidad lumbar levemente molesta, sin déficit neurológico evidente.','Dolor lumbar mecánico sin signos de alarma descritos.','Actividad gradual según tolerancia, higiene postural y control; consultar de inmediato ante signos neurológicos o empeoramiento.'],
  [6,4,0,'control preventivo','Consulta preventiva, sin síntomas ginecológicos agudos.','Ciclos regulares según refiere; no presenta dolor pélvico ni sangrado anormal.','Antecedentes ginecológicos revisados en entrevista; sin alergias conocidas.','Niega fiebre, dolor pélvico y síntomas urinarios.','Buen estado general; valoración física general sin hallazgos agudos.','Control preventivo sin síntomas de alarma en esta consulta.','Actualizar tamizajes conforme a edad y antecedentes durante consulta profesional.'],
  [7,0,4,'ardor retroesternal ocasional','Refiere ardor epigástrico y retroesternal ocasional posterior a comidas abundantes.','Sin vómito persistente, sangrado digestivo, pérdida de peso ni disfagia.','Niega uso frecuente de antiinflamatorios y alergias medicamentosas conocidas.','Síntomas digestivos posprandiales; niega dolor abdominal intenso.','Abdomen blando, no doloroso, sin signos de irritación peritoneal.','Síntomas compatibles con reflujo; sin signos de alarma descritos.','Revisar hábitos alimentarios y seguimiento clínico; consultar si aparecen signos de alarma.'],
  [8,3,0,'control de riesgo cardiovascular','Acude a seguimiento de factores de riesgo; se encuentra sin síntomas cardiovasculares agudos.','Niega disnea, dolor torácico, síncope o edema de aparición reciente.','Antecedente familiar de hipertensión en madre.','Revisión cardiovascular sin síntomas de alarma referidos.','Ritmo regular a la auscultación; sin edema periférico.','Control preventivo de riesgo cardiovascular.','Se solicita perfil lipídico para revisión en control clínico y se refuerzan hábitos saludables.'],
  [9,1,1,'síntomas respiratorios leves','Congestión nasal y malestar de dos días, sin dificultad respiratoria.','Apetito e hidratación adecuados; no refiere fiebre persistente.','Antecedentes pediátricos sin enfermedades crónicas referidas por acompañante.','Niega sibilancias, disnea y dolor torácico.','Buen estado general, hidratación conservada, auscultación pulmonar sin ruidos agregados.','Cuadro respiratorio alto leve, sin signos de dificultad respiratoria.','Cuidados generales e hidratación; adulto responsable recibe orientación de signos de alarma.'],
  [10,4,0,'valoración de seguimiento','Consulta de seguimiento preventivo, sin molestias actuales.','No refiere cambios recientes en el estado general.','Antecedentes revisados y conciliados durante la consulta.','Revisión por sistemas sin síntomas agudos relevantes.','Examen general sin hallazgos agudos relevantes.','Seguimiento preventivo.','Continuar controles periódicos y actualizar tamizajes según antecedentes.'],
  [11,5,3,'seguimiento de presión arterial','Control de hipertensión; refiere mediciones domiciliarias dentro del rango acordado con su profesional.','Niega dolor torácico, disnea, cefalea intensa o déficit focal.','Hipertensión y dislipidemia en seguimiento; tratamiento habitual referido por el paciente.','Niega síntomas neurológicos o cardiovasculares agudos.','Alerta, sin dificultad respiratoria; presión arterial en rango limítrofe durante la visita.','Seguimiento de hipertensión, sin síntomas de descompensación aguda.','Continuar control con equipo tratante y revisar resultados de laboratorio en próxima cita.'],
  [12,2,2,'irritación cutánea localizada','Enrojecimiento leve en manos después de labores domésticas, sin lesiones abiertas.','Mejora parcialmente al suspender el detergente nuevo. Sin fiebre ni dolor.','Refiere sensibilidad cutánea a fragancias.','Niega síntomas generales y lesiones en mucosas.','Piel seca con eritema superficial localizado, sin secreción.','Irritación cutánea posiblemente asociada a exposición de contacto.','Reducir exposición al irritante, usar medidas de protección y volver si aparecen lesiones extensas o signos de infección.'],
  [13,3,4,'dispepsia ocasional','Molestia epigástrica leve y ocasional después de comidas copiosas.','Sin disfagia, sangrado, vómito persistente ni pérdida de peso referida.','Sin antecedentes digestivos de alarma conocidos.','Niega dolor intenso y cambios persistentes del hábito intestinal.','Abdomen blando, no doloroso, sin masas palpables.','Dispepsia leve sin signos de alarma descritos.','Revisar hábitos y evolución; seguimiento profesional si los síntomas persisten.'],
  [14,0,6,'cefalea episódica','Cefalea bilateral leve posterior a jornadas prolongadas frente a pantalla.','Mejora con descanso; no se asocia a vómito, fiebre ni déficit neurológico.','Sin antecedentes neurológicos relevantes consignados.','Niega alteración visual persistente, debilidad y fiebre.','Alerta, lenguaje y marcha conservados; examen neurológico general sin hallazgos focales.','Cefalea episódica sin signos de alarma descritos.','Higiene del sueño, pausas visuales e hidratación; consultar ante aparición de signos de alarma.'],
  [0,0,0,'seguimiento preventivo','Seguimiento de hábitos de salud, sin síntomas nuevos.','Refiere buena tolerancia a actividad cotidiana.','Sin cambios relevantes en antecedentes desde el control previo.','Revisión por sistemas sin síntomas agudos.','Buen estado general, sin hallazgos agudos.','Seguimiento preventivo.','Continuar controles periódicos y medidas preventivas acordadas.'],
  [1,0,1,'control de síntomas respiratorios','Revisión tras cuadro respiratorio reciente; tos en mejoría y sin fiebre.','Evolución favorable, tolera vía oral y realiza actividades habituales.','Sin cambios en antecedentes.','Niega dificultad respiratoria y dolor torácico.','Ventilación bilateral conservada, sin signos de dificultad respiratoria.','Evolución favorable de infección respiratoria alta.','Continuar medidas de soporte y consultar si hay recaída o dificultad respiratoria.'],
  [2,2,2,'seguimiento dermatológico','Control de irritación cutánea; refiere mejoría al suspender exposición a fragancias.','Sin nuevas lesiones ni síntomas sistémicos.','Antecedente de sensibilidad cutánea a fragancias.','Niega fiebre, dolor y lesiones en mucosas.','Lesión previa en resolución, sin signos de infección.','Dermatitis localizada en mejoría.','Mantener cuidado suave de la piel y evitar irritante identificado.'],
  [3,3,3,'control de presión arterial','Seguimiento de presión arterial con revisión de registros domiciliarios.','Sin síntomas cardiovasculares agudos; registros aportados para evaluación.','Hipertensión en seguimiento.','Niega dolor torácico, disnea y síntomas neurológicos.','Sin dificultad respiratoria ni edema; revisión de cifras tensionales.','Control evolutivo de hipertensión.','Continuar plan indicado por su profesional tratante y control periódico.'],
  [4,1,7,'revisión de odinofagia','Revisión por síntomas faríngeos en mejoría, sin dificultad para deglutir.','Afebril según refiere; tolerancia oral conservada.','Sin antecedentes de importancia nuevos.','Niega disnea y empeoramiento del dolor.','Buen estado general; mucosas húmedas.','Evolución favorable del cuadro faríngeo.','Continuar hidratación y consultar si reaparece fiebre persistente o dificultad respiratoria.'],
  [5,3,5,'seguimiento de dolor lumbar','Control de dolor lumbar con mejoría gradual y retorno progresivo a actividades.','Niega irradiación, debilidad y cambios esfinterianos.','Sin cambios en antecedentes.','Niega fiebre y síntomas neurológicos.','Marcha estable, movilidad funcional conservada.','Dolor lumbar en mejoría, sin signos de alarma referidos.','Progresar actividad según tolerancia y mantener vigilancia de signos de alarma.'],
  [6,4,0,'control preventivo','Seguimiento de salud preventiva, sin molestias agudas.','Sin cambios clínicos relevantes desde valoración anterior.','Antecedentes ginecológicos actualizados durante entrevista.','Niega dolor pélvico y sangrado anormal.','Buen estado general, sin hallazgos agudos.','Seguimiento preventivo.','Continuar cronograma de controles según edad y antecedentes.'],
  [7,0,4,'seguimiento digestivo','Revisión de ardor retroesternal ocasional; refiere menor frecuencia tras ajustes de hábitos.','Niega disfagia, vómito, sangrado o pérdida de peso.','Sin cambios en antecedentes.','Síntomas digestivos en mejoría, sin signos de alarma.','Abdomen blando, no doloroso.','Síntomas de reflujo en mejoría.','Mantener medidas generales y control si reaparecen o progresan síntomas.'],
  [8,5,3,'revisión de perfil lipídico','Consulta para revisar resultados de laboratorio y riesgo cardiovascular.','Sin síntomas cardiovasculares; trae resultados para discusión clínica.','Antecedente familiar de hipertensión.','Niega disnea, dolor torácico y edema.','Buen estado general, sin hallazgos agudos.','Revisión de riesgo cardiovascular y resultados de laboratorio.','Interpretar resultados en contexto clínico y mantener control periódico.'],
].map((v,i)=>({patient:v[0],doctor:v[1],diagnosis:v[2],reason:v[3],current:v[4],history:v[5],anamnesis:v[6],systems:v[7],exam:v[8],analysis:v[9],plan:v[10],date:`2026-${String(Math.floor(i/8)+1).padStart(2,'0')}-${String((i%8)*3+2).padStart(2,'0')} 10:00:00`}));

const specialties = ['Medicina general','Medicina interna','Pediatría','Ginecología','Cardiología','Dermatología'];
const allergies = [['Polen','ambiental','Rinitis estacional referida.'],['Maní','alimento','Reacción cutánea referida tras exposición.'],['Fragancias','otra','Irritación cutánea de contacto referida.']];
const antecedents = [
  ['Hipertensión arterial','Antecedente personal en seguimiento clínico.'],['Migraña','Episodios previos referidos por el paciente.'],
  ['Dislipidemia','Antecedente en seguimiento.'],['Apendicectomía','Antecedente quirúrgico referido.'],
  ['Actividad física regular','Hábito de actividad física referido.'],['Hipertensión arterial familiar','Antecedente familiar referido.'],
  ['Tratamiento antihipertensivo habitual','Tratamiento farmacológico referido durante conciliación.'],
];
const medicines = [
  ['Acetaminofén','500 mg','Tableta','DEMO-MED-01'],['Omeprazol','20 mg','Cápsula','DEMO-MED-02'],
  ['Hidrocortisona','1 %','Crema','DEMO-MED-03'],
];
const exams = [
  ['Hemograma completo','Recuento celular y parámetros hematológicos.','DEMO-LAB-01'],
  ['Perfil lipídico','Colesterol total, HDL, LDL y triglicéridos.','DEMO-LAB-02'],
  ['Examen general de orina','Análisis físico-químico y microscópico de orina.','DEMO-LAB-03'],
];

const connection = await pool.getConnection();
const counts = {patients:0,doctors:0,consultations:0};
try {
  const [[identity]] = await connection.query('SELECT DATABASE() AS db, @@hostname AS host');
  if(identity.db !== 'clinica-alejandra' || !['localhost','127.0.0.1','::1'].includes(identity.host)) {
    // @@hostname is the machine name on many MySQL installs; the explicit DB_HOST guard above is authoritative.
    if(identity.db !== 'clinica-alejandra') throw new Error('La conexión no apunta a la base autorizada.');
  }
  const [[registryTable]] = await connection.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='demo_seed_registry'");
  if(!registryTable.n) throw new Error('Falta la migración 005; ejecuta npm run db:migrate antes de cargar los datos.');
  await connection.beginTransaction();
  const reg = async(key,entity,id) => {
    const [[r]] = await connection.execute('SELECT record_id FROM demo_seed_registry WHERE seed_key=? FOR UPDATE',[key]);
    if(r && String(r.record_id)!==String(id)) throw new Error(`La clave de carga ${key} ya apunta a otro registro.`);
    if(!r) await connection.execute('INSERT INTO demo_seed_registry(seed_key,entity,record_id) VALUES (?,?,?)',[key,entity,id]);
  };
  const getId = async(sql,args) => { const [[r]] = await connection.execute(sql,args); return r?.id ?? null; };
  const [[adminRole]] = await connection.execute("SELECT id_rol FROM roles WHERE nombre='Administrador'");
  const [[doctorRole]] = await connection.execute("SELECT id_rol FROM roles WHERE nombre='Médico'");
  if(!adminRole || !doctorRole) throw new Error('Faltan roles requeridos; ejecuta npm run db:roles.');
  let adminId = await getId("SELECT id_usuario AS id FROM usuarios WHERE email='admin.demo@example.test'",[]);
  if(adminId===null) {
    const [r]=await connection.execute('INSERT INTO usuarios(nombres,apellidos,email,password_hash,estado) VALUES (?,?,?,?,?)',['Administración','Clínica','admin.demo@example.test',await bcrypt.hash(randomBytes(24).toString('base64url'),12),'activo']); adminId=r.insertId;
    await connection.execute('INSERT INTO usuario_rol(id_usuario,id_rol) VALUES (?,?)',[adminId,adminRole.id_rol]);
  }

  for(const name of specialties) {
    const [[r]] = await connection.execute('SELECT id_especialidad FROM especialidades WHERE nombre=?',[name]);
    if(!r) await connection.execute('INSERT INTO especialidades(nombre,descripcion) VALUES (?,?)',[name,`Atención profesional en ${name.toLowerCase()}.`]);
  }
  const doctorIds=[];
  for(let i=0;i<doctors.length;i++) {
    const d=doctors[i],email=`${d.nombres.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}.${d.apellidos.toLowerCase()}@example.com`;
    // Adopt and normalize only accounts created by the earlier demo loader.
    let [[u]]=await connection.execute('SELECT id_usuario FROM usuarios WHERE email=?',[email]);
    if(!u && i<3) {
      const oldEmails=['laura.pineda@demo.invalid','mateo.salas@demo.invalid','ines.cardenas@demo.invalid'];
      [[u]]=await connection.execute('SELECT id_usuario FROM usuarios WHERE email=?',[oldEmails[i]]);
      if(u) await connection.execute('UPDATE usuarios SET nombres=?,apellidos=?,email=? WHERE id_usuario=?',[d.nombres,d.apellidos,email,u.id_usuario]);
    }
    if(!u) {
      const [r]=await connection.execute('INSERT INTO usuarios(nombres,apellidos,email,password_hash,estado) VALUES (?,?,?,?,?)',[d.nombres,d.apellidos,email,await bcrypt.hash(randomBytes(32).toString('base64url'),12),'activo']); u={id_usuario:r.insertId};
    }
    await connection.execute('INSERT IGNORE INTO usuario_rol(id_usuario,id_rol) VALUES (?,?)',[u.id_usuario,doctorRole.id_rol]);
    let [[m]]=await connection.execute('SELECT id_medico FROM medicos WHERE id_usuario=?',[u.id_usuario]);
    if(!m) {
      const [r]=await connection.execute('INSERT INTO medicos(id_usuario,numero_registro_profesional,activo) VALUES (?,?,1)',[u.id_usuario,d.reg]); m={id_medico:r.insertId}; counts.doctors++;
    } else if(i<3) await connection.execute('UPDATE medicos SET numero_registro_profesional=?,activo=1 WHERE id_medico=?',[d.reg,m.id_medico]);
    await reg(`doctor-${i+1}`,'medicos',m.id_medico); doctorIds.push(m.id_medico);
    const [[s]]=await connection.execute('SELECT id_especialidad FROM especialidades WHERE nombre=?',[d.specialty]);
    await connection.execute('INSERT IGNORE INTO medico_especialidad(id_medico,id_especialidad) VALUES (?,?)',[m.id_medico,s.id_especialidad]);
  }

  const patientIds=[]; const historyIds=[];
  for(let i=0;i<patients.length;i++) {
    const p=patients[i],email=`${p.nombres.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}.${p.apellidos.toLowerCase()}@example.com`;
    let [[r]]=await connection.execute('SELECT id_paciente FROM pacientes WHERE tipo_documento=? AND numero_documento=?',['DEMO',p.doc]);
    if(!r) { const [x]=await connection.execute(`INSERT INTO pacientes(id_usuario,tipo_documento,numero_documento,nombres,apellidos,fecha_nacimiento,sexo_registrado,telefono,email,direccion,grupo_sanguineo)
      VALUES (NULL,'DEMO',?,?,?,?,?,'0000000000',?,'Sector residencial, Medellín',?)`,[p.doc,p.nombres,p.apellidos,p.birth,p.sex,email,p.blood]); r={id_paciente:x.insertId}; counts.patients++; }
    else await connection.execute('UPDATE pacientes SET nombres=?,apellidos=?,fecha_nacimiento=?,sexo_registrado=?,telefono=?,email=?,direccion=?,grupo_sanguineo=? WHERE id_paciente=?',[p.nombres,p.apellidos,p.birth,p.sex,'0000000000',email,'Sector residencial, Medellín',p.blood,r.id_paciente]);
    await reg(`patient-${i+1}`,'pacientes',r.id_paciente); patientIds.push(r.id_paciente);
    let [[h]]=await connection.execute('SELECT id_historia FROM historias_clinicas WHERE id_paciente=?',[r.id_paciente]);
    if(!h) { const [x]=await connection.execute('INSERT INTO historias_clinicas(id_paciente,numero_historia,fecha_apertura,estado) VALUES (?,?,?,?)',[r.id_paciente,`DEMO-HC-${String(i+1).padStart(4,'0')}`,`${p.birth} 09:00:00`,'activa']); h={id_historia:x.insertId}; }
    await reg(`history-${i+1}`,'historias_clinicas',h.id_historia); historyIds.push(h.id_historia);
  }

  const diagnosisIds=[];
  for(const [code,name,description] of diagnoses) {
    let [[r]]=await connection.execute('SELECT id_diagnostico FROM diagnosticos WHERE codigo_cie10=?',[code]);
    // Convert only the three exact codes used by the previous demo seed.
    if(!r) {
      const old={Z108:'DEMO-Z00.0',J069:'DEMO-J06.9',L309:'DEMO-L30.9'}[code];
      if(old) [[r]]=await connection.execute('SELECT id_diagnostico FROM diagnosticos WHERE codigo_cie10=?',[old]);
      if(r) await connection.execute('UPDATE diagnosticos SET codigo_cie10=?,nombre=?,descripcion=? WHERE id_diagnostico=?',[code,name,description,r.id_diagnostico]);
      else { const [x]=await connection.execute('INSERT INTO diagnosticos(codigo_cie10,nombre,descripcion) VALUES (?,?,?)',[code,name,description]); r={id_diagnostico:x.insertId}; }
    }
    diagnosisIds.push(r.id_diagnostico);
  }
  const insertCatalog = async(table,idCol,fields,row,legacyCodes=[])=>{
    const [first,...rest]=fields; const code=row[0];
    let [[r]]=await connection.execute(`SELECT \`${idCol}\` FROM \`${table}\` WHERE \`${first}\`=?`,[code]);
    if(!r && legacyCodes.length) for(const old of legacyCodes) { [[r]]=await connection.execute(`SELECT \`${idCol}\` FROM \`${table}\` WHERE \`${first}\`=?`,[old]); if(r) break; }
    if(r) { const assignments=rest.map(f=>`\`${f}\`=?`).join(','); await connection.execute(`UPDATE \`${table}\` SET ${assignments} WHERE \`${idCol}\`=?`,[...row.slice(1),r[idCol]]); }
    else { const [x]=await connection.execute(`INSERT INTO \`${table}\` (${fields.map(f=>`\`${f}\``).join(',')}) VALUES (${fields.map(()=>'?').join(',')})`,row); r={[idCol]:x.insertId}; }
    return r[idCol];
  };
  const medIds=[];
  for(let i=0;i<medicines.length;i++) { const m=medicines[i]; medIds.push(await insertCatalog('medicamentos','id_medicamento',['codigo_catalogo','nombre','concentracion','forma_farmaceutica'],[m[3],m[0],m[1],m[2]],[`DEMO-MED-0${i+1}`])); }
  const examIds=[];
  for(let i=0;i<exams.length;i++) { const e=exams[i]; examIds.push(await insertCatalog('examenes','id_examen',['codigo_catalogo','nombre','descripcion'],[e[2],e[0],e[1]],[i===2?'DEMO-IMG-01':`DEMO-LAB-0${i+1}`])); }
  const allergyIds=[];
  for(const a of allergies) { const [[old]]=await connection.execute('SELECT id_alergia FROM alergias WHERE nombre=?',[a[0]]); if(old) { allergyIds.push(old.id_alergia); continue; }
    const legacy={'Polen':'Polen ficticio','Maní':'Fruto seco ficticio'}[a[0]]; let [[r]]=legacy?await connection.execute('SELECT id_alergia FROM alergias WHERE nombre=?',[legacy]):[[]];
    if(r) { await connection.execute('UPDATE alergias SET nombre=?,tipo=?,descripcion=? WHERE id_alergia=?',[...a,r.id_alergia]); allergyIds.push(r.id_alergia); }
    else { const [x]=await connection.execute('INSERT INTO alergias(nombre,tipo,descripcion) VALUES (?,?,?)',a); allergyIds.push(x.insertId); }
  }
  const antecedentIds=[];
  for(const a of antecedents) { let [[r]]=await connection.execute('SELECT id_antecedente FROM antecedentes WHERE nombre=?',[a[0]]);
    if(!r && a[0]==='Hipertensión arterial') [[r]]=await connection.execute("SELECT id_antecedente FROM antecedentes WHERE nombre='Antecedente ficticio de hipertensión'");
    if(!r && a[0]==='Migraña') [[r]]=await connection.execute("SELECT id_antecedente FROM antecedentes WHERE nombre='Antecedente ficticio de migraña'");
    if(r) {
      if(['Antecedente ficticio de hipertensión','Antecedente ficticio de migraña'].includes((await connection.execute('SELECT nombre FROM antecedentes WHERE id_antecedente=?',[r.id_antecedente]))[0][0]?.nombre)) await connection.execute('UPDATE antecedentes SET nombre=?,descripcion=? WHERE id_antecedente=?',[...a,r.id_antecedente]);
      antecedentIds.push(r.id_antecedente);
    }
    else { const [x]=await connection.execute('INSERT INTO antecedentes(nombre,descripcion) VALUES (?,?)',a); antecedentIds.push(x.insertId); }
  }

  const oldConsultations=[];
  for(let i=1;i<=6;i++) {
    const [[marked]]=await connection.execute('SELECT id_consulta FROM consultas WHERE observaciones=?',[`DEMO_SEED:consulta:${i}`]);
    const [[registered]]=await connection.execute('SELECT record_id AS id_consulta FROM demo_seed_registry WHERE seed_key=?',[`consultation-${String(i).padStart(2,'0')}`]);
    if(marked||registered) oldConsultations[i-1]=(marked||registered).id_consulta;
  }
  for(let i=0;i<visitPlans.length;i++) {
    const v=visitPlans[i],key=`consultation-${String(i+1).padStart(2,'0')}`;
    let id=await getId('SELECT record_id AS id FROM demo_seed_registry WHERE seed_key=?',[key]);
    if(id===null && i<6 && oldConsultations[i]) id=oldConsultations[i];
    const state='finalizada';
    const values=[historyIds[v.patient],doctorIds[v.doctor],v.date,'control',v.reason,v.current,v.anamnesis,v.systems,v.exam,v.analysis,v.plan,'Atención registrada para seguimiento clínico.',state,`${v.date.slice(0,10)} 10:40:00`];
    if(id===null) { const [r]=await connection.execute(`INSERT INTO consultas(id_historia,id_medico,fecha_hora,tipo_consulta,motivo_consulta,enfermedad_actual,anamnesis,revision_sistemas,examen_fisico,analisis_clinico,plan_manejo,observaciones,estado,finalizada_en) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,values); id=r.insertId; counts.consultations++; }
    else await connection.execute(`UPDATE consultas SET id_historia=?,id_medico=?,fecha_hora=?,tipo_consulta=?,motivo_consulta=?,enfermedad_actual=?,anamnesis=?,revision_sistemas=?,examen_fisico=?,analisis_clinico=?,plan_manejo=?,observaciones=?,estado=?,finalizada_en=? WHERE id_consulta=?`,[...values,id]);
    await reg(key,'consultas',id);
    await connection.execute('INSERT IGNORE INTO historia_medico(id_historia,id_medico,asignado_por,estado) VALUES (?,?,?,?)',[historyIds[v.patient],doctorIds[v.doctor],adminId,'activa']);
    if(i<6 && oldConsultations[i]) await connection.execute('DELETE FROM consulta_diagnostico WHERE id_consulta=? AND id_diagnostico IN (?,?,?) AND id_diagnostico<>?',[id,...diagnosisIds.slice(0,3),diagnosisIds[v.diagnosis]]);
    await connection.execute('INSERT IGNORE INTO consulta_diagnostico(id_consulta,id_diagnostico,tipo,observaciones) VALUES (?,?,?,?)',[id,diagnosisIds[v.diagnosis],'principal','Diagnóstico consignado para seguimiento; requiere interpretación profesional.']);
    const [[vital]]=await connection.execute('SELECT id_signos FROM signos_vitales WHERE id_consulta=? LIMIT 1',[id]);
    if(!vital) { const adult=v.patient!==4&&v.patient!==9; const bp=v.patient===3||v.patient===11; await connection.execute(`INSERT INTO signos_vitales(id_consulta,medido_en,presion_sistolica,presion_diastolica,frecuencia_cardiaca,frecuencia_respiratoria,temperatura_c,peso_kg,talla_cm,saturacion_oxigeno_pct) VALUES (?,?,?,?,?,?,?,?,?,?)`,[id,v.date,bp?146:116+i%9,bp?92:72+i%7,68+i%15,15+i%5,36.3+(i%5)*0.1,adult?55+(i%6)*7:46,adult?150+(i%6)*5:154,97+i%3]); }
    const [[allergyLink]]=await connection.execute('SELECT id_paciente_alergia FROM paciente_alergia WHERE id_paciente=? LIMIT 1',[patientIds[v.patient]]);
    if(!allergyLink && [0,2,12].includes(v.patient)) await connection.execute('INSERT INTO paciente_alergia(id_paciente,id_alergia,reaccion,severidad) VALUES (?,?,?,?)',[patientIds[v.patient],allergyIds[v.patient===0?0:2],v.patient===0?'Estornudos y rinorrea estacionales':'Prurito y enrojecimiento localizado','leve']);
    if([3,8,11].includes(v.patient)) { const ant=antecedentIds[v.patient===8?5:0]; const [[link]]=await connection.execute('SELECT id_paciente_antecedente FROM paciente_antecedente WHERE id_paciente=? AND id_antecedente=?',[patientIds[v.patient],ant]); if(!link) await connection.execute('INSERT INTO paciente_antecedente(id_paciente,id_antecedente,tipo,detalle) VALUES (?,?,?,?)',[patientIds[v.patient],ant,v.patient===8?'familiar':'personal',v.patient===8?'Madre con antecedente de hipertensión.':'En seguimiento clínico referido por el paciente.']); }
    const additional = v.patient===5 ? [3,'quirurgico','Apendicectomía previa, sin complicaciones referidas.'] : v.patient===6 ? [4,'habito','Realiza caminatas varias veces por semana, según refiere.'] : v.patient===11 ? [6,'farmacologico','Tratamiento habitual referido; requiere conciliación en cada control.'] : null;
    if(additional) { const [[link]]=await connection.execute('SELECT id_paciente_antecedente FROM paciente_antecedente WHERE id_paciente=? AND id_antecedente=?',[patientIds[v.patient],antecedentIds[additional[0]]]); if(!link) await connection.execute('INSERT INTO paciente_antecedente(id_paciente,id_antecedente,tipo,detalle) VALUES (?,?,?,?)',[patientIds[v.patient],antecedentIds[additional[0]],additional[1],additional[2]]); }
    if(v.patient===13) { const [[link]]=await connection.execute('SELECT id_paciente_alergia FROM paciente_alergia WHERE id_paciente=? AND id_alergia=?',[patientIds[v.patient],allergyIds[1]]); if(!link) await connection.execute('INSERT INTO paciente_alergia(id_paciente,id_alergia,reaccion,severidad) VALUES (?,?,?,?)',[patientIds[v.patient],allergyIds[1],'Urticaria localizada referida tras exposición.','leve']); }
    if(i===1 && oldConsultations[i]) await connection.execute('UPDATE receta_detalle d JOIN recetas r ON r.id_receta=d.id_receta SET d.id_medicamento=?,d.dosis=\'500 mg\',d.via_administracion=\'Oral\',d.frecuencia=\'Cada 6 horas si es necesario\',d.duracion=\'Hasta 3 días\',d.cantidad=\'12 tabletas\',d.indicaciones=\'No exceder 3 g en 24 horas; validar con un profesional.\' WHERE r.id_consulta=?',[medIds[0],id]);
    if(i===1||i===7||i===12) {
      let [[recipe]]=await connection.execute('SELECT id_receta FROM recetas WHERE id_consulta=?',[id]); if(!recipe) { const [x]=await connection.execute('INSERT INTO recetas(id_consulta,fecha_emision,indicaciones_generales) VALUES (?,?,?)',[id,v.date,'Registro de demostración; cualquier tratamiento requiere valoración y validación profesional.']); recipe={id_receta:x.insertId}; }
      const medIndex=i===1?0:i===7?1:2, [[line]]=await connection.execute('SELECT id_receta_detalle FROM receta_detalle WHERE id_receta=? AND id_medicamento=?',[recipe.id_receta,medIds[medIndex]]);
      if(!line) { const details=medIndex===0?['500 mg','Oral','Cada 6 horas si es necesario','Hasta 3 días','12 tabletas','No exceder 3 g en 24 horas; evitar duplicar productos que contengan acetaminofén.']:medIndex===1?['20 mg','Oral','Una vez al día según valoración','14 días','14 cápsulas','Registro orientativo sujeto a validación profesional.']:['Aplicación tópica','Cutánea','Capa fina según valoración','Hasta 5 días','1 tubo','Evitar uso extenso o en piel lesionada; validar indicación profesional.']; await connection.execute('INSERT INTO receta_detalle(id_receta,id_medicamento,dosis,via_administracion,frecuencia,duracion,cantidad,indicaciones) VALUES (?,?,?,?,?,?,?,?)',[recipe.id_receta,medIds[medIndex],...details]); }
    }
    if([3,8,11,22].includes(i)) {
      let [[order]]=await connection.execute('SELECT id_orden FROM ordenes_examen WHERE id_consulta=?',[id]); if(!order) { const [x]=await connection.execute('INSERT INTO ordenes_examen(id_consulta,fecha_emision,observaciones) VALUES (?,?,?)',[id,v.date,'Orden de demostración para revisión clínica.']); order={id_orden:x.insertId}; }
      const examIndex=i===8||i===22?1:i===11?2:0,[[line]]=await connection.execute('SELECT id_orden_detalle FROM orden_examen_detalle WHERE id_orden=? AND id_examen=?',[order.id_orden,examIds[examIndex]]);
      if(!line) await connection.execute('INSERT INTO orden_examen_detalle(id_orden,id_examen,estado,resultado_resumen,fecha_resultado) VALUES (?,?,?,?,?)',[order.id_orden,examIds[examIndex],i===8||i===22?'informado':i===11?'en_proceso':'solicitado',i===8||i===22?'Resultado dentro de parámetros de referencia en los componentes evaluados; interpretación a cargo del profesional tratante.':null,i===8||i===22?`${v.date.slice(0,10)} 12:00:00`:null]);
    }
  }
  // The prior loader attached a topical cream to the adolescent's sore-throat visit; correct that exact registered demo prescription.
  const [[adolescentVisit]]=await connection.execute("SELECT record_id FROM demo_seed_registry WHERE seed_key='consultation-20' AND entity='consultas'");
  if(adolescentVisit) await connection.execute(`UPDATE receta_detalle d JOIN recetas r ON r.id_receta=d.id_receta
    SET d.id_medicamento=?,d.dosis='500 mg',d.via_administracion='Oral',d.frecuencia='Cada 6 horas si es necesario',d.duracion='Hasta 3 días',d.cantidad='12 tabletas',d.indicaciones='No exceder 3 g en 24 horas; validar con un profesional.'
    WHERE r.id_consulta=?`,[medIds[0],adolescentVisit.record_id]);
  // Adopt and clean only the legacy seed's marked clinical narrative values.
  await connection.execute("UPDATE recetas SET indicaciones_generales='Registro de demostración; cualquier tratamiento requiere valoración y validación profesional.' WHERE indicaciones_generales='DEMO: receta ficticia'");
  await connection.execute("UPDATE ordenes_examen SET observaciones='Orden de demostración para revisión clínica.' WHERE observaciones='DEMO: orden ficticia'");
  await connection.execute("UPDATE paciente_alergia SET reaccion='Reacción leve referida por el paciente.' WHERE reaccion LIKE '%ficticia%'");
  await connection.execute("UPDATE paciente_antecedente SET detalle='Antecedente referido durante la entrevista clínica.' WHERE detalle LIKE '%ficticio%'");
  await connection.execute("UPDATE consulta_diagnostico SET observaciones='Diagnóstico consignado para seguimiento clínico.' WHERE observaciones LIKE '%ficticia%'");
  await connection.execute("UPDATE orden_examen_detalle SET resultado_resumen='Resultado disponible para interpretación profesional.' WHERE resultado_resumen LIKE '%ficticio%'");
  await connection.commit();
  const [[summary]]=await connection.query(`SELECT
    (SELECT COUNT(*) FROM demo_seed_registry WHERE entity='pacientes') patients,
    (SELECT COUNT(*) FROM demo_seed_registry WHERE entity='medicos') doctors,
    (SELECT COUNT(*) FROM demo_seed_registry WHERE entity='consultas') consultations`);
  console.log(JSON.stringify({ok:true,database:identity.db,summary,insertedThisRun:counts,notice:'Los registros son sintéticos y requieren validación profesional antes de cualquier uso clínico.'}));
} catch(error) {
  await connection.rollback();
  console.error('Carga cancelada; se revirtió la transacción:',error.message);
  process.exitCode=1;
} finally { connection.release(); await pool.end(); }
