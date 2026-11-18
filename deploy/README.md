# Demostración universitaria en Red Hat

El backend y el frontend tienen configuración integrada. No necesitas crear variables de entorno, Secrets, ConfigMaps ni argumentos de build. Solo se respetan los datos de puerto y detección de clúster que OpenShift inyecta automáticamente.

Backend: `src/config/demo.js` del repositorio backend contiene host `historia-clinica-db`, puerto 3306, esquema `clinica-alejandra`, el usuario y la contraseña de demostración proporcionados por la propietaria. Esa cuenta debe existir en MySQL y tener permisos sobre el esquema. Incluirla en el código no crea la cuenta en MySQL. El correo y contraseña de login de la aplicación solo sirven para conectar a MySQL si también se ha creado allí esa cuenta. La contraseña del administrador de la aplicación no se modifica.

Las credenciales integradas quedan visibles en el repositorio público por petición expresa para esta demostración. No reutilizar esta configuración con servicios reales. La conexión al MySQL interno de la demostración no exige TLS. La firma de sesiones se genera en memoria sin Secret; al reiniciar el backend hay que iniciar sesión de nuevo. Se mantiene una sola instancia de la API.

Frontend: `src/config/demo.js` define `/api` y el indicador de datos sintéticos. Nginx conecta con el backend por el Service `clinica-alejandra-api:3000`, que envía al puerto 8080 del único servicio Knative existente. Vite incluye un proxy local a localhost:3000, sin archivo .env.

## Aplicar YAML y reconstruir desde GitHub

Importar un repositorio Git solo construye su Dockerfile: Red Hat no aplica automáticamente los YAML de la carpeta deploy. El siguiente script aplica `deploy/redhat-completo.yaml`, limpia las referencias antiguas a Secrets/env del servicio real y reconstruye ambos repositorios:

```bash
curl -fsS https://raw.githubusercontent.com/Alejandra-Guevara/clinica-alejandra-frontend/main/deploy/deploy-redhat.sh -o /tmp/deploy-clinica.sh
bash /tmp/deploy-clinica.sh
```

Ejecuta las dos líneas en la terminal `>_` de OpenShift, con sesión iniciada. El proyecto es `maria-guevara-rio-dev`. El script actualiza el servicio Knative `clinica-alejandra-backend-git` y el Deployment `clinica-alejandra-frontend`; no crea otro backend ni otra base, no importa tablas ni elimina datos. Los Secrets antiguos pueden quedarse almacenados: la aplicación ya no los referencia.

Para el profesor, el YAML a importar/mostrar es `deploy/redhat-completo.yaml`. En recursos existentes usa `oc apply` (como hace el script) o actualiza su YAML; el botón Crear puede responder AlreadyExists. Después de cambios en GitHub vuelve a ejecutar el script para construir y desplegar las imágenes nuevas.

## Página y comprobaciones

URL prevista:

`https://clinica-alejandra-frontend-maria-guevara-rio-dev.apps.rm3.7wse.p1.openshiftapps.com`

- `/health` comprueba Nginx.
- `/api/live` comprueba Express sin depender de MySQL.
- `/api/health` comprueba también la conexión con MySQL.
- La sonda de disponibilidad del backend usa `/api/health`; la sonda de vida usa `/api/live`. Una base inaccesible no provoca reinicios del proceso, pero la aplicación no se marca lista hasta conectar.

Si los logs muestran `ER_ACCESS_DENIED_ERROR`, la cuenta integrada no existe o no tiene permisos; `ER_BAD_DB_ERROR` indica otro nombre de esquema; `ENOTFOUND` indica un nombre de Service incorrecto. Corrige los datos reales en `src/config/demo.js` y reconstruye. No se han validado esas credenciales contra tu clúster desde el equipo de desarrollo.

El YAML completo es la concatenación del manifiesto backend y el manifiesto frontend. No contiene configuración secreta referenciada. Se ha validado sintaxis y compilación local; cuotas, admisión y MySQL se verifican al ejecutarlo en Red Hat.
