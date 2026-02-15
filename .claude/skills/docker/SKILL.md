---
disable-model-invocation: true
argument-hint: [optional: down|logs|status]
---

# /docker — Docker Compose Management

Smart Docker Compose management — detect state and act accordingly.

All commands run from the project root: `/Users/peki/Documents/projects/protocol`

## Steps

1. Parse `$ARGUMENTS` to determine the action:
   - No argument or `up` → **start/rebuild**
   - `down` → **stop**
   - `logs` → **show logs**
   - `status` → **show status**

2. **Start/rebuild (default):**
   - Run `docker compose up --build -d`
   - Wait a few seconds, then run `docker compose ps` to show final container status

3. **Down:**
   - Run `docker compose down`
   - Confirm containers are stopped

4. **Logs:**
   - Run `docker compose logs --tail=50`
   - Show the output

5. **Status:**
   - Run `docker compose ps`
   - Show the output
