#!/usr/bin/env bash
# Phase B in one command: port-forward the GPU router if it is not already forwarded, probe the model, generate every candidate
# (serialized, resumable), then build the QA sheets and queue. The QA pass and the promotion are the two steps that follow.
#
#   scripts/photo/phase-b.sh [generate.mjs flags]       e.g. --model boogu_image_turbo --slots svc-b,band-1 --candidates 1
#   scripts/photo/phase-b.sh --probe                     only say whether the model is serving
#
# The router key is read by the node scripts from HARDMAGIC_INTERNAL_KEY or Azure Key Vault (omlab-secrets,
# hardmagic-internal-api-key). It is never exported, echoed or logged here. Needs `kubectl` access to the gpu-suite namespace and `az login`.
set -euo pipefail

cd "$(dirname "$0")/../.."
PORT=18200
FORWARD_PID=""

cleanup() {
  if [ -n "$FORWARD_PID" ]; then
    kill "$FORWARD_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

forwarded() {
  (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null
}

if ! forwarded; then
  echo "Starting the router port-forward on localhost:$PORT"
  kubectl -n gpu-suite port-forward svc/gpu-router "$PORT:8200" >/dev/null 2>&1 &
  FORWARD_PID=$!
  for _ in $(seq 1 20); do
    forwarded && break
    sleep 1
  done
  if ! forwarded; then
    echo "The port-forward did not come up. Check: kubectl -n gpu-suite get svc gpu-router" >&2
    exit 2
  fi
fi

echo "== probe =="
set +e
node scripts/photo/generate.mjs --probe "$@"
status=$?
set -e
if [ "$status" -eq 3 ]; then
  echo "The model is not serving yet. Nothing was generated. Rerun when it is Ready." >&2
  exit 3
elif [ "$status" -ne 0 ]; then
  exit "$status"
fi

# --probe alone stops here.
for arg in "$@"; do
  if [ "$arg" = "--probe" ]; then
    exit 0
  fi
done

echo "== generate =="
node scripts/photo/generate.mjs "$@"

echo "== qa sheets =="
node scripts/photo/qa-sheet.mjs "$@"

echo
echo "Next: the QA pass (scripts/photo/qa-rubric.md), then node scripts/photo/promote.mjs --from-qa"
