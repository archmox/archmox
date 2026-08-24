#!/usr/bin/env bash
#============================================================================
# vm-soak.sh — long-running VM soak test for a built Archmox ISO.
#
# Boots the ISO in QEMU and exercises boot → service startup, repeating for
# N iterations to catch flaky first-boot behavior. Requires KVM.
#
# Usage: tests/stress/vm-soak.sh [--iso <path>] [--iterations <n>] [--mem <mb>]
#============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ISO="${ROOT}/out/archmox-latest.iso"
ITERATIONS=5
MEM=4096

while [[ $# -gt 0 ]]; do
  case "$1" in
    --iso) ISO="$2"; shift 2 ;;
    --iterations) ITERATIONS="$2"; shift 2 ;;
    --mem) MEM="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

if ! command -v qemu-system-x86_64 >/dev/null; then
  echo "qemu-system-x86_64 not installed." >&2
  exit 1
fi
[[ -f "${ISO}" ]] || { echo "ISO not found: ${ISO} (run make-iso.sh first)" >&2; exit 1; }

log() { echo "[soak $(date +%H:%M:%S)] $*"; }

for i in $(seq 1 "${ITERATIONS}"); do
  log "iteration ${i}/${ITERATIONS}: booting ${ISO}"
  timeout 600 qemu-system-x86_64 \
    -enable-kvm -m "${MEM}" -smp 2 \
    -cdrom "${ISO}" -boot d \
    -display none -serial file:"${ROOT}/logs/soak-${i}.serial.log" \
    -device virtio-net-pci,netdev=n0 -netdev user,id=n0 \
    -no-reboot &
  pid=$!
  wait "${pid}" || true
  log "iteration ${i} finished"
done

log "soak complete — inspect logs/soak-*.serial.log for anomalies"
