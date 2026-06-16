#!/usr/bin/env bash
set -u
set -o pipefail

BACKEND_URL="http://127.0.0.1:8000/api/health"
FRONTEND_URL="http://127.0.0.1:5173/"
FRONTEND_HEALTH_URL="http://127.0.0.1:5173/__health"

failed=0

section() {
  printf '\n== %s ==\n' "$1"
}

show_service() {
  local service="$1"
  local state
  state="$(systemctl is-active "$service" 2>/dev/null || true)"
  printf '%-28s %s\n' "$service" "${state:-unknown}"
  if [[ "${state:-}" != "active" ]]; then
    failed=1
  fi
}

show_port() {
  local port="$1"
  local label="$2"
  if ss -ltnp 2>/dev/null | grep -Eq ":${port}\b"; then
    printf '%-28s listening on %s\n' "$label" "$port"
  else
    printf '%-28s missing on %s\n' "$label" "$port"
    failed=1
  fi
}

show_journal() {
  local service="$1"
  section "JOURNAL ${service}"
  journalctl -u "$service" -n 50 --no-pager --output short-iso 2>/dev/null || true
}

check_http() {
  local label="$1"
  local url="$2"
  local output
  if output="$(curl -fsS --max-time 10 "$url" 2>&1)"; then
    printf '%-28s ok\n' "$label"
  else
    printf '%-28s failed\n' "$label"
    printf '%s\n' "$output" | sed -n '1,20p'
    failed=1
  fi
}

section "SYSTEMD"
show_service "urn-nexus-backend.service"
show_service "urn-nexus-frontend.service"
show_service "cloudflared.service"

section "PORTS"
show_port 8000 "Backend"
show_port 5173 "Frontend"

section "HTTP"
check_http "Backend health" "$BACKEND_URL"
check_http "Frontend root" "$FRONTEND_URL"
check_http "Frontend health" "$FRONTEND_HEALTH_URL"

if [[ "$failed" -ne 0 ]]; then
  show_journal "urn-nexus-backend.service"
  show_journal "urn-nexus-frontend.service"
  show_journal "cloudflared.service"
fi

exit "$failed"
