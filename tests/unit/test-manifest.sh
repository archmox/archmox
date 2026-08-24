#!/usr/bin/env bash
# test-manifest.sh — meta/manifests/stack-manifest.yaml must match reality:
# every package directory on disk is listed, nothing extra, and the build
# order in scripts/ci/build-all.sh covers exactly those packages.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MANIFEST="${ROOT}/meta/manifests/stack-manifest.yaml"
BUILD_ALL="${ROOT}/scripts/ci/build-all.sh"

errors=0

manifest_names() {
  grep -oE '^\s*- \{name: [a-z0-9-]+' "${MANIFEST}" | awk -F'name: ' '{print $2}'
}

disk_names() {
  find "${ROOT}/packages" -mindepth 2 -maxdepth 2 -type d -printf '%f\n' | sort
}

# 1) Manifest vs disk
diff_out="$(comm -3 \
  <(manifest_names | sort) \
  <(disk_names))"
if [[ -n "${diff_out//[[:space:]]}" ]]; then
  echo "  ✗ manifest/disk mismatch:"
  echo "${diff_out}" | sed 's/^/      /'
  errors=$((errors + 1))
fi

# 2) Manifest vs build order in build-all.sh
array_pkgs="$(grep -oE '^  [a-z0-9-]+$' "${BUILD_ALL}" | tr -d ' ' | sort -u)"
build_missing="$(comm -23 <(disk_names) <(echo "${array_pkgs}"))"
if [[ -n "${build_missing}" ]]; then
  echo "  ✗ packages missing from build-all.sh ordering:"
  echo "${build_missing}" | sed 's/^/      /'
  errors=$((errors + 1))
fi

# 3) Upstream URLs must look like git remotes (metapackages exempt)
url_pattern='^(https|git\+https)://[^[:space:]"]+\.git$'
while IFS= read -r line; do
  name="${line%%|*}"
  upstream="${line#*|}"
  [[ "${upstream}" == "metapackage" ]] && continue
  if [[ ! "${upstream}" =~ ${url_pattern} ]]; then
    echo "  ✗ ${name}: suspicious upstream '${upstream}'"
    errors=$((errors + 1))
  fi
done < <(grep -oE 'name: [a-z0-9-]+.*upstream: [^,]+' "${MANIFEST}" \
          | sed -E 's/name: ([a-z0-9-]+).*upstream: (.*)/\1|\2/' | tr -d '"')

total="$(disk_names | wc -l)"
if [[ ${errors} -gt 0 ]]; then
  echo "FAILED with ${errors} error(s) across ${total} packages."
  exit 1
fi
echo "Manifest consistent with ${total} package directories and build order."
exit 0
