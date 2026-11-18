# Clínica Alejandra · API

API REST Express/MySQL for the supplied schema. `DB_NAME` defaults to the existing XAMPP database `clinica-alejandra`; the original SQL creates `historias_clinicas` for a fresh import. The project never creates, renames or modifies tables automatically.

## Desarrollo local

1. Install Node.js 22 and run `npm install`.
2. La configuración de demostración está integrada; las utilidades locales pueden usar .env de forma opcional para la base local.
3. Set `DB_NAME` to the database that already exists. For local XAMPP, create a dedicated account restricted to localhost and grant only SELECT, INSERT, UPDATE and DELETE on `clinica-alejandra`.*. The supplied SQL includes `CREATE DATABASE IF NOT EXISTS historias_clinicas`; do not import it over an existing clinical database. Import it only into a deliberately selected empty or disposable schema.
4. Manual y necesario para funciones clinicas nuevas: `npm.cmd run db:migrate` aplica migraciones idempotentes. La 001 agrega anulacion y adendas; la 002 crea asignaciones historia-medico; la 003 incorpora `session_version` para revocar sesiones tras cambiar la clave; la 004 elimina la tabla heredada de tokens de recuperacion. No se eliminan datos clinicos.
5. `npm run db:roles`; configure `ADMIN_INITIAL_PASSWORD` temporalmente en el entorno de forma segura y ejecute `npm run admin:create -- admin@ejemplo.com Nombre Apellido`. En PowerShell puede solicitarla sin mostrarla: `$env:ADMIN_INITIAL_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host -AsSecureString 'Contraseña inicial')).Password`; al terminar, ejecute `Remove-Item Env:ADMIN_INITIAL_PASSWORD`.
6. `npm run dev`. Health check: `GET /api/health`.

### Carga de datos sintéticos de demostración

La aplicación conserva un solo backend Express y una sola base de datos local: `clinica-alejandra`. No se crea una segunda API ni se cambia la contraseña del administrador principal. La carga agrega 15 pacientes, 6 médicos y 24 consultas a MySQL; crea historias, diagnósticos, signos vitales, alergias, antecedentes, recetas y órdenes relacionados. Usa documentos y registros reservados `DEMO-*`, emails `example.com` y teléfonos no operativos. La interfaz muestra un indicador de demostración solo al administrador cuando `VITE_DEMO_MODE=true`.

Primero aplica `npm.cmd run db:migrate` con una cuenta autorizada para migraciones y ejecuta `npm.cmd run db:roles` si hacen falta los roles. Luego, desde PowerShell y únicamente con la base local seleccionada:

```powershell
$env:DEMO_SEED_CONFIRM = 'CONFIRM_DEMO_SEED'
npm.cmd run seed:demo
Remove-Item Env:DEMO_SEED_CONFIRM
npm.cmd run verify:demo
```

El cargador requiere `DB_NAME=clinica-alejandra`, host local, confirmación explícita y `NODE_ENV` distinto de `production`. Inserta o actualiza únicamente registros con identificadores reservados del cargador; aborta ante conflictos de la tabla de seguimiento. La segunda ejecución no duplica filas. Las narrativas y prescripciones son sintéticas; no deben usarse para decisiones ni tratamientos clínicos y requieren validación profesional.

Sesiones firmadas en cookies HttpOnly, CSRF y permisos se conservan. La configuración de la demostración de Red Hat está integrada; consulta el apartado OpenShift. Las opciones .env de conexión solo se conservan para utilidades locales y pruebas aisladas.

## API

- `GET /api/auth/csrf`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` y `PATCH /api/auth/password`.
- `GET /api/dashboard`.
- `GET /api/pacientes/portal/me` vincula una cuenta con su paciente; `GET /api/pacientes/:id/record` también permite al rol Paciente consultar únicamente su propio registro y oculta consultas no finalizadas.
- `GET /api/pacientes/:id/record` entrega la ficha agregada (consultas, diagnósticos, signos vitales, recetas, órdenes, alergias y antecedentes); los médicos solo acceden a historias con asignación activa. Cada apertura queda auditada. `POST /api/pacientes/:id/record/export` registra la acción `exportacion` antes de imprimir y vuelve a validar el acceso. Los eventos detallados solo se muestran a Administradores.
- Consultas: `PATCH /api/consultas/:id/finalizacion` (médico asignado o administrador), `PATCH /api/consultas/:id/anulacion` (solo administrador, motivo requerido) y `GET/POST /api/consultas/:id/adendas` (consultas finalizadas/anuladas; adendas inmutables).
- `POST /api/recetas` crea en transacción la receta y al menos un medicamento; `POST /api/ordenes-examen` crea en transacción la orden y sus exámenes. Ambas acciones requieren consulta en borrador y autorización del médico asignado o rol administrador. No se crean líneas sueltas.
- Recursos: `/api/pacientes`, `/api/medicos`, `/api/especialidades`, `/api/historias-clinicas`, `/api/asignaciones-historia`, `/api/alergias`, `/api/paciente-alergias`, `/api/antecedentes`, `/api/paciente-antecedentes`, `/api/consultas`, `/api/diagnosticos`, `/api/consulta-diagnosticos`, `/api/signos-vitales`, `/api/medicamentos`, `/api/recetas`, `/api/receta-detalles`, `/api/examenes`, `/api/ordenes-examen`, `/api/orden-examen-detalles`.
- Listados aceptan `page`, `limit` (máximo 100), `search` y filtros por campos permitidos. Respuesta `{data,meta}`.
- Usuarios se buscan, listan y paginan con `page`, `limit` y `search` en `/api/usuarios`, y se crean/editan (Administrador); roles tienen GET/POST/PUT/DELETE en `/api/roles` (DELETE protegido por FK).
- Los nombres de los roles base (`Administrador`, `Médico`, `Personal administrativo` y `Paciente`) están protegidos contra renombrado/eliminación para evitar perder el acceso administrativo.
- Auditoría solo Administrador: `GET /api/auditoria-accesos`.

Las recetas y órdenes compuestas usan transacciones y claves foráneas; las líneas de receta se crean junto con su cabecera y no admiten edición o alta independiente. Los detalles de exámenes siguen transiciones permitidas y no admiten alta suelta. La eliminación de registros está deshabilitada en toda la API; los endpoints DELETE responden con HTTP 405. Las historias clínicas se archivan, y la auditoría se conserva. Las consultas finalizadas no admiten edición y pueden recibir adendas inmutables. Anular requiere la migración 001, rol administrador, motivo obligatorio y auditoría. La migración 002 agrega asignación explícita de médicos a historias y conserva vínculos previos mediante una copia derivada de consultas; el acceso inicial se gestiona en `/api/asignaciones-historia`. `npm test` incluye validacion de payloads, migracion, recetas, ordenes, sesiones, liveness HTTP y redaccion de errores internos. La prueba de integración requiere un esquema desechable ya importado y migrado cuyo nombre termine en `_test`; crea registros y usuarios de prueba y no los limpia. Antes de uso clínico real debe revisarse ese modelo y validar identidad profesional.

### Integracion real contra MySQL aislado

La suite integrada comprueba login/cookies, CRUD de pacientes, historias y asignaciones, control por registro, filtros y ordenamiento, relaciones auditadas, diagnosticos en borrador, signos vitales, alergias/antecedentes, recetas y ordenes transaccionales, resultados, finalizacion/anulacion/adendas y portal. La suite crea registros de prueba y no los limpia; use exclusivamente una base desechable cuyo nombre termine en `_test`.

El SQL suministrado comienza con `CREATE DATABASE ... historias_clinicas` y `USE historias_clinicas`. Para preparar `clinica_alejandra_test`, cree primero ese esquema desechable; importe una copia temporal del SQL despues de quitar esas sentencias iniciales. No importe el archivo original sobre la base clinica. Use phpMyAdmin u otro cliente MySQL para seleccionar `clinica_alejandra_test` antes de importar. Prepare un usuario exclusivo de pruebas con permisos solo en ese esquema; no reutilice el usuario de aplicacion ni root para el runtime.

En PowerShell, desde esta carpeta, configure la conexion temporal al esquema de prueba. Se pedira la clave del usuario de prueba sin mostrarla:

```powershell
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '3306'
$env:DB_USER = 'clinica_test'
$secureDbPassword = Read-Host -AsSecureString 'Clave del usuario de prueba'
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $secureDbPassword).Password
$env:DB_NAME = 'clinica_alejandra_test'
$env:INTEGRATION_TESTS = '1'
npm.cmd run db:migrate
npm.cmd run test:integration
Remove-Item Env:DB_HOST,Env:DB_PORT,Env:DB_USER,Env:DB_PASSWORD,Env:DB_NAME,Env:INTEGRATION_TESTS
$secureDbPassword.Dispose()
```

No ejecute el runner contra la base activa aunque su nombre termine en `_test`. Al terminar, elimine manualmente solo el esquema desechable despues de verificar su nombre. `npm test` ejecuta las pruebas unitarias y omite la integracion opt-in.
## OpenShift

La demostración universitaria lleva su configuración integrada en `src/config/demo.js`: host y esquema MySQL, cuenta proporcionada por la propietaria y URL del frontend. No necesita Secrets ni variables de entorno manuales. La clave de sesión se genera en memoria; después de reiniciar el backend hay que ingresar nuevamente. Solo se utilizan el puerto y las señales de clúster que OpenShift proporciona automáticamente.

La cuenta de demostración queda publicada en el código por petición expresa. Debe existir también en MySQL y tener permisos sobre el esquema; incluirla en JavaScript no crea usuarios de MySQL. No se alteran las credenciales del administrador de la aplicación. Esta configuración no está destinada a datos ni servicios reales.

Consulta [deploy/README.md](deploy/README.md) y el [procedimiento conjunto](https://github.com/Alejandra-Guevara/clinica-alejandra-frontend/blob/main/deploy/README.md). El script aplica el YAML al clúster y limpia las referencias antiguas a Secrets/env. Un push o importar desde Git por sí solos no aplican el YAML.
## Límites antes de producción

La conexión y el flujo CRUD se probaron en una instancia desechable MySQL Community 8.4.13 importando el SQL suministrado, y la interfaz se recorrió conectada a esa API. La API se verificó contra XAMPP `clinica-alejandra`: migraciones aditivas 001/002/003, health, CSRF y rechazo de credenciales inexistentes. No se importó el SQL ni se borraron o actualizaron filas clínica del usuario. Antes del uso real, endurezca la cuenta root local de XAMPP, configure TLS y revise host/credenciales; revise compatibilidad con `CHECK`, retención, respaldo cifrado, HTTPS, CSRF/orígenes permitidos y auditoría inmutable. Esta implementación no certifica cumplimiento de normativa colombiana ni reemplaza revisión legal/seguridad clínica.


## Respaldo y restauracion

No se generaron dumps de la base del usuario. Para respaldos operativos, use una cuenta separada de solo lectura con los privilegios de dump necesarios; no use `clinica_api` ni `root`. Guarde cada dump solamente en un volumen cifrado y con acceso restringido. No almacene copias en Git, `dist`, OneDrive compartido ni en una carpeta temporal sin cifrar.

En XAMPP puede usar `mysqldump` con el esquema existente; `--password` solicita la clave sin incluirla en el comando. Cambie el destino por una ruta de un volumen cifrado:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
& 'C:\xampp\mysql\bin\mysqldump.exe' --host=127.0.0.1 --user=clinica_backup --password --single-transaction --routines --events --triggers --hex-blob "--result-file=E:\Backups\clinica-alejandra-$stamp.sql" --databases clinica-alejandra
```

Defina con la clinica el calendario, retencion, responsables, RPO/RTO y custodia de claves; la aplicacion no programa respaldos. Verifique cada archivo y registre el resultado sin incluir datos clinicos. Pruebe restauraciones periodicas solo en una instancia aislada con acceso restringido; nunca apunte un comando de restauracion a la base activa como prueba. Documente la fecha, version del motor, resultado y tiempo de restauracion, y elimine copias temporales al terminar conforme a la politica aprobada.


## GitHub

Backend: https://github.com/Alejandra-Guevara/clinica-alejandra-backend. Frontend: https://github.com/Alejandra-Guevara/clinica-alejandra-frontend. La configuración de demostración integra credenciales públicas por petición de la propietaria; no reutilizarlas fuera del proyecto.
