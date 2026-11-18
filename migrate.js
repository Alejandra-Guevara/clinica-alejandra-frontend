import 'dotenv/config';
import { pool } from '../src/config/db.js';
import * as clinicalAmendments from '../migrations/001_clinical_amendments.js';
import * as historyAssignments from '../migrations/002_historia_medico_assignments.js';
import * as passwordRecovery from '../migrations/003_password_recovery.js';
import * as removePasswordRecovery from '../migrations/004_remove_password_recovery.js';
import * as demoSeedRegistry from '../migrations/005_demo_seed_registry.js';

const migrations=[clinicalAmendments,historyAssignments,passwordRecovery,removePasswordRecovery,demoSeedRegistry];
const connection=await pool.getConnection();
try{
  await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id VARCHAR(120) PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  for(const migration of migrations){
    const [rows]=await connection.execute('SELECT id FROM schema_migrations WHERE id=?',[migration.id]);
    if(rows.length)continue;
    console.log(JSON.stringify({level:'info',message:'Applying migration',id:migration.id}));
    await migration.up(connection);
    await connection.execute('INSERT INTO schema_migrations(id) VALUES (?)',[migration.id]);
  }
  console.log('Migraciones verificadas');
}finally{connection.release();await pool.end();}
