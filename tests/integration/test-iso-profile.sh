#!/usr/bin/env bash
# test-iso-profile.sh — validate the archiso profile structure so that a
# mkarchiso run fails for real reasons, not missing files.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROFILE="${ROOT}/iso/archiso"
errors=0

fail() { echo "  ✗ $*"; errors=$((errors + 1)); }

for f in profiledef.sh packages.x86_64 pacman.conf grub/grub.cfg syslinux/syslinux.cfg; do
  [[ -f "${PROFILE}/${f}" ]] || fail "missing required profile file: ${f}"
done

# profiledef.sh must source cleanly and define the mandatory variables.
# mkarchiso declares these associative/indexed arrays before sourcing the
# profile; mirror that here so assignments behave as in the real build.
VARS_FILE="$(mktemp)"
{
  echo 'SOURCE_DATE_EPOCH=1700000000'
  echo 'ARCHMOX_VERSION=test'
  echo 'declare -A file_permissions=()'
  echo 'declare -a bootmodes=() buildmodes=() airootfs_image_tool_options=() bootstrap_tarball_compression=()'
  cat "${PROFILE}/profiledef.sh"
  echo 'for v in iso_name iso_label iso_publisher iso_application install_dir arch pacman_conf airootfs_image_type; do'
  echo '  eval "val=\${${v}}"; [[ -n "$val" ]] || { echo "MISSING:${v}"; }'
  echo 'done'
} > "${VARS_FILE}"
if out="$(bash "${VARS_FILE}" 2>&1)" && grep -q MISSING <<<"${out}"; then
  fail "profiledef.sh: ${out}"
elif [[ -n "${out}" ]]; then
  fail "profiledef.sh produced unexpected output: ${out}"
fi
rm -f "${VARS_FILE}"

# packages list: non-empty, no duplicate entries, comments/blanks ignored
pkglist="${PROFILE}/packages.x86_64"
[[ -s "${pkglist}" ]] || fail "packages.x86_64 is empty"
dupes="$(grep -vE '^\s*(#|$)' "${pkglist}" | sort | uniq -d)"
[[ -z "${dupes}" ]] || fail "duplicate entries in packages.x86_64: ${dupes}"

# pacman.conf needs core+extra repos and no archmox section committed by hand
grep -q '^\[core\]' "${PROFILE}/pacman.conf" || fail "pacman.conf lacks [core]"
grep -q '^\[extra\]' "${PROFILE}/pacman.conf" || fail "pacman.conf lacks [extra]"
grep -qE '^\[archmox\]' "${PROFILE}/pacman.conf" && \
  fail "pacman.conf must not hardcode [archmox] (make-iso.sh appends it)"

# Bootloader templates carry the mkarchiso substitution tokens
for token in '%INSTALL_DIR%' '%ARCH%'; do
  grep -q "${token}" "${PROFILE}/grub/grub.cfg" || \
    fail "grub.cfg missing ${token} token"
  grep -q "${token}" "${PROFILE}/syslinux/syslinux.cfg" || \
    fail "syslinux.cfg missing ${token} token"
done

# airootfs overlay sanity
[[ -x "${ROOT}/iso/airootfs/root/.archmox-firstboot.sh" ]] || \
  fail ".archmox-firstboot.sh not executable"
[[ -f "${ROOT}/iso/airootfs/etc/systemd/system/archmox-firstboot.service" ]] || \
  fail "archmox-firstboot.service missing"

# Every package must exist in official Arch repos; mkarchiso hard-fails
# otherwise after minutes of work. Validate against a live container when
# docker is available (skipped otherwise).
pkglist="$(grep -vE '^\s*(#|$)' "${PROFILE}/packages.x86_64")"
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  invalid="$(printf '%s\n' "${pkglist}" > /tmp/archmox-pkglist.$$;
    docker run --rm -v /tmp/archmox-pkglist.$$:/tmp/pkgs:ro archlinux:latest bash -c \
      'pacman -Sy -q >/dev/null 2>&1; pacman -Sp --print-format "%n" $(grep -vE "^\s*(#|$)" /tmp/pkgs) 2>&1 >/dev/null' \
    | grep 'target not found' || true)"
  rm -f /tmp/archmox-pkglist.$$
  [[ -z "${invalid}" ]] || fail "packages not in official repos: ${invalid}"
else
  echo "  (docker unavailable — skipping repo-validity check)"
fi

if [[ ${errors} -gt 0 ]]; then
  echo "ISO profile FAILED with ${errors} error(s)."
  exit 1
fi
echo "archiso profile is complete and consistent."
exit 0
