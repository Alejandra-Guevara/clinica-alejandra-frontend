# Backend de demostración con configuración integrada

La configuración universitaria está en `src/config/demo.js`: MySQL interno, nombre de esquema, cuenta de demostración y URL del frontend. No se necesitan SESSION_SECRET, DB_SSL, FRONTEND_URL ni credenciales mediante variables de OpenShift. La clave de firma se genera en memoria; tras un reinicio hay que iniciar sesión nuevamente. El puerto lo suministra OpenShift automáticamente.

El usuario y la contraseña proporcionados se incorporaron por petición expresa. Son visibles en GitHub y solo corresponden a una demostración. La cuenta debe existir también en MySQL: el login del administrador de la aplicación y el usuario de MySQL son cuentas independientes. No se crea ni cambia ninguna cuenta automáticamente.

El manifiesto reutiliza `clinica-alejandra-backend-git` y retira todas las referencias a Secrets y ConfigMaps. Las sondas `/api/live` y `/api/health` distinguen el proceso de la conexión a MySQL; el fallo de la base no reinicia Node. No se modifica el resto de permisos o autenticación.

Para aplicar el YAML y reconstruir ambos repositorios usa el [script e instrucciones del frontend](https://github.com/Alejandra-Guevara/clinica-alejandra-frontend/blob/main/deploy/README.md). El script también limpia las variables antiguas del servicio real. Un push a GitHub no aplica el YAML automáticamente.

Las utilidades locales mantienen sus opciones de conexión .env para no modificar la base local ni las pruebas aisladas. En OpenShift se ignoran esas opciones: se usa exclusivamente el archivo de configuración integrado. El despliegue no importa tablas ni ejecuta la carga de datos local.
