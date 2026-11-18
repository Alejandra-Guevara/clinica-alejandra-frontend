#!/usr/bin/env bash
# Construye solo el frontend. El backend ya existe y no se modifica.
set -euo pipefail

project=maria-guevara-rio-dev
frontend=clinica-alejandra-frontend
manifest=https://raw.githubusercontent.com/Alejandra-Guevara/clinica-alejandra-frontend/main/deploy/openshift-frontend.yaml

oc whoami >/dev/null
oc project "$project" >/dev/null
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
oc set image deployment/"$frontend" -n "$project" "frontend=$image"
oc rollout status deployment/"$frontend" -n "$project" --timeout=180s
host=$(oc get route "$frontend" -n "$project" -o jsonpath='{.spec.host}')
printf '\nPágina: https://%s\n' "$host"
curl --fail --show-error --silent --max-time 30 "https://$host/health"
printf '\nComprobando conexión del frontend con Express...\n'
curl --fail --show-error --silent --max-time 30 "https://$host/api/live"
printf '\nComprobando MySQL a través del frontend...\n'
if ! curl --fail-with-body --show-error --silent --max-time 30 "https://$host/api/health"; then
  printf '\nEl frontend está desplegado; el backend todavía reporta un problema de MySQL o de conexión.\n' >&2
  exit 1
fi
printf '\n'
