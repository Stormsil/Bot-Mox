#!/usr/bin/env sh
set -eu

ROOT_DIR="/usr/share/nginx/html"
OUT_FILE="${ROOT_DIR}/runtime-config.js"

escape_js() {
  # Minimal JS string escaping (values here are expected to be URLs/keys).
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e "s/'/\\\\'/g" -e 's/\r/\\r/g' -e 's/\n/\\n/g'
}

js_string() {
  printf "'%s'" "$(escape_js "$1")"
}

API_BASE_URL="${VITE_API_BASE_URL:-}"
WS_BASE_URL="${VITE_WS_BASE_URL:-}"
SUPABASE_URL="${VITE_SUPABASE_URL:-}"
SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-}"

cat >"${OUT_FILE}" <<EOF
window.__BOTMOX_CONFIG__ = Object.assign(window.__BOTMOX_CONFIG__ || {}, {
  apiBaseUrl: $(js_string "${API_BASE_URL}"),
  wsBaseUrl: $(js_string "${WS_BASE_URL}"),
  supabaseUrl: $(js_string "${SUPABASE_URL}"),
  supabaseAnonKey: $(js_string "${SUPABASE_ANON_KEY}")
});
EOF

exec nginx -g 'daemon off;'

