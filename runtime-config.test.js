import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRuntimeConfig, validateRuntimeConfig } from '../src/config/runtime.js';
import { demoConfig } from '../src/config/demo.js';

test('starts with integrated demo configuration and no manual environment variables',()=>{
  const config=createRuntimeConfig({});
  assert.doesNotThrow(()=>validateRuntimeConfig(config));
  assert.deepEqual(config.database,demoConfig.database);
  assert.equal(config.frontendUrl,demoConfig.frontendUrl);
  assert.ok(config.sessionSecret.length>=32);
});
test('OpenShift supplies only its port and ignores stale environment configuration',()=>{
  const config=createRuntimeConfig({K_SERVICE:'clinic',PORT:'8080',DB_HOST:'wrong-host',DB_SSL:'true',DB_PASSWORD:'wrong-password',SESSION_SECRET:'short',FRONTEND_URL:''});
  assert.doesNotThrow(()=>validateRuntimeConfig(config));
  assert.equal(config.port,8080);
  assert.deepEqual(config.database,demoConfig.database);
  assert.equal(config.secureCookies,true);
  assert.equal(config.trustProxy,2);
});
test('retains isolated local test databases without changing the deployment settings',()=>{
  const config=createRuntimeConfig({DB_HOST:'127.0.0.1',DB_NAME:'clinic_test',DB_USER:'test',DB_PASSWORD:'local-value',DB_SSL:'false'});
  assert.equal(config.database.database,'clinic_test');
  assert.equal(config.database.host,'127.0.0.1');
  assert.equal(config.secureCookies,false);
  assert.throws(()=>validateRuntimeConfig(createRuntimeConfig({PORT:'bad'})),/PORT/);
});
test('generates separate signing keys for separate processes/configurations',()=>{
  assert.notEqual(createRuntimeConfig({}).sessionSecret,createRuntimeConfig({}).sessionSecret);
});
