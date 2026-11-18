import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as migration from '../migrations/004_remove_password_recovery.js';

test('la migracion de retiro solo elimina la tabla de tokens de recuperacion', async () => {
  const statements = [];
  await migration.up({ query: async (sql) => statements.push(sql) });
  assert.deepEqual(statements, ['DROP TABLE IF EXISTS password_reset_tokens']);
});
