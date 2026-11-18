import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

test('liveness remains healthy without requiring a database query',async()=>{
 const server=app.listen(0,'127.0.0.1');
 await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 try{
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/live`);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{data:{status:'ok'}});
 }finally{
  await new Promise((resolve,reject)=>server.close((error)=>error?reject(error):resolve()));
 }
});
