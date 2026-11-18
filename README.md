# Clínica Alejandra · Frontend

Aplicación React/Vite conectada a la API independiente `../clinica-alejandra-backend`. Toda interacción de base de datos ocurre en Express. La base y las tablas siguen el SQL suministrado.

## Ejecución local

Requiere Node 22. Configure MySQL/XAMPP e inicie el backend primero. Copie `.env.example` a `.env`, ajuste `VITE_API_URL` si la API no está en `http://localhost:3000/api`, y ejecute:

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

El procedimiento vigente está en [deploy/README.md](deploy/README.md). El YAML [deploy/redhat-completo.yaml](deploy/redhat-completo.yaml) construye los dos repositorios desde GitHub, reutiliza el backend Knative existente y publica el frontend en HTTPS. El script de despliegue comprueba los Secrets, espera la revisión nueva y valida la conexión por `/api/health`.

El frontend usa `/api` y Nginx conserva el mismo origen para cookies y CSRF. El Service interno `clinica-alejandra-api:3000` envía al backend Knative en 8080. El ConfigMap incluye `FRONTEND_URL`, `DB_SSL=true` y la ubicación del MySQL existente. Confirma DB_NAME, las credenciales y TLS antes de desplegar. La carga de datos local y las migraciones no se importan al clúster con un push.
## GitHub

Frontend: https://github.com/Alejandra-Guevara/clinica-alejandra-frontend. Backend: https://github.com/Alejandra-Guevara/clinica-alejandra-backend. Los Secrets, contraseñas y archivos .env quedan fuera de Git.
