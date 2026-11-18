import test from 'node:test';
import assert from 'node:assert/strict';
import { examOrderInputSchema, recipeInputSchema } from '../src/routes/clinical-compositions.js';

test('valida recetas con al menos un medicamento y dosis',()=>{
  const input={id_consulta:'12',indicaciones_generales:'Con alimentos',detalles:[{id_medicamento:'3',dosis:'1 tableta',frecuencia:'cada 8 horas'}]};
  assert.equal(recipeInputSchema.parse(input).id_consulta,12);
  assert.throws(()=>recipeInputSchema.parse({...input,detalles:[]}));
  assert.throws(()=>recipeInputSchema.parse({...input,detalles:[{id_medicamento:3,dosis:'  '}]}));
  assert.throws(()=>recipeInputSchema.parse({...input,extra:'no permitido'}));
});

test('valida órdenes con al menos un examen y rechaza identificadores inválidos',()=>{
  const input={id_consulta:12,observaciones:'Control',examenes:[{id_examen:'9'},{id_examen:10}]};
  assert.deepEqual(examOrderInputSchema.parse(input).examenes.map((item)=>item.id_examen),[9,10]);
  assert.throws(()=>examOrderInputSchema.parse({...input,examenes:[]}));
  assert.throws(()=>examOrderInputSchema.parse({...input,examenes:[{id_examen:0}]}));
});
