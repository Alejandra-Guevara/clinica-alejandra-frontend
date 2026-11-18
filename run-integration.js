import { spawnSync } from 'node:child_process';

const database=process.env.DB_NAME||'';
if(process.env.INTEGRATION_TESTS!=='1'||!/_test$/.test(database)){
  console.error('Seguridad: defina INTEGRATION_TESTS=1 y DB_NAME apuntando a una base aislada terminada en _test.');
  process.exit(2);
}
const result=spawnSync(process.execPath,['--test','tests/integration.test.js'],{stdio:'inherit',env:process.env});
process.exit(result.status??1);
