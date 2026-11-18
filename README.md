# Clínica Alejandra · Frontend

Aplicación React/Vite conectada a la API independiente `../clinica-alejandra-backend`. Toda interacción de base de datos ocurre en Express. La base y las tablas siguen el SQL suministrado.

## Ejecución local

Requiere Node 22. Configure MySQL/XAMPP e inicie el backend primero. La API local se conecta mediante el proxy de Vite a `http://localhost:3000`, sin .env. Ejecute:

```bash
npm install
npm run dev
npm run build
npm run lint
npm test
```

El backend requiere una base previamente preparada. El archivo SQL llama a la base `historias_clinicas`, aunque el requisito inicial menciona `clinica-alejandra`; `DB_NAME` permite apuntar a la base existente sin crearla ni renombrarla. Consulte el README del backend y revise el SQL antes de importarlo.

## Funcionalidad actual

- Login, sesión en cookie HttpOnly, control de rol de rutas y cierre de sesión.
- Dashboard, búsquedas, ordenamiento en servidor, paginación, creación/edición y detalle conectado a la API para los recursos definidos en `src/components/ResourcePage.jsx`.
- Layout responsive en español, tablas reutilizables, estados de carga/error/vacío, formularios con React Hook Form/Zod, avisos Sonner y gráfico Recharts.
- Los campos de relaciones cargan listas desde la API (hasta 100 opciones por tipo). La ficha clínica usa `GET /api/pacientes/:id/record` para mostrar consultas, diagnósticos, signos vitales, recetas, órdenes, alergias y antecedentes; el panel de auditoría de esa ficha solo está disponible para Administradores y se puede imprimir. El portal usa `GET /api/pacientes/portal/me` y limita la ficha al paciente autenticado.
- Recetas y órdenes médicas tienen formularios compuestos: cada cabecera y sus líneas se guardan en una transacción para consultas en borrador autorizadas. Los formularios advierten antes de descartar cambios o cerrar la pestaña.
- Administradores y personal administrativo pueden asignar/revocar acceso de médicos a historias desde el módulo “Asignar médico”; la migración 002 conserva asignaciones derivadas de consultas existentes.

## Alcance pendiente

`npm run test:e2e` ejecuta ocho flujos con API simulada: login/logout, ficha y auditoria, denegacion por rol, portal, asignaciones y busqueda contextual de pacientes. La funcion y las rutas de recuperacion de contrasena se eliminaron. Las asociaciones se registran desde formularios con opciones de referencia cargadas desde la API. Usuarios y roles tienen gestion administrativa; los nombres de roles base estan protegidos. Los registros pueden crearse y editarse según el rol; la eliminación está deshabilitada. Las historias clínicas se archivan y la auditoría se conserva. No se simulan filas para completar el dashboard.

## OpenShift

La configuración fija del frontend usa `/api` e indicador demo, sin .env. `nginx.conf` conecta con el backend HTTPS existente `clinica-alejandra-backend-maria-guevara-rio-dev.apps.rm3.7wse.p1.openshiftapps.com`, manteniendo cookies y CSRF en el mismo origen de la página.

Consulta [deploy/README.md](deploy/README.md). El script `deploy/deploy-redhat.sh` aplica explícitamente el [YAML del frontend](deploy/openshift-frontend.yaml) y reconstruye solo este repositorio. No modifica ni crea backends y no requiere el servicio antiguo terminado en backend-git. Importar desde Git no aplica archivos YAML automáticamente. La conectividad de MySQL se verifica aparte con `/api/health`.
## GitHub

Frontend: https://github.com/Alejandra-Guevara/clinica-alejandra-frontend. Backend: https://github.com/Alejandra-Guevara/clinica-alejandra-backend. La configuración de demostración del backend contiene credenciales públicas por petición de la propietaria; no se debe reutilizar para datos o servicios reales.
