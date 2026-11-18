#!/usr/bin/env bash
# Ejecutar en la terminal >_ de OpenShift. Demostración sin Secrets ni env manuales.
set -euo pipefail

project=maria-guevara-rio-dev
backend=clinica-alejandra-backend-git
frontend=clinica-alejandra-frontend
manifest=https://raw.githubusercontent.com/Alejandra-Guevara/clinica-alejandra-frontend/main/deploy/redhat-completo.yaml

oc whoami >/dev/null
oc project "$project" >/dev/null
# Limpia la configuración vieja del servicio real, no solo el archivo de GitHub.
# Así ningún Secret ausente puede bloquear el arranque antes de ejecutar Node.
if oc get ksvc "$backend" -n "$project" >/dev/null 2>&1; then
  oc patch ksvc "$backend" -n "$project" --type=json -p '[{"op":"add","path":"/spec/template/spec/containers/0/env","value":[]},{"op":"add","path":"/spec/template/spec/containers/0/envFrom","value":[]},{"op":"add","path":"/spec/template/spec/containers/0/volumeMounts","value":[]},{"op":"add","path":"/spec/template/spec/volumes","value":[]}]'
fi

printf 'Aplicando el YAML de ambos repositorios en %s...\n' "$project"
# Algunas importaciones anteriores usan S2I. Cambiar la estrategia completa evita
# que queden sourceStrategy y dockerStrategy simultáneamente al aplicar el YAML.
for build in "$backend" "$frontend"; do
  if oc get bc "$build" -n "$project" >/dev/null 2>&1; then
    oc patch bc "$build" -n "$project" --type=merge -p '{"spec":{"strategy":{"type":"Docker","sourceStrategy":null,"customStrategy":null,"jenkinsPipelineStrategy":null,"dockerStrategy":{"dockerfilePath":"Dockerfile"}}}}'
  fi
done
oc apply -n "$project" -f "$manifest"

# ConfigChange puede iniciar la primera compilación; la adicional queda en cola Serial.
# --follow observa logs y --wait comprueba también el resultado final.
oc start-build "$backend" -n "$project" --follow --wait
backendImage=$(oc get istag "$backend:latest" -n "$project" -o jsonpath='{.image.dockerImageReference}')
if [[ "$backendImage" != *@sha256:* ]]; then
  printf 'No se encontró una imagen inmutable del backend después de compilar.\n' >&2
  exit 1
fi
oc patch ksvc "$backend" -n "$project" --type=json -p "[{\"op\":\"replace\",\"path\":\"/spec/template/spec/containers/0/image\",\"value\":\"$backendImage\"}]"
backendGeneration=$(oc get ksvc "$backend" -n "$project" -o jsonpath='{.metadata.generation}')

oc start-build "$frontend" -n "$project" --follow --wait
frontendImage=$(oc get istag "$frontend:latest" -n "$project" -o jsonpath='{.image.dockerImageReference}')
if [[ "$frontendImage" != *@sha256:* ]]; then
  printf 'No se encontró una imagen inmutable del frontend después de compilar.\n' >&2
  exit 1
fi
oc set image deployment/"$frontend" -n "$project" "frontend=$frontendImage"

printf 'Esperando conexión del backend con MySQL...\n'
if ! oc wait ksvc/"$backend" -n "$project" --for="jsonpath={.status.observedGeneration}=$backendGeneration" --timeout=240s \
  || ! oc wait ksvc/"$backend" -n "$project" --for=condition=Ready --timeout=240s; then
  oc get ksvc "$backend" -n "$project" -o jsonpath='{.status.conditions}{"\n"}'
  oc logs -n "$project" -l "serving.knative.dev/service=$backend" -c "$backend" --tail=60 || true
  printf 'Revisa el código del error MySQL en los logs. La conexión de demostración está en src/config/demo.js del backend.\n' >&2
  exit 1
fi
# El proxy envía tráfico únicamente a la revisión lista, incluso durante futuros despliegues.
revision=$(oc get ksvc "$backend" -n "$project" -o jsonpath='{.status.latestReadyRevisionName}')
oc patch service clinica-alejandra-api -n "$project" --type=json -p "[{\"op\":\"replace\",\"path\":\"/spec/selector\",\"value\":{\"serving.knative.dev/service\":\"$backend\",\"serving.knative.dev/revision\":\"$revision\"}}]"
oc rollout status deployment/"$frontend" -n "$project" --timeout=180s
host=$(oc get route "$frontend" -n "$project" -o jsonpath='{.spec.host}')
printf '\nPágina: https://%s\nComprobar API y MySQL: https://%s/api/health\n' "$host" "$host"
curl --fail --show-error --silent --max-time 30 "https://$host/api/health"
printf '\n'
