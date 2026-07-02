#!/usr/bin/env bash
# Create a new Protocol user via the admin API.
#
# Usage:
#   ./scripts/create-user.sh "Name"              # server generates the password
#   ./scripts/create-user.sh "Name" "password"   # explicit password (must be unique)
#
# Env:
#   PROTOCOL_URL     API base URL (default: https://protocol-42.com)
#   ADMIN_PASSWORD   admin login password (prompted if unset)
set -euo pipefail

NAME="${1:?usage: create-user.sh \"Name\" [password]}"
PASSWORD="${2:-}"
URL="${PROTOCOL_URL:-https://protocol-42.com}"

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  read -rs -p "Admin password: " ADMIN_PASSWORD
  echo >&2
fi
export ADMIN_PASSWORD

LOGIN_BODY=$(python3 -c 'import json, os; print(json.dumps({"password": os.environ["ADMIN_PASSWORD"]}))')
TOKEN=$(curl -fsS -X POST "$URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "$LOGIN_BODY" | python3 -c 'import sys, json; print(json.load(sys.stdin)["access_token"])')

CREATE_BODY=$(python3 -c '
import json, sys
body = {"name": sys.argv[1]}
if len(sys.argv) > 2 and sys.argv[2]:
    body["password"] = sys.argv[2]
print(json.dumps(body))
' "$NAME" "$PASSWORD")

curl -fsS -X POST "$URL/api/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$CREATE_BODY" | python3 -c '
import sys, json
u = json.load(sys.stdin)
print("Created user: " + u["name"] + " (" + u["id"] + ")")
print("Password:     " + u["password"])
'
