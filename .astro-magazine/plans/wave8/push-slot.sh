#!/usr/bin/env bash
# Wave 8 push slot. Holds one of N slots (default 5) from before `git push` until the pipeline of the pushed commit ends,
# so that at most N branch pipelines of wave 8 run at once across every worktree of this clone (plan section 4.2, W8-21).
#
# usage:
#   push-slot.sh push  <branch> [--slots N]   wait for a free slot, push the branch, wait for its pipeline, release the slot
#   push-slot.sh watch <ref>    [--slots N]   wait for a free slot, then wait for the newest pipeline on <ref> (use right after a merge to demo)
#   push-slot.sh status        [--slots N]    show which slots are held and by whom
#
# exit: 0 pipeline succeeded, 1 pipeline failed or was canceled, 2 usage or environment error, 3 no pipeline appeared in time
#
# A slot is an flock on <git-common-dir>/wave8-push-slots/slot-<n>.lock. The lock lives as long as this process, so a killed or crashed
# agent frees its slot by itself. Run it as a background command: a pipeline can outlast a foreground timeout.
#
# Test hooks (environment): WAVE8_SLOT_DIR, WAVE8_PUSH_CMD, WAVE8_STATUS_CMD (prints "<id> <status> <created_at>" or "none"),
# WAVE8_POLL_SECONDS, WAVE8_APPEAR_SECONDS, WAVE8_PIPELINE_SECONDS.
set -euo pipefail
export LC_ALL=C

mode="${1:-}"
[ $# -gt 0 ] && shift
target=""
if [ $# -gt 0 ] && [[ "$1" != --* ]]; then
  target="$1"
  shift
fi
slots=5
while [ $# -gt 0 ]; do
  case "$1" in
    --slots) slots="${2:?--slots needs a number}"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

slot_dir="${WAVE8_SLOT_DIR:-$(git rev-parse --git-common-dir)/wave8-push-slots}"
poll="${WAVE8_POLL_SECONDS:-30}"
appear="${WAVE8_APPEAR_SECONDS:-300}"
limit="${WAVE8_PIPELINE_SECONDS:-7200}"
project="WorldEnterpriseGroup%2Fworldenterprise"
mkdir -p "$slot_dir"

status_of() {
  # prints "<id> <status> <created_at>" for the newest pipeline of the given ref, or "none"
  if [ -n "${WAVE8_STATUS_CMD:-}" ]; then
    "$WAVE8_STATUS_CMD" "$1"
    return
  fi
  GITLAB_HOST=git.developerdojo.org glab api "projects/$project/pipelines?ref=$1&per_page=1" |
    python3 -c 'import json,sys; d=json.load(sys.stdin); print("{} {} {}".format(d[0]["id"], d[0]["status"], d[0]["created_at"]) if d else "none")'
}

show_status() {
  local i held=0
  for i in $(seq 1 "$slots"); do
    exec {probe}>>"$slot_dir/slot-$i.lock"
    if flock -n "$probe"; then
      echo "slot $i: free"
    else
      held=$((held + 1))
      echo "slot $i: held by $(cat "$slot_dir/slot-$i.lock" 2>/dev/null | tail -n 1)"
    fi
    exec {probe}>&-
  done
  echo "$held of $slots slots held"
}

acquire() {
  local i
  while true; do
    for i in $(seq 1 "$slots"); do
      exec {slot_fd}>>"$slot_dir/slot-$i.lock"
      if flock -n "$slot_fd"; then
        slot="$i"
        : >"$slot_dir/slot-$i.lock"
        echo "$1 pid $$ since $(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$slot_dir/slot-$i.lock"
        echo "slot $slot of $slots acquired for $1"
        return
      fi
      exec {slot_fd}>&-
    done
    echo "all $slots slots busy, waiting ${poll}s (keep authoring, do not push)"
    sleep "$poll"
  done
}

wait_for_pipeline() {
  # $1 ref, $2 ISO timestamp the wait started at (a pipeline created earlier is not ours)
  local ref="$1" started="$2" waited=0 line id state created
  while true; do
    line="$(status_of "$ref")"
    if [ "$line" != "none" ]; then
      read -r id state created <<<"$line"
      if [[ "$created" > "$started" || "$created" == "$started" ]]; then
        echo "pipeline $id: $state"
        case "$state" in
          success) return 0 ;;
          failed|canceled) return 1 ;;
          skipped) return 3 ;;
        esac
      fi
    fi
    sleep "$poll"
    waited=$((waited + poll))
    if [ "$waited" -ge "$limit" ]; then echo "gave up after ${limit}s" >&2; return 1; fi
    if [ "$waited" -ge "$appear" ] && { [ "$line" = "none" ] || [[ "$created" < "$started" ]]; }; then
      echo "no pipeline appeared within ${appear}s" >&2
      return 3
    fi
  done
}

case "$mode" in
  status)
    show_status
    ;;
  push)
    [ -n "$target" ] || { echo "usage: push-slot.sh push <branch>" >&2; exit 2; }
    acquire "$target"
    started="$(date -u -d '-5 seconds' +%Y-%m-%dT%H:%M:%SZ)"
    if [ -n "${WAVE8_PUSH_CMD:-}" ]; then "$WAVE8_PUSH_CMD" "$target"; else git push origin "$target"; fi
    wait_for_pipeline "$target" "$started"
    ;;
  watch)
    [ -n "$target" ] || { echo "usage: push-slot.sh watch <ref>" >&2; exit 2; }
    acquire "$target"
    started="$(date -u -d '-30 seconds' +%Y-%m-%dT%H:%M:%SZ)"
    wait_for_pipeline "$target" "$started"
    ;;
  *)
    echo "usage: push-slot.sh push <branch> | watch <ref> | status [--slots N]" >&2
    exit 2
    ;;
esac
