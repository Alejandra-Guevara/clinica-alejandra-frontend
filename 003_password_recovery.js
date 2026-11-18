export const id='003_password_recovery';

export async function up(connection){
  const [columns]=await connection.execute(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='usuarios' AND COLUMN_NAME='session_version'`);
  if(!columns.length)await connection.query('ALTER TABLE usuarios ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 0');
  await connection.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_hash CHAR(64) PRIMARY KEY,
    id_usuario BIGINT UNSIGNED NOT NULL,
    expira_en DATETIME NOT NULL,
    consumido_en DATETIME NULL,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_reset_user_expiry (id_usuario,expira_en),
    CONSTRAINT fk_reset_user FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
}
