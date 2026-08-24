#!/usr/bin/env bash
# .archmox-firstboot.sh — one-shot runtime setup for Archmox systems.
# Runs via archmox-firstboot.service on every boot; exits quickly when
# nothing needs doing. Safe on both live media and installed systems.
set -euo pipefail

MARKER=/var/lib/archmox/.firstboot-done

log() { echo "[archmox-firstboot] $*"; }

# PVE directory layout expected by the stack
install -d -m 755 /etc/pve /var/lib/pve /var/log/pve
install -d -m 755 /var/lib/vz/images /var/lib/vz/dump \
                  /var/lib/vz/template/cache /var/lib/vz/template/iso

if [[ -e "${MARKER}" ]]; then
  exit 0
fi

log "performing first-boot initialization"

# Locale generation if not done yet
if [[ -f /etc/locale.gen ]] && ! locale -a 2>/dev/null | grep -qi 'en_US.utf8'; then
  locale-gen || true
fi

# Fresh SSH host keys for installed systems
if [[ ! -e /etc/ssh/ssh_host_ed25519_key ]] && command -v ssh-keygen >/dev/null; then
  ssh-keygen -A || true
fi

mkdir -p "$(dirname "${MARKER}")"
date -u +%Y-%m-%dT%H:%M:%SZ > "${MARKER}"
log "done"
