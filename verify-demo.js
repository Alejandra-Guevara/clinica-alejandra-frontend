import 'dotenv/config';
import { pool } from '../src/config/db.js';

try {
  const [[summary]] = await pool.query(`SELECT
    (SELECT COUNT(*) FROM demo_seed_registry WHERE entity='pacientes') patients,
    (SELECT COUNT(*) FROM demo_seed_registry WHERE entity='medicos') doctors,
    (SELECT COUNT(*) FROM demo_seed_registry WHERE entity='consultas') consultations,
    (SELECT COUNT(*) FROM demo_seed_registry p JOIN historias_clinicas h ON h.id_historia=p.record_id WHERE p.entity='historias_clinicas') histories,
    (SELECT COUNT(*) FROM consulta_diagnostico d JOIN demo_seed_registry r ON r.entity='consultas' AND r.record_id=d.id_consulta) diagnoses,
    (SELECT COUNT(*) FROM signos_vitales s JOIN demo_seed_registry r ON r.entity='consultas' AND r.record_id=s.id_consulta) vital_records,
    (SELECT COUNT(*) FROM recetas x JOIN demo_seed_registry r ON r.entity='consultas' AND r.record_id=x.id_consulta) prescriptions,
    (SELECT COUNT(*) FROM ordenes_examen x JOIN demo_seed_registry r ON r.entity='consultas' AND r.record_id=x.id_consulta) exam_orders`);
  const checks = {};
  const queries = {
    patients_without_history: `SELECT COUNT(*) n FROM demo_seed_registry p LEFT JOIN historias_clinicas h ON h.id_paciente=p.record_id WHERE p.entity='pacientes' AND h.id_historia IS NULL`,
    consultations_without_patient_or_doctor: `SELECT COUNT(*) n FROM demo_seed_registry r LEFT JOIN consultas c ON c.id_consulta=r.record_id LEFT JOIN historias_clinicas h ON h.id_historia=c.id_historia LEFT JOIN medicos m ON m.id_medico=c.id_medico WHERE r.entity='consultas' AND (c.id_consulta IS NULL OR h.id_historia IS NULL OR m.id_medico IS NULL)`,
    consultations_without_diagnosis: `SELECT COUNT(*) n FROM demo_seed_registry r LEFT JOIN consulta_diagnostico d ON d.id_consulta=r.record_id WHERE r.entity='consultas' AND d.id_consulta IS NULL`,
    consultations_without_vitals: `SELECT COUNT(*) n FROM demo_seed_registry r LEFT JOIN signos_vitales s ON s.id_consulta=r.record_id WHERE r.entity='consultas' AND s.id_signos IS NULL`,
    medicines_without_prescription: `SELECT COUNT(*) n FROM medicamentos m JOIN demo_seed_registry r ON r.entity='consultas' LEFT JOIN recetas x ON x.id_consulta=r.record_id LEFT JOIN receta_detalle d ON d.id_receta=x.id_receta AND d.id_medicamento=m.id_medicamento WHERE m.codigo_catalogo LIKE 'DEMO-MED-%' GROUP BY m.id_medicamento HAVING COUNT(d.id_receta_detalle)=0`,
    exams_without_order: `SELECT COUNT(*) n FROM examenes e LEFT JOIN orden_examen_detalle d ON d.id_examen=e.id_examen WHERE e.codigo_catalogo LIKE 'DEMO-LAB-%' AND d.id_orden_detalle IS NULL`,
    inconsistent_exam_results: `SELECT COUNT(*) n FROM orden_examen_detalle WHERE (estado IN ('solicitado','en_proceso') AND (resultado_resumen IS NOT NULL OR fecha_resultado IS NOT NULL)) OR (estado='informado' AND (resultado_resumen IS NULL OR fecha_resultado IS NULL))`,
    legacy_visible_labels: `SELECT COUNT(*) n FROM (SELECT nombre texto FROM alergias UNION ALL SELECT nombre FROM antecedentes UNION ALL SELECT nombre FROM diagnosticos UNION ALL SELECT motivo_consulta FROM consultas WHERE id_consulta IN (SELECT record_id FROM demo_seed_registry WHERE entity='consultas') UNION ALL SELECT observaciones FROM consultas WHERE id_consulta IN (SELECT record_id FROM demo_seed_registry WHERE entity='consultas')) t WHERE LOWER(texto) REGEXP 'fictici|ejemplo|prueba|demo|muestra|lorem|pendiente'`,
    duplicate_registry_records: `SELECT COUNT(*) n FROM (SELECT entity,record_id FROM demo_seed_registry GROUP BY entity,record_id HAVING COUNT(*)>1) t`,
  };
  for (const [name, sql] of Object.entries(queries)) {
    const [rows] = await pool.query(sql);
    checks[name] = rows[0]?.n ?? rows.length;
  }
  const expected = {patients:15,doctors:6,consultations:24,histories:15};
  const errors = [];
  for (const [key,value] of Object.entries(expected)) if (Number(summary[key]) !== value) errors.push(`${key}: expected ${value}, received ${summary[key]}`);
  for (const [key,value] of Object.entries(checks)) if (Number(value) !== 0) errors.push(`${key}: ${value}`);
  console.log(JSON.stringify({ok:errors.length===0,summary,checks,errors}));
  if (errors.length) process.exitCode=1;
} catch (error) {
  console.error('Verificación fallida:',error.message);
  process.exitCode=1;
} finally { await pool.end(); }
