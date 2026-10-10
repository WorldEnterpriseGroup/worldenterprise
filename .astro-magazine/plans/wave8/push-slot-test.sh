#!/usr/bin/env bash
# Self-test for push-slot.sh: four concurrent pushes through two slots never overlap more than two at a time,
# a failed pipeline exits 1, and a missing pipeline exits 3. No git, no network: push and status are mocked.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
base="${CLAUDE_JOB_DIR:+$CLAUDE_JOB_DIR/tmp}"
work="$(mktemp -d "${base:-${TMPDIR:-/tmp}}/slot-test.XXXXXX")"
trap 'rm -rf "$work"' EXIT
export WAVE8_SLOT_DIR="$work/slots"
export WAVE8_POLL_SECONDS=1
export WAVE8_APPEAR_SECONDS=4
log="$work/events.log"
: >"$log"

cat >"$work/push.sh" <<EOF
#!/usr/bin/env bash
echo "+ \$1 \$(date +%s.%N)" >>"$log"
( sleep 3; touch "$work/done-\${1//\//_}" ) &
EOF
cat >"$work/status.sh" <<EOF
#!/usr/bin/env bash
key="\${1//\//_}"
now="\$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if [ -e "$work/fail-\$key" ] && [ -e "$work/done-\$key" ]; then echo "7 failed \$now"; exit 0; fi
if [ -e "$work/none-\$key" ]; then echo "none"; exit 0; fi
if [ -e "$work/done-\$key" ]; then
  if [ ! -e "$work/seen-\$key" ]; then touch "$work/seen-\$key"; echo "- \$1 \$(date +%s.%N)" >>"$log"; fi
  echo "7 success \$now"
else
  echo "7 running \$now"
fi
EOF
chmod +x "$work/push.sh" "$work/status.sh"
export WAVE8_PUSH_CMD="$work/push.sh"
export WAVE8_STATUS_CMD="$work/status.sh"

pids=()
for b in wp/a wp/b wp/c wp/d; do
  bash "$here/push-slot.sh" push "$b" --slots 2 >"$work/out-${b//\//_}.txt" 2>&1 &
  pids+=("$!")
done
fail=0
for p in "${pids[@]}"; do wait "$p" || fail=$((fail + 1)); done
python3 - "$log" <<'PY'
import sys
ev = [l.split() for l in open(sys.argv[1]) if l.strip()]
ev.sort(key=lambda e: float(e[2]))
cur = peak = 0
for sign, _, _ in ev:
    cur += 1 if sign == '+' else -1
    peak = max(peak, cur)
print(f'events={len(ev)} peak concurrent pipelines={peak}')
sys.exit(0 if peak <= 2 and len(ev) == 8 else 1)
PY
echo "four pushes through two slots: ok (nonzero exits: $fail)"

touch "$work/fail-wp_f" "$work/done-wp_f"
set +e
bash "$here/push-slot.sh" push wp/f --slots 2 >"$work/out-f.txt" 2>&1
code_f=$?
touch "$work/none-wp_n"
bash "$here/push-slot.sh" push wp/n --slots 2 >"$work/out-n.txt" 2>&1
code_n=$?
set -e
[ "$code_f" -eq 1 ] || { echo "expected exit 1 for a failed pipeline, got $code_f"; exit 1; }
[ "$code_n" -eq 3 ] || { echo "expected exit 3 for a missing pipeline, got $code_n"; exit 1; }
echo "failed pipeline exits 1, missing pipeline exits 3: ok"
bash "$here/push-slot.sh" status --slots 2
echo "push-slot self-test passed"
