import test from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler } from '../src/middlewares/errors.js';

test('does not expose internal server error details to clients',()=>{
 const originalConsoleError=console.error;
 let statusCode,body;
 const response={
  status(code){statusCode=code;return this;},
  json(value){body=value;return this;},
 };
 console.error=()=>{};
 try{
  errorHandler(Object.assign(new Error('mysql host=private-db password=secret'),{code:'ECONNREFUSED'}),{path:'/api/login'},response,()=>{});
 }finally{
  console.error=originalConsoleError;
 }
 assert.equal(statusCode,500);
 assert.deepEqual(body,{error:{code:'INTERNAL_ERROR',message:'Error interno del servidor'}});
 assert.doesNotMatch(JSON.stringify(body),/private-db|password|secret/);
});
