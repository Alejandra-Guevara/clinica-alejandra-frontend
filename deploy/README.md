# Despliegue en Red Hat OpenShift

Configuración preparada para `maria-guevara-rio-dev` y el dominio del clúster mostrado en la consola. Si cambian el proyecto o el clúster, cambia también namespaces, rutas de imágenes, host de Route y `FRONTEND_URL` antes de aplicar.

## Recursos que se reutilizan

- Un backend: servicio Knative `clinica-alejandra-backend-git`, puerto 8080.
- Un frontend: Deployment `clinica-alejandra-frontend`, puerto 8080.
- Base MySQL existente: Service `historia-clinica-db`, puerto 3306.
- Secret existente: `clinica-alejandra-backend-secret`.
- Dos BuildConfigs con las URLs de GitHub y rama `main`; construyen los Dockerfiles existentes.

El Service `clinica-alejandra-api` es un alias de red hacia los pods del backend existente. Recibe en 3000 y envía al puerto 8080. No crea otra API ni otra base de datos. El backend mantiene una instancia activa porque este acceso interno evita la ruta de activación de Knative. El navegador usa `/api` en el mismo origen HTTPS del frontend; Nginx reenvía a ese Service, y las cookies de sesión y CSRF permanecen en el mismo origen.

## Preparar la conexión de MySQL

En Cargas de trabajo > Secrets > `clinica-alejandra-backend-secret`, conserva `SESSION_SECRET` y agrega `DB_USER` y `DB_PASSWORD` con la cuenta de MySQL remota. La contraseña de MySQL no es la contraseña de acceso de Alejandra. No publiques esos valores en Git ni los pegues en el chat.

El ConfigMap del YAML usa `DB_HOST=historia-clinica-db` y `DB_NAME=clinica-alejandra`. Confirma el nombre del esquema creado por `historia-clinica-db-init`; si es otro, cambia `DB_NAME` antes de aplicar. La carga local de datos no se traslada a Red Hat con un push. Importa únicamente los datos autorizados en la base remota, incluyendo las migraciones, antes de dar el proyecto por listo. Este despliegue no importa, borra ni reinicializa tablas.

MySQL debe ofrecer TLS. `DB_SSL=true` hace que el cliente solicite TLS; no lo habilita en el servidor. Si usa una CA privada, crea el Secret `clinica-alejandra-db-ca` con el archivo `ca.pem` y agrega `DB_SSL_CA=/etc/mysql-ca/ca.pem` al ConfigMap. El volumen ya está declarado. No desactives la verificación del certificado. Una base del catálogo sin TLS requiere configurar TLS en MySQL o usar una instancia que lo ofrezca.

## Aplicar desde la consola con YAML

1. Selecciona el proyecto `maria-guevara-rio-dev`.
2. Abre `deploy/redhat-completo.yaml` en GitHub y pulsa **Raw**; copia su contenido.
3. En Red Hat, usa **+ > Importar YAML**. Como varios recursos ya existen, actualízalos desde sus pestañas YAML o usa `oc apply` en la terminal para aplicar todo sin duplicarlos.
4. El YAML fija la URL del frontend y la configura también como `FRONTEND_URL` del backend. No requiere desplegar la página antes de configurar esa variable.

El archivo completo contiene exactamente `openshift-backend.yaml` del repositorio backend y `openshift-frontend.yaml` de este repositorio. Después de editar cualquiera, regenera el completo.

## Aplicar y compilar desde la terminal de OpenShift

Tras preparar el Secret y confirmar DB_NAME/TLS, pulsa `>_` en la consola y ejecuta:

```bash
curl -fsS https://raw.githubusercontent.com/Alejandra-Guevara/clinica-alejandra-frontend/main/deploy/deploy-redhat.sh -o /tmp/deploy-clinica.sh
bash /tmp/deploy-clinica.sh
```

El script comprueba las claves del Secret sin mostrarlas, aplica el YAML, construye ambos repositorios y actualiza el servicio Knative con el digest de la imagen nueva. Un push a GitHub por sí solo no ejecuta este proceso: vuelve a ejecutar el script después de cambiar código. No se incluye un webhook de GitHub con secretos en el repositorio.

El script espera la generación nueva y `Ready=True`, dirige el Service a la revisión lista y comprueba `/api/health` por la URL del frontend. Las compilaciones pueden tardar varios minutos. Si falla, se detiene y muestra el estado o los logs sin afirmar que el despliegue está listo.

## URL y comprobaciones

Página prevista:

`https://clinica-alejandra-frontend-maria-guevara-rio-dev.apps.rm3.7wse.p1.openshiftapps.com`

- `/health`: responde Nginx; verifica que el frontend está disponible.
- `/api/live`: responde Express a través del proxy.
- `/api/health`: verifica además la conexión con la base de datos; no valida que se hayan importado todas las tablas o los registros.
- Inicia sesión para comprobar autenticación, permisos y registros remotos. Conserva las credenciales del administrador que hayas importado; este despliegue no crea ni cambia contraseñas.

El build activa el indicador de datos sintéticos para administradores. Para otro entorno, cambia el argumento `VITE_DEMO_MODE` del BuildConfig a `false` y recompila.

Si la Route ya existe con otro host, adapta su `spec.host` y el valor `FRONTEND_URL` a ese mismo origen. El manifiesto no elimina rutas anteriores ni recursos de MySQL. Los archivos YAML se han validado localmente; la admisión del clúster, las cuotas, TLS y la cuenta de MySQL deben comprobarse al ejecutar el despliegue.

Referencias: [Builds con Git y Dockerfile](https://docs.redhat.com/en/documentation/openshift_container_platform/4.18/html/builds_using_buildconfig/creating-build-inputs), [escala mínima de Knative](https://docs.redhat.com/en/documentation/red_hat_openshift_serverless/1.36/html/serving/autoscaling), [Services y puertos](https://docs.redhat.com/en/documentation/openshift_container_platform/4.18/html-single/network_apis/index).
