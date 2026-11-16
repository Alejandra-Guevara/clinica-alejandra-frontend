# OpenShift

Construya cada contenedor en su repositorio/proyecto por separado. Frontend: `docker build --build-arg VITE_API_URL=https://api.ejemplo.edu.co/api -t clinica-alejandra-frontend .`. Backend: construya desde `clinica-alejandra-backend`.

El manifiesto frontend asume imagen publicada y namespace reemplazados. Construya con `VITE_API_URL` apuntando a la Route HTTPS del backend; una URL relativa solo funciona si configura un proxy `/api` en la capa de entrada. En backend, cree Secret con `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true`, `SESSION_SECRET` y, si aplica, monte `DB_SSL_CA`; use ConfigMap para `FRONTEND_URL`, `PORT`, `NODE_ENV=production`, `COOKIE_SECURE=true`. Establezca `TRUST_PROXY` solo con la topología confiable del clúster. Exija HTTPS en Routes. Conecte a MySQL gestionado con backups, TLS y red privada; XAMPP local no es una base de despliegue. El backend incluye Dockerfile no root y health endpoint; requiere revisión del administrador del clúster.


## API OpenShift

El backend tiene su propio manifiesto en `clinica-alejandra-backend/deploy/openshift-backend.yaml`. Antes de aplicarlo, construya y publique la imagen desde la raiz del proyecto backend, reemplace `namespace` por el proyecto OpenShift real y cree `clinica-alejandra-api-config` y `clinica-alejandra-api-secret`, que usa el Deployment. Configure `NODE_ENV=production`, `PORT=3000`, `FRONTEND_URL` con el origen HTTPS exacto del frontend, `COOKIE_SECURE=true`, `DB_SSL=true` y `DB_SSL_CA=/etc/mysql-ca/ca.pem` si usa CA privada; el manifiesto monta opcionalmente el Secret `clinica-alejandra-db-ca` en `/etc/mysql-ca`. Guarde las credenciales DB y `SESSION_SECRET` aleatorio de al menos 32 caracteres en el Secret. No almacene secretos en Git ni en imagenes.

Despues de publicar la imagen y crear el Secret/ConfigMap, ejecute `oc apply -f deploy/openshift-backend.yaml`. Antes de habilitar trafico clinico, aplique manualmente las migraciones aditivas una vez por base con `oc exec deployment/clinica-alejandra-api -- npm run db:migrate` y luego inicialice roles/administrador segun el README del backend. Las migraciones no se ejecutan al arrancar el contenedor. La readiness probe valida API y MySQL; startup/liveness solo comprueban que Express responde, para evitar reinicios durante una caida temporal de MySQL.

El backend expone su Route con TLS edge y redireccion HTTP a HTTPS. Verifique el estado de ambos Deployments, Routes y endpoints antes del uso. Asegure conectividad privada y TLS hacia MySQL gestionado. No conecte OpenShift a XAMPP local ni aplique estos manifiestos a un cluster sin reemplazar imagenes, namespace, dominios y referencias de configuracion.
