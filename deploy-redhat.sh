#!/usr/bin/env bash
# Construye solo el frontend. El backend ya existe y no se modifica.
set -euo pipefail

project=maria-guevara-rio-dev
frontend=clinica-alejandra-frontend
manifest=https://raw.githubusercontent.com/Alejandra-Guevara/clinica-alejandra-frontend/main/deploy/openshift-frontend.yaml
mode=${1:-deploy}
if [[ "$mode" != deploy && "$mode" != --repair-route-only ]]; then
  printf 'Uso: bash deploy-redhat.sh [--repair-route-only]\n' >&2
  exit 2
fi

oc whoami >/dev/null
oc project "$project" >/dev/null
expectedHost=clinica-alejandra-frontend-maria-guevara-rio-dev.apps.rm3.7wse.p1.openshiftapps.com

# La Route manual del antiguo Deployment intercepta el dominio de Knative.
# Solo retiramos ese recurso conocido, sin propietario y con host/destino exactos.
if oc get route "$frontend" -n "$project" >/dev/null 2>&1; then
  routeHost=$(oc get route "$frontend" -n "$project" -o jsonpath='{.spec.host}')
  routeTarget=$(oc get route "$frontend" -n "$project" -o jsonpath='{.spec.to.name}')
  routeOwner=$(oc get route "$frontend" -n "$project" -o jsonpath='{.metadata.ownerReferences[*].kind}')
  if [[ "$routeHost" == "$expectedHost" && "$routeTarget" == "$frontend" && -z "$routeOwner" ]]; then
    backup=$(mktemp /tmp/clinica-frontend-route.XXXXXX)
    oc get route "$frontend" -n "$project" -o yaml > "$backup"
    printf 'Respaldo de la Route manual anterior: %s\n' "$backup"
    oc delete route "$frontend" -n "$project"
  elif [[ "$routeHost" == "$expectedHost" ]]; then
    printf 'Existe una Route con ese host que no coincide con la anterior. No se modifica: revisa su propietario y destino.\n' >&2
    exit 1
  fi
fi

if [[ "$mode" == --repair-route-only ]]; then
  url=$(oc get ksvc "$frontend" -n "$project" -o jsonpath='{.status.url}')
  url="https://${url#*://}"
  printf 'Probando la URL de Knative: %s\n' "$url"
  curl --fail --show-error --silent --retry 10 --retry-delay 2 --max-time 15 "$url/health"
  printf '\n'
  exit 0
fi

# El contenedor se llama igual que el KSVC existente; evita añadir otro al aplicar.
if oc get ksvc "$frontend" -n "$project" >/dev/null 2>&1; then
  oc patch ksvc "$frontend" -n "$project" --type=json -p '[{"op":"add","path":"/spec/template/spec/containers/0/name","value":"clinica-alejandra-frontend"}]'
fi
if oc get bc "$frontend" -n "$project" >/dev/null 2>&1; then
  oc patch bc "$frontend" -n "$project" --type=merge -p '{"spec":{"strategy":{"type":"Docker","sourceStrategy":null,"customStrategy":null,"jenkinsPipelineStrategy":null,"dockerStrategy":{"dockerfilePath":"Dockerfile"}}}}'
fi
oc apply -n "$project" -f "$manifest"
oc start-build "$frontend" -n "$project" --follow --wait
image=$(oc get istag "$frontend:latest" -n "$project" -o jsonpath='{.image.dockerImageReference}')
if [[ "$image" != *@sha256:* ]]; then
  printf 'No se encontró la imagen construida del frontend.\n' >&2
  exit 1
fi
oc patch ksvc "$frontend" -n "$project" --type=json -p "[{\"op\":\"replace\",\"path\":\"/spec/template/spec/containers/0/image\",\"value\":\"$image\"}]"
generation=$(oc get ksvc "$frontend" -n "$project" -o jsonpath='{.metadata.generation}')
oc wait ksvc/"$frontend" -n "$project" --for="jsonpath={.status.observedGeneration}=$generation" --timeout=240s
if ! oc wait ksvc/"$frontend" -n "$project" --for=condition=Ready --timeout=240s; then
  oc get ksvc "$frontend" -n "$project" -o jsonpath='{.status.conditions}{"\n"}'
  oc logs -n "$project" -l "serving.knative.dev/service=$frontend" --all-containers=true --tail=50 || true
  exit 1
fi
url=$(oc get ksvc "$frontend" -n "$project" -o jsonpath='{.status.url}')
url="https://${url#*://}"
printf '\nPágina: %s\n' "$url"
curl --fail --show-error --silent --max-time 30 "$url/health"
printf '\nComprobando conexión del frontend con Express...\n'
curl --fail --show-error --silent --max-time 30 "$url/api/live"
printf '\nComprobando MySQL a través del frontend...\n'
if ! curl --fail-with-body --show-error --silent --max-time 30 "$url/api/health"; then
  printf '\nEl frontend está desplegado; el backend todavía reporta un problema de MySQL o de conexión.\n' >&2
  exit 1
fi
printf '\n'
