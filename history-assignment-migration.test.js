import test from 'node:test';
import assert from 'node:assert/strict';
import { id, up } from '../migrations/002_historia_medico_assignments.js';

test('la migración de asignaciones es aditiva y conserva vínculos existentes',async()=>{
  const statements=[];
  await up({query:async(sql)=>{statements.push(sql);return [[],[]];}});
  assert.equal(id,'002_historia_medico_assignments');
  assert.match(statements[0],/CREATE TABLE IF NOT EXISTS historia_medico/);
  assert.match(statements[0],/UNIQUE KEY uq_historia_medico/);
  assert.match(statements[1],/INSERT IGNORE INTO historia_medico/);
  assert.match(statements[1],/SELECT DISTINCT c\.id_historia,c\.id_medico,m\.id_usuario/);
});
