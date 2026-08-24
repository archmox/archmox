#!/usr/bin/env bash
#============================================================================
# run-tests.sh — Archmox test runner
#
# Usage:
#   tests/run-tests.sh            # unit tests (fast, no root needed)
#   tests/run-tests.sh integration
#   tests/run-tests.sh all        # unit + integration
#   tests/run-tests.sh stress     # long-running VM soak tests (manual)
#============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly ROOT

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0

run_suite() {
  local suite="$1"; shift
  echo "==> Suite: ${suite}"
  if bash "${ROOT}/tests/${suite}"; then
    PASS=$((PASS + 1))
    echo -e "${GREEN}[PASS]${NC} ${suite}"
  else
    FAIL=$((FAIL + 1))
    echo -e "${RED}[FAIL]${NC} ${suite}"
  fi
  echo
}

case "${1:-unit}" in
  unit)
    run_suite unit/test-pkgbuilds.sh
    run_suite unit/test-scripts.sh
    run_suite unit/test-manifest.sh
    ;;
  integration)
    run_suite integration/test-iso-profile.sh
    run_suite integration/test-build-tooling.sh
    ;;
  all)
    run_suite unit/test-pkgbuilds.sh
    run_suite unit/test-scripts.sh
    run_suite unit/test-manifest.sh
    run_suite integration/test-iso-profile.sh
    run_suite integration/test-build-tooling.sh
    ;;
  stress)
    exec bash "${ROOT}/tests/stress/vm-soak.sh" "${@:2}"
    ;;
  *)
    echo "Unknown target: $1 (use: unit | integration | all | stress)" >&2
    exit 2
    ;;
esac

echo "=========================================="
echo " Suites passed: ${PASS}   failed: ${FAIL}"
[[ ${FAIL} -eq 0 ]] || exit 1
exit 0
