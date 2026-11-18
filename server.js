import 'dotenv/config';
import app from './app.js';
import { pool } from './config/db.js';
import { runtimeConfig, validateRuntimeConfig } from './config/runtime.js';

const port=runtimeConfig.port;
validateRuntimeConfig(runtimeConfig);
const server=app.listen(port,'0.0.0.0',()=>console.log(JSON.stringify({level:'info',message:'API listening',mode:'university-demo-integrated',port,time:new Date().toISOString()})));
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(async()=>{await pool.end();process.exit(0);}));
