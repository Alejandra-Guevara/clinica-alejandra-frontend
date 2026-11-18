import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { demoConfig } from './demo.js';

// PORT y K_SERVICE los proporciona OpenShift automáticamente. No hay variables
// que el usuario deba crear para ejecutar esta demostración en Red Hat.
export function createRuntimeConfig(platform = {}) {
  const inCluster = Boolean(platform.K_SERVICE || platform.KUBERNETES_SERVICE_HOST);
  const database = {...demoConfig.database};
  // Las herramientas locales de importación y pruebas conservan su conexión
  // opcional existente; nunca toman esos valores al ejecutarse en OpenShift.
  if(!inCluster) {
    for(const [variable,field] of [['DB_HOST','host'],['DB_NAME','database'],['DB_USER','user'],['DB_PASSWORD','password']]) {
      if(platform[variable] !== undefined) database[field]=platform[variable];
    }
    if(platform.DB_PORT) database.port=Number(platform.DB_PORT);
    if(platform.DB_SSL !== undefined) database.ssl=platform.DB_SSL==='true';
    if(platform.DB_SSL_CA) database.caFile=platform.DB_SSL_CA;
  }
  return {
    port: Number(platform.PORT || (inCluster ? 8080 : 3000)),
    frontendUrl: demoConfig.frontendUrl,
    frontendOrigins: inCluster ? [demoConfig.frontendUrl] : [demoConfig.frontendUrl,'http://localhost:5173','http://127.0.0.1:5173'],
    // Una sola instancia; la firma se genera en memoria y no necesita un Secret.
    // Reiniciar/reconstruir el backend requiere iniciar sesión nuevamente.
    sessionSecret: randomBytes(48).toString('base64url'),
    secureCookies: inCluster,
    trustProxy: inCluster ? 2 : 0,
    database,
  };
}

export function validateRuntimeConfig(config) {
  if(!Number.isInteger(config.port)||config.port<1||config.port>65535) throw new Error('PORT debe ser un puerto válido');
}

export const runtimeConfig=createRuntimeConfig(process.env);
