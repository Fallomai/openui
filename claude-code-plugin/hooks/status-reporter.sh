#!/bin/bash

# OpenUI Status Reporter for Claude Code
# Reports agent status to OpenUI server via HTTP

STATUS="$1"
OPENUI_PORT="${OPENUI_PORT:-4242}"
OPENUI_HOST="${OPENUI_HOST:-localhost}"

# Read the session info from stdin (JSON)
INPUT=$(cat)

# Extract session_id from the input JSON
SESSION_ID=$(echo "$INPUT" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"//' | sed 's/"$//')

# Extract cwd from the input JSON
CWD=$(echo "$INPUT" | grep -o '"cwd"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"//' | sed 's/"$//')

# If we have a session_id and status, report to OpenUI
if [ -n "$STATUS" ]; then
  # Use curl to POST status update (fire and forget, don't block)
  curl -s -X POST "http://${OPENUI_HOST}:${OPENUI_PORT}/api/status-update" \
    -H "Content-Type: application/json" \
    -d "{\"status\":\"${STATUS}\",\"sessionId\":\"${SESSION_ID}\",\"cwd\":\"${CWD}\"}" \
    --max-time 2 \
    >/dev/null 2>&1 &
fi

# Always exit successfully so we don't block Claude
exit 0
