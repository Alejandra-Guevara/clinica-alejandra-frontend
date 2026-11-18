export const id = '004_remove_password_recovery';

export async function up(connection) {
  // Reset links are temporary credentials. This removes only their storage table.
  await connection.query('DROP TABLE IF EXISTS password_reset_tokens');
}
