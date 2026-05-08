#!/usr/bin/env bash
# Cold-start (or warm) PERF capture for P11.1 profiling.
#
# Prereq: `npx expo start -c` running in another terminal, app already
# installed on the connected emulator/device.
#
# Usage:
#   scripts/perf-capture.sh cold   # force-stops, launches, captures 25s
#   scripts/perf-capture.sh warm   # no force-stop, captures 25s while you
#                                  # navigate Home → Panchang inside the app
#   scripts/perf-capture.sh cold 35   # custom duration in seconds
#
# Output: all [PERF ...] lines printed AND saved to /tmp/perf-{cold,warm}.log

set -euo pipefail

PKG="${EXPO_PKG:-host.exp.exponent}"     # Expo Go by default; override via env
DEV_URL="${EXPO_DEV_URL:-exp://192.168.0.132:8081}"
MODE="${1:-cold}"
DURATION="${2:-25}"

if [[ "$MODE" != "cold" && "$MODE" != "warm" ]]; then
  echo "Usage: $0 {cold|warm} [duration_seconds]" >&2
  exit 1
fi

if ! adb get-state >/dev/null 2>&1; then
  echo "No emulator/device connected. Start the emulator first." >&2
  exit 1
fi

RAW="/tmp/perf-${MODE}-raw.log"
OUT="/tmp/perf-${MODE}.log"

if [[ "$MODE" == "cold" ]]; then
  echo ">> force-stopping ${PKG}"
  adb shell am force-stop "${PKG}"
  adb logcat -c
  echo ">> NOW: open Expo Go on the emulator and tap the dharmagya project tile."
  echo ">>      Once Home is fully loaded, tap the Panchang tab."
  echo ">> capturing ${DURATION}s starting now"
else
  adb logcat -c
  echo ">> capturing ${DURATION}s (warm) — NAVIGATE Home → Panchang inside the app"
fi

# Capture everything for DURATION seconds, then filter. This is the most
# portable way on macOS (no GNU `timeout`).
adb logcat ReactNativeJS:V '*:S' > "${RAW}" 2>&1 &
LOGCAT_PID=$!
sleep "${DURATION}"
kill "${LOGCAT_PID}" 2>/dev/null || true
wait "${LOGCAT_PID}" 2>/dev/null || true

grep -F PERF "${RAW}" > "${OUT}" || true

LINES=$(wc -l < "${OUT}" | tr -d ' ')
echo "----------------------------------------"
echo ">> ${LINES} PERF lines saved to ${OUT}"
echo "----------------------------------------"
cat "${OUT}"
