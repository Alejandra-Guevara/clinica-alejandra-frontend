export const id='005_demo_seed_registry';

export async function up(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS demo_seed_registry (
    seed_key VARCHAR(120) PRIMARY KEY,
    entity VARCHAR(80) NOT NULL,
    record_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_demo_seed_entity_record (entity,record_id)
  ) ENGINE=InnoDB`);
}
