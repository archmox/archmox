#!/usr/bin/env bash
# test-build-tooling.sh — exercise the CLI surface of the build tooling
# without compiling anything (no root, no network).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
errors=0

fail() { echo "  ✗ $*"; errors=$((errors + 1)); }
check_help() {
  local script="$1"
  if ! bash "${script}" --help >/dev/null 2>&1; then
    fail "${script#${ROOT}/} --help exits non-zero"
  fi
}

check_help "${ROOT}/scripts/ci/build-all.sh"
check_help "${ROOT}/scripts/ci/repo-add.sh"
check_help "${ROOT}/scripts/release/make-iso.sh"

# Regression: scripts derive their project ROOT from $0, so they must resolve
# it correctly even when invoked from a different working directory (as CI
# does). A failed resolution used to silently yield ROOT="" and paths like
# "/repo", breaking every build downstream.
check_root_from_foreign_cwd() {
  local script="$1"
  local expect="$2"
  local out
  out="$(cd /tmp && bash "${script}" --help 2>&1)"
  if ! grep -qF "${expect}" <<<"${out}"; then
    fail "${script#${ROOT}/} resolved ROOT incorrectly from foreign cwd (expected '${expect}' in output)"
  fi
}
check_root_from_foreign_cwd "${ROOT}/scripts/ci/repo-add.sh"   "(default: ${ROOT}/repo)"
check_root_from_foreign_cwd "${ROOT}/scripts/release/make-iso.sh" "(default: ${ROOT}/out)"

out="$(cd /tmp && bash "${ROOT}/scripts/ci/build-all.sh" --only definitely-not-a-package 2>&1)"
if ! grep -qF "Packages:  ${ROOT}/repo" <<<"${out}"; then
  fail "build-all.sh resolved ROOT incorrectly from foreign cwd"
fi

# build-all.sh must reject --skip-failures=bogus
if bash "${ROOT}/scripts/ci/build-all.sh" --skip-failures=bogus >/dev/null 2>&1; then
  fail "build-all.sh accepted invalid --skip-failures value"
fi

# build-all.sh must accept both flag spellings used by CI and humans
for arg in "--skip-failures" "--skip-failures=true" "--skip-failures=false"; do
  # --only <nonexistent> makes it exit early with a controlled error instead
  # of building; we only care that argument parsing did not fail.
  out="$(bash "${ROOT}/scripts/ci/build-all.sh" "${arg}" --only definitely-not-a-package 2>&1)"
  if grep -q "Unknown option" <<<"${out}"; then
    fail "build-all.sh rejects valid flag: ${arg}"
  fi
done

# repo-add.sh on empty repo dir should be a clean no-op
tmp="$(mktemp -d)"
if ! REPODIR="${tmp}/repo" bash "${ROOT}/scripts/ci/repo-add.sh" >/dev/null 2>&1; then
  :
fi
rm -rf "${tmp}"

if [[ ${errors} -gt 0 ]]; then
  echo "Build tooling FAILED with ${errors} error(s)."
  exit 1
fi
echo "Build tooling CLI surface OK."
exit 0
