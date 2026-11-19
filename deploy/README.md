# Frontend conectado al backend existente

Backend informado por la propietaria:

`https://clinica-alejandra-backend-maria-guevara-rio-dev.apps.rm3.7wse.p1.openshiftapps.com`

React sigue usando `/api`. El archivo `nginx.conf` reenvía esas solicitudes a la Route HTTPS anterior, conserva el recorrido `/api/...`, envía el Host y SNI adecuados y verifica el certificado con las CA de la imagen. No se coloca `/api/health` como URL base de las llamadas: esa dirección sirve solo para comprobar MySQL.

Las cookies siguen siendo del mismo origen del frontend; no se requieren variables de entorno ni cambios en el código del backend. El Dockerfile instala el paquete de certificados CA y compila el frontend con la configuración integrada de `src/config/demo.js`. Vite conserva su proxy local a localhost:3000.

## Reparar la Route anterior sin recompilar

Si Knative indica Ready=True pero la URL devuelve la página 503 del router, la Route manual del antiguo Deployment puede interceptar el mismo host. En este proyecto se observó una Route `clinica-alejandra-frontend` con ese host y destino `clinica-alejandra-frontend`, correspondiente al manifiesto normal anterior.

En la terminal de OpenShift:

```bash
curl -fsS https://raw.githubusercontent.com/Alejandra-Guevara/clinica-alejandra-frontend/main/deploy/deploy-redhat.sh -o /tmp/deploy-clinica.sh
bash /tmp/deploy-clinica.sh --repair-route-only
```

El script solo retira esa Route si coinciden host y destino y no tiene propietario; primero guarda un respaldo YAML en /tmp y muestra su ubicación. No elimina el KSVC, pods, Services ni datos. No modifica el backend. Si detecta una Route diferente o gestionada por un controlador, se detiene sin retirarla. Luego prueba `/health` en la URL del KSVC con reintentos. Puede restaurarse la Route anterior aplicando el archivo de respaldo si se necesita revertir.

## Desplegar o reconstruir SOLO el frontend

En la terminal `>_` de OpenShift:

```bash
curl -fsS https://raw.githubusercontent.com/Alejandra-Guevara/clinica-alejandra-frontend/main/deploy/deploy-redhat.sh -o /tmp/deploy-clinica.sh
bash /tmp/deploy-clinica.sh
```

El script aplica `deploy/openshift-frontend.yaml`, construye este repositorio con Dockerfile y actualiza el servicio Knative existente `clinica-alejandra-frontend` usando el digest construido. Espera la generación nueva y Ready=True. El manifiesto no crea un Deployment normal, un Service interno manual ni una Route manual con el mismo host; Knative gestiona la exposición y mantiene una instancia activa. También repara la Route anterior como se describe arriba. No aplica manifiestos backend ni cambia MySQL.

Para importar/mostrar YAML en la consola, usa `deploy/openshift-frontend.yaml`. El nombre histórico `deploy/redhat-completo.yaml` se conserva por compatibilidad, pero ahora contiene solo los mismos recursos frontend. Si ya existen, utiliza `oc apply` como hace el script, o edita esos recursos. Importar desde Git construye el Dockerfile y no aplica automáticamente los archivos YAML.

## Comprobar

Página prevista:

`https://clinica-alejandra-frontend-maria-guevara-rio-dev.apps.rm3.7wse.p1.openshiftapps.com`

- `/health`: Nginx disponible.
- `/api/live`: Express responde a través del proxy.
- `/api/health`: conexión a MySQL disponible a través del proxy.

En la comprobación remota del 18 de noviembre de 2026, Express devolvió 200 en `/api/live` y emitió la cookie CSRF para el origen previsto del frontend. `/api/health` devolvió 503 con `DATABASE_UNAVAILABLE`. Esto indica que MySQL aún requiere revisión; conectar el frontend no corrige la cuenta, el esquema ni la conectividad de la base. El script informa esta diferencia y no declara éxito integral si MySQL falla.

Se verificaron compilación local, sintaxis del YAML y del script. La imagen de Nginx y la admisión del clúster se comprueban al construir y desplegar en Red Hat.
