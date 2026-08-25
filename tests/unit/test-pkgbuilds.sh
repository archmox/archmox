#!/usr/bin/env bash
# test-pkgbuilds.sh — structural validation of every PKGBUILD
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
errors=0
count=0

fail() {
  echo "  ✗ $*"
  errors=$((errors + 1))
}

while IFS= read -r -d '' pkg; do
  count=$((count + 1))
  dir="$(dirname "${pkg}")"
  name="$(basename "${dir}")"

  # Must parse as bash
  if ! bash -n "${pkg}" 2>/dev/null; then
    fail "${name}: syntax error"
    continue
  fi

  # Required fields
  for field in pkgname pkgver pkgrel arch license; do
    grep -qE "^(${field})=" "${pkg}" || fail "${name}: missing ${field}"
  done
  grep -q '^package()' "${pkg}" || fail "${name}: missing package()"

  # Naming convention
  grep -q '^pkgname=archmox-' "${pkg}" || \
    fail "${name}: pkgname must be prefixed with archmox-"

  # Source must come from a real upstream git repo, or an immutable CPAN
  # distribution tarball for vendored Perl leaf modules (metapackages may
  # omit source entirely)
  if grep -q '^source=' "${pkg}"; then
    grep -qE 'source=\("git\+|source=\("https://cpan\.metacpan\.org/' "${pkg}" || \
      fail "${name}: source must use git+ upstream URL or CPAN dist tarball"
    grep -q "archmox/archive" "${pkg}" && \
      fail "${name}: still references nonexistent monorepo tarball"
  fi

  # No monorepo-relative cd paths left behind
  grep -q 'srcdir.*archmox-\${pkgver}' "${pkg}" && \
    fail "${name}: build() still cds into monorepo layout"

done < <(find "${ROOT}/packages" -name PKGBUILD -print0)

echo "Checked ${count} PKGBUILDs."
if [[ ${errors} -gt 0 ]]; then
  echo "FAILED with ${errors} error(s)."
  exit 1
fi
exit 0
