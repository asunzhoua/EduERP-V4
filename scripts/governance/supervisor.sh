#!/usr/bin/env bash
# supervisor.sh — watches Claude Code heartbeat and restarts if stale with remaining tasks
set -euo pipefail

PROJ_ROOT="$(cd "$(dirname "$0")/../../" && pwd)"
AUDIT_DIR="$PROJ_ROOT/.audit"
HEARTBEAT="$AUDIT_DIR/heartbeat.json"
PROGRESS="$AUDIT_DIR/progress.json"
LOG="$AUDIT_DIR/supervisor.log"
INTERVAL=30
STALE_SECONDS=120

mkdir -p "$AUDIT_DIR"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG"
}

is_claude_running() {
  pgrep -f "node.*claude" > /dev/null 2>&1
}

is_heartbeat_stale() {
  [[ ! -f "$HEARTBEAT" ]] && return 0

  local last_update
  last_update=$(grep -o '"lastUpdate"[[:space:]]*:[[:space:]]*"[^"]*"' "$HEARTBEAT" 2>/dev/null \
    | head -1 \
    | sed 's/.*"\([^"]*\)"$/\1/')

  [[ -z "$last_update" ]] && return 0

  local last_epoch now_epoch diff
  last_epoch=$(date -d "$last_update" +%s 2>/dev/null || echo 0)
  now_epoch=$(date +%s)
  diff=$(( now_epoch - last_epoch ))

  (( diff > STALE_SECONDS ))
}

has_remaining_tasks() {
  [[ ! -f "$PROGRESS" ]] && return 1

  # check for "remaining" or incomplete task count
  grep -qE '"remaining"[[:space:]]*:[[:space:]]*[1-9]' "$PROGRESS" 2>/dev/null
}

restart_claude() {
  log "Restarting Claude Code with resume prompt..."
  cd "$PROJ_ROOT"
  # launch detached so supervisor keeps running
  nohup claude --dangerously-skip-permissions \
    -p "Read .audit/heartbeat.json and .audit/progress.json. Resume the remaining tasks from where you left off." \
    >> "$AUDIT_DIR/claude-restart.log" 2>&1 &
  log "Claude Code restarted (PID $!)"
}

# --- main loop ---
log "Supervisor started (pid $$, interval ${INTERVAL}s, stale threshold ${STALE_SECONDS}s)"

while true; do
  if is_claude_running; then
    : # claude is alive, nothing to do
  elif is_heartbeat_stale && has_remaining_tasks; then
    log "Heartbeat stale and tasks remain — triggering restart"
    restart_claude
  else
    : # claude not running but nothing to resume
  fi
  sleep "$INTERVAL"
done
