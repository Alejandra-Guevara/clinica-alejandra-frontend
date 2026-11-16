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

`npm run test:e2e` ejecuta ocho flujos con API simulada: login/logout, ficha y auditoria, denegacion por rol, portal, asignaciones y busqueda contextual de pacientes. La funcion y las rutas de recuperacion de contrasena se eliminaron. Las asociaciones se registran desde formularios con opciones de referencia cargadas desde la API. Usuarios y roles tienen gestion administrativa; los nombres de roles base estan protegidos. Las tablas incluyen acciones de eliminación con confirmación según el rol y las relaciones; la API bloquea datos clínicos que deben conservarse. Las historias se archivan; consultas finalizadas/anuladas, resultados informados y auditoría no se eliminan. No se simulan filas para completar el dashboard.

## OpenShift

El Dockerfile construye assets estaticos servidos por Nginx no root (puerto 8080), con fallback SPA y health endpoint. El valor predeterminado `VITE_API_URL=/api` usa el proxy de Nginx hacia el Service `clinica-alejandra-api:3000`, conservando un mismo origen para cookies de sesion y CSRF. Despliegue primero el backend y ambos proyectos en el mismo namespace de OpenShift; si usa otro namespace o nombre de Service, ajuste el upstream en `nginx.conf` y reconstruya la imagen frontend. Configure `FRONTEND_URL` del backend con el origen HTTPS de la Route frontend, `COOKIE_SECURE=true`, TLS de Routes y `TRUST_PROXY=2` para la cadena Route de OpenShift -> Nginx -> Express; ajuste ese numero si cambia la topologia de proxies. Ejemplo de Deployment/Service/Route TLS en `deploy/openshift-frontend.yaml`; no guarde secretos en la imagen.


## GitHub

Este proyecto tiene su propio repositorio Git. El remoto `origin` configurado apunta actualmente a `https://github.com/Alejandra-Guevara/clinica-alejandra-frontend.git`, distinto del nombre solicitado `clinica-alejandra`. Confirme la URL destino antes de cambiar el remoto o publicar cambios.
