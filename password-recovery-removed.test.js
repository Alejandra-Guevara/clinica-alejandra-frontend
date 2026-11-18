import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

test('password recovery endpoints are no longer registered', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    const base = 'http://127.0.0.1:' + server.address().port + '/api/auth/password/';
    const forgot = await fetch(base + 'forgot', { method: 'POST' });
    const reset = await fetch(base + 'reset', { method: 'POST' });
    assert.equal(forgot.status, 404);
    assert.equal(reset.status, 404);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
