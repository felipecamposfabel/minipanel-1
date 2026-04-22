#!/usr/bin/env bash
# dev-harness.sh — build-phase executor for the dev agent framework
# Run AFTER /dev-start has completed discovery and human has confirmed decisions.
# Usage: dev-harness.sh <project_root> [max_iterations=20]
set -euo pipefail

PROJECT_ROOT="${1:?Usage: dev-harness.sh <project_root> [max_iterations]}"
MAX_ITERATIONS="${2:-30}"
SLEEP_BETWEEN=2
STATE_FILE="${PROJECT_ROOT}/HARNESS_STATE.json"
LOG_FILE="${PROJECT_ROOT}/harness.log"
CLAUDE_BIN="${CLAUDE_BIN:-claude}"

# ── Helpers ────────────────────────────────────────────────────────────────────
log() {
    local msg="[$(date '+%Y-%m-%dT%H:%M:%S')] $*"
    echo "$msg" | tee -a "$LOG_FILE"
}

read_phase() {
    if [[ -f "$STATE_FILE" ]]; then
        jq -r '.phase // "none"' "$STATE_FILE"
    else
        echo "none"
    fi
}

print_done_summary() {
    local blocked_count=0
    local done_count=0
    if [[ -f "$PROJECT_ROOT/TASKBOARD.json" ]]; then
        blocked_count=$(jq '[.tickets[] | select(.status == "blocked")] | length' "$PROJECT_ROOT/TASKBOARD.json" 2>/dev/null || echo 0)
        done_count=$(jq '[.tickets[] | select(.status == "done")] | length' "$PROJECT_ROOT/TASKBOARD.json" 2>/dev/null || echo 0)
    fi
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════╗"
    if [[ "$blocked_count" -eq 0 ]]; then
        echo "║  PROJECT COMPLETE                                                ║"
    else
        echo "║  BUILD LOOP COMPLETE (with blocked tickets)                      ║"
    fi
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "  Done:    $done_count"
    echo "  Blocked: $blocked_count"
    if [[ "$blocked_count" -gt 0 ]]; then
        echo ""
        echo "  Blocked tickets:"
        jq -r '.tickets[] | select(.status == "blocked") | "    - \(.id) \(.title)\n        blockers: \(.blockers | join("; "))"' \
            "$PROJECT_ROOT/TASKBOARD.json" 2>/dev/null || true
    fi
    echo ""
}

# ── Validate ───────────────────────────────────────────────────────────────────
if [[ ! -d "$PROJECT_ROOT" ]]; then
    echo "Error: '$PROJECT_ROOT' is not a directory." >&2
    exit 1
fi
PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"

if [[ ! -f "$PROJECT_ROOT/PROJECT_SPEC.md" ]]; then
    echo "Error: PROJECT_SPEC.md not found in $PROJECT_ROOT" >&2
    echo "Run /dev-start first to complete requirements and discovery." >&2
    exit 1
fi

phase="$(read_phase)"
if [[ "$phase" == "done" ]]; then
    echo "Project is already complete (phase=done)."
    exit 0
fi
if [[ "$phase" != "build" ]]; then
    echo "Error: harness requires phase='build', got '$phase'." >&2
    echo "Complete the interactive setup first (/dev-start), then run the harness." >&2
    exit 1
fi

# ── Main loop ──────────────────────────────────────────────────────────────────
log "dev-harness starting. project_root=$PROJECT_ROOT max_iterations=$MAX_ITERATIONS"

iteration=0

while [[ $iteration -lt $MAX_ITERATIONS ]]; do
    iteration=$(( iteration + 1 ))
    phase_before="$(read_phase)"
    start_ts=$(date +%s)

    log "── Iteration $iteration/$MAX_ITERATIONS ── phase=$phase_before"

    if [[ "$phase_before" == "done" ]]; then
        print_done_summary
        log "Phase is 'done'. Exiting successfully."
        exit 0
    fi

    PROMPT="PROJECT_ROOT: ${PROJECT_ROOT}
This value is already known — do NOT call AskUserQuestion to ask for it.
Read HARNESS_STATE.json at PROJECT_ROOT and continue from the current phase (currently: ${phase_before}).
Do NOT stop after a single action. Complete as many tickets as possible in this invocation.
Do NOT call AskUserQuestion for any information already provided in this prompt."

    # ── Spawn claude ──────────────────────────────────────────────────────────
    # cd into PROJECT_ROOT so Claude auto-loads CLAUDE.md from project memory.
    # --add-dir only grants filesystem permission; it does not set cwd.
    output=$(
        cd "$PROJECT_ROOT" && echo "$PROMPT" | "$CLAUDE_BIN" \
            --dangerously-skip-permissions \
            --print \
            --agent dev-pm \
            --add-dir "$PROJECT_ROOT" \
        2>&1
    ) || true   # non-zero exit is non-fatal; state file is authoritative

    end_ts=$(date +%s)
    duration=$(( end_ts - start_ts ))
    phase_after="$(read_phase)"

    log "Iteration $iteration done. duration=${duration}s phase=$phase_before->$phase_after"

    {
        echo "=== iteration $iteration output (head 10) ==="
        echo "$output" | head -10
        echo "--- (tail 10) ---"
        echo "$output" | tail -10
        echo "==="
    } >> "$LOG_FILE"

    if [[ "$phase_after" == "done" ]]; then
        print_done_summary
        log "Phase reached 'done'."
        exit 0
    fi

    if [[ "$phase_after" == "$phase_before" ]]; then
        log "WARNING: phase did not advance this iteration ($phase_before -> $phase_after)"
    fi

    sleep "$SLEEP_BETWEEN"
done

log "Max iterations ($MAX_ITERATIONS) reached. Final phase: $(read_phase)"
echo ""
echo "ERROR: dev-harness reached max iterations ($MAX_ITERATIONS) without completing." >&2
echo "Final phase: $(read_phase). See: $LOG_FILE" >&2
exit 1
