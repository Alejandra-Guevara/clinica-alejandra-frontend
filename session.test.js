import test from 'node:test';
import assert from 'node:assert/strict';
import { issueSession, readSession } from '../src/utils/session.js';

test('firma y valida una sesión de duración limitada',()=>{
 process.env.SESSION_SECRET='test-secret-that-is-long-enough-for-unit-tests';
 const token=issueSession(42);
 assert.equal(readSession(token).sub,'42');
 const versioned=issueSession(42,3);
 assert.equal(readSession(versioned).sv,3);
 assert.equal(readSession(`${token}x`),null);
 assert.equal(readSession(''),null);
});
