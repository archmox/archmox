#!/usr/bin/env bash
# test-scripts.sh — syntax-check every shell script in the repository
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
errors=0
count=0

while IFS= read -r -d '' script; do
  count=$((count + 1))
  if ! bash -n "${script}" 2>/dev/null; then
    echo "  ✗ ${script#${ROOT}/}: syntax error"
    errors=$((errors + 1))
  fi
done < <(find "${ROOT}" \
  -path "${ROOT}/.git" -prune -o \
  \( -name '*.sh' -o -name 'profiledef.sh' \) -type f -print0)

echo "Syntax-checked ${count} shell scripts."
exit $((errors > 0 ? 1 : 0))
