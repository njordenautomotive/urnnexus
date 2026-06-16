#!/usr/bin/env bash
set -u
set -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECK_SCRIPT="$ROOT_DIR/scripts/check_nexus_runtime.sh"
BACKEND_HEALTH_URL="http://127.0.0.1:8000/api/health"
FRONTEND_HEALTH_URL="http://127.0.0.1:5173/__health"
FRONTEND_ROOT_URL="http://127.0.0.1:5173/"

restart_with_systemctl() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    systemctl restart urn-nexus-backend.service urn-nexus-frontend.service cloudflared.service
    return 0
  fi

  if sudo -n true 2>/dev/null; then
    sudo systemctl restart urn-nexus-backend.service urn-nexus-frontend.service cloudflared.service
    return 0
  fi

  return 1
}

restart_with_process_kill() {
  echo "Sudo er ikke tilgjengelig uten interaktiv autentisering. Prøver å stoppe prosessene så systemd kan starte dem på nytt."
  pkill -TERM -f 'uvicorn backend\.app\.main:app' 2>/dev/null || true
  pkill -TERM -f 'run_onedrive_appliance\.py' 2>/dev/null || true
  pkill -TERM -f 'serve_frontend_dist\.py' 2>/dev/null || true
  pkill -TERM -f 'node .*scripts/dev\.js' 2>/dev/null || true
  pkill -TERM -f 'vite --host' 2>/dev/null || true
  pkill -TERM -f 'npm run dev' 2>/dev/null || true

  sleep 3

  if ! curl -fsS --max-time 3 "$BACKEND_HEALTH_URL" >/dev/null 2>&1; then
    pkill -KILL -f 'uvicorn backend\.app\.main:app' 2>/dev/null || true
    pkill -KILL -f 'run_onedrive_appliance\.py' 2>/dev/null || true
  fi

  if ! curl -fsS --max-time 3 "$FRONTEND_ROOT_URL" >/dev/null 2>&1; then
    pkill -KILL -f 'serve_frontend_dist\.py' 2>/dev/null || true
    pkill -KILL -f 'node .*scripts/dev\.js' 2>/dev/null || true
    pkill -KILL -f 'vite --host' 2>/dev/null || true
    pkill -KILL -f 'npm run dev' 2>/dev/null || true
  fi
}

runtime_is_ready() {
  systemctl is-active urn-nexus-backend.service >/dev/null 2>&1 || return 1
  systemctl is-active urn-nexus-frontend.service >/dev/null 2>&1 || return 1
  systemctl is-active cloudflared.service >/dev/null 2>&1 || return 1
  curl -fsS --max-time 5 "$BACKEND_HEALTH_URL" >/dev/null 2>&1 || return 1
  curl -fsS --max-time 5 "$FRONTEND_ROOT_URL" >/dev/null 2>&1 || return 1
  curl -fsS --max-time 5 "$FRONTEND_HEALTH_URL" >/dev/null 2>&1 || return 1
}

wait_for_runtime() {
  local attempt
  for attempt in $(seq 1 12); do
    if runtime_is_ready; then
      return 0
    fi
    sleep 5
  done
  return 1
}

if ! restart_with_systemctl; then
  restart_with_process_kill
fi

if ! wait_for_runtime; then
  echo "Tjenestene ble ikke fullt klare innen tidsfristen."
fi

exec "$CHECK_SCRIPT"
