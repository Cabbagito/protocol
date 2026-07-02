#!/usr/bin/env bash
# Create a new Protocol user on the production server over SSH.
#
# Usage:
#   ./scripts/create-user.sh "Name"              # server generates the password
#   ./scripts/create-user.sh "Name" "password"   # explicit password (must be unique)
#
# Env:
#   PROTOCOL_SSH_HOST    SSH host alias (default: protocol)
#   PROTOCOL_CONTAINER   backend container name (default: protocol-backend-1)
#
# Requires operator SSH keys. See backend/scripts/manage_users.py for
# list/delete, e.g.:
#   ssh -o RequestTTY=no -o RemoteCommand=none protocol \
#     "docker exec protocol-backend-1 python -m scripts.manage_users list"
set -euo pipefail

NAME="${1:?usage: create-user.sh \"Name\" [password]}"
PASSWORD="${2:-}"
HOST="${PROTOCOL_SSH_HOST:-protocol}"
CONTAINER="${PROTOCOL_CONTAINER:-protocol-backend-1}"

if [ -n "$PASSWORD" ]; then
  ARGS=$(printf '%q %q' "$NAME" "$PASSWORD")
else
  ARGS=$(printf '%q' "$NAME")
fi

ssh -o RequestTTY=no -o RemoteCommand=none "$HOST" \
  "docker exec $CONTAINER python -m scripts.manage_users create $ARGS"
