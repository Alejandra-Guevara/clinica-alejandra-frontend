export const id='001_clinical_amendments';

export async function up(connection) {
  const [columns]=await connection.execute(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='consultas' AND COLUMN_NAME IN ('motivo_anulacion','anulada_en')`);
  const present=new Set(columns.map((row)=>row.COLUMN_NAME));
  if(!present.has('motivo_anulacion')) await connection.query('ALTER TABLE consultas ADD COLUMN motivo_anulacion VARCHAR(255) NULL');
  if(!present.has('anulada_en')) await connection.query('ALTER TABLE consultas ADD COLUMN anulada_en DATETIME NULL');
  await connection.query(`CREATE TABLE IF NOT EXISTS consultas_adendas (
    id_adenda BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_consulta BIGINT UNSIGNED NOT NULL,
    id_usuario BIGINT UNSIGNED NOT NULL,
    contenido TEXT NOT NULL,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_adenda_consulta_fecha (id_consulta, creado_en),
    CONSTRAINT fk_adenda_consulta FOREIGN KEY (id_consulta) REFERENCES consultas(id_consulta) ON DELETE RESTRICT,
    CONSTRAINT fk_adenda_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT
  ) ENGINE=InnoDB`);
}
