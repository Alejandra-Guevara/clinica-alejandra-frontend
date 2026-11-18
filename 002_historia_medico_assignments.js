export const id='002_historia_medico_assignments';

export async function up(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS historia_medico (
    id_asignacion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_historia BIGINT UNSIGNED NOT NULL,
    id_medico BIGINT UNSIGNED NOT NULL,
    asignado_por BIGINT UNSIGNED NOT NULL,
    asignado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado ENUM('activa','inactiva') NOT NULL DEFAULT 'activa',
    UNIQUE KEY uq_historia_medico (id_historia,id_medico),
    KEY idx_hm_medico_estado (id_medico,estado),
    CONSTRAINT fk_hm_historia FOREIGN KEY (id_historia) REFERENCES historias_clinicas(id_historia) ON DELETE RESTRICT,
    CONSTRAINT fk_hm_medico FOREIGN KEY (id_medico) REFERENCES medicos(id_medico) ON DELETE RESTRICT,
    CONSTRAINT fk_hm_asignador FOREIGN KEY (asignado_por) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT
  ) ENGINE=InnoDB`);
  await connection.query(`INSERT IGNORE INTO historia_medico (id_historia,id_medico,asignado_por)
    SELECT DISTINCT c.id_historia,c.id_medico,m.id_usuario FROM consultas c
    JOIN medicos m ON m.id_medico=c.id_medico`);
}
