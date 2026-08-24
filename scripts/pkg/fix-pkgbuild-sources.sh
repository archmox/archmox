#!/usr/bin/env bash
#============================================================================
# fix-pkgbuild-sources.sh — One-shot migration: point every PKGBUILD at its
# real upstream source repository instead of the nonexistent monorepo
# release tarball, normalize cd paths, and clean broken dependency names.
# Kept under scripts/pkg/ so the migration is reproducible/reviewable.
#============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# package_dir_relative -> upstream git URL
declare -A UPSTREAM=(
  [core/proxmox-rs]="https://git.proxmox.com/git/proxmox.git"
  [core/pve-common]="https://git.proxmox.com/git/pve-common.git"
  [core/proxmox-widget-toolkit]="https://git.proxmox.com/git/proxmox-widget-toolkit.git"
  [core/proxmox-i18n]="https://git.proxmox.com/git/proxmox-i18n.git"
  [core/pve-eslint]="https://git.proxmox.com/git/pve-eslint.git"
  [core/pve-jslint]="https://git.proxmox.com/git/pve-jslint.git"
  [infra/libiscsi]="https://github.com/sahlberg/libiscsi.git"
  [infra/lvm]="https://sourceware.org/git/lvm2.git"
  [infra/lxc]="https://github.com/lxc/lxc.git"
  [infra/zfs]="https://github.com/openzfs/zfs.git"
  [infra/ksm-control-daemon]="https://git.proxmox.com/git/ksm-control-daemon.git"
  [infra/pve-libspice-server]="https://gitlab.freedesktop.org/spice/spice.git"
  [infra/pve-firmware]="https://git.proxmox.com/git/pve-firmware.git"
  [infra/vncterm]="https://git.proxmox.com/git/vncterm.git"
  [infra/spiceterm]="https://git.proxmox.com/git/spiceterm.git"
  [infra/corosync-pve]="https://github.com/corosync/corosync.git"
  [infra/corosync-qdevice]="https://git.proxmox.com/git/corosync-qdevice.git"
  [infra/openvswitch]="https://github.com/openvswitch/ovs.git"
  [infra/redhat-cluster-pve]="https://git.proxmox.com/git/redhat-cluster-pve.git"
  [infra/gfs2-utils]="https://git.kernel.org/pub/scm/linux/kernel/git/gfs2/gfs2-utils.git"
  [infra/fence-agents-pve]="https://github.com/ClusterLabs/fence-agents.git"
  [infra/resource-agents-pve]="https://github.com/ClusterLabs/resource-agents.git"
  [infra/ceph]="https://github.com/ceph/ceph.git"
  [infra/qemu]="https://gitlab.com/qemu-project/qemu.git"
  [infra/dab]="https://git.proxmox.com/git/dab.git"
  [infra/dab-pve-appliances]="https://git.proxmox.com/git/dab-pve-appliances.git"
  [infra/libgtk3-webkit-perl]="https://git.proxmox.com/git/libgtk3-webkit-perl.git"
  [infra/proxmox-firewall]="https://git.proxmox.com/git/proxmox-firewall.git"
  [pve/pve-access-control]="https://git.proxmox.com/git/pve-access-control.git"
  [pve/pve-cluster]="https://git.proxmox.com/git/pve-cluster.git"
  [pve/pve-storage]="https://git.proxmox.com/git/pve-storage.git"
  [pve/pve-firewall]="https://git.proxmox.com/git/pve-firewall.git"
  [pve/pve-guest-common]="https://git.proxmox.com/git/pve-guest-common.git"
  [pve/pve-ha-manager]="https://git.proxmox.com/git/pve-ha-manager.git"
  [pve/pve-network]="https://git.proxmox.com/git/pve-network.git"
  [pve/pve-http-server]="https://git.proxmox.com/git/pve-http-server.git"
  [pve/pve-container]="https://git.proxmox.com/git/pve-container.git"
  [pve/qemu-server]="https://git.proxmox.com/git/qemu-server.git"
  [pve/pve-edk2-firmware]="https://git.proxmox.com/git/pve-edk2-firmware.git"
  [pve/pve-xtermjs]="https://git.proxmox.com/git/pve-xtermjs.git"
  [pve/pve-zsync]="https://git.proxmox.com/git/pve-zsync.git"
  [pve/pve-lxc-syscalld]="https://git.proxmox.com/git/pve-lxc-syscalld.git"
  [pve/pve-sheepdog]="https://git.proxmox.com/git/pve-sheepdog.git"
  [pve/proxmox-yew-comp]="https://git.proxmox.com/git/proxmox-yew-comp.git"
  [pve/proxmox-datacenter-manager]="https://git.proxmox.com/git/proxmox-datacenter-manager.git"
  [pve/pve-docs]="https://git.proxmox.com/git/pve-docs.git"
  [pve/pve-installer]="https://git.proxmox.com/git/pve-installer.git"
  [pve/pve-manager]="https://git.proxmox.com/git/pve-manager.git"
  [pve/pve-qemu-kvm]="https://git.proxmox.com/git/pve-qemu-kvm.git"
  [pbs/pxar]="https://git.proxmox.com/git/pxar.git"
  [pbs/proxmox-fuse-rs]="https://git.proxmox.com/git/proxmox-fuse.git"
  [pbs/proxmox-backup]="https://git.proxmox.com/git/proxmox-backup.git"
  [pbs/proxmox-backup-qemu]="https://git.proxmox.com/git/proxmox-backup-qemu.git"
  [pmg/pmg-api]="https://git.proxmox.com/git/pmg-api.git"
  [pmg/pmg-gui]="https://git.proxmox.com/git/pmg-gui.git"
  [pmg/pmg-docs]="https://git.proxmox.com/git/pmg-docs.git"
)

fix_dep_names() {
  local file="$1"
  sed -i \
    -e "s/'proxmox-archive-keyring'//g" \
    -e "s/'libjs-extjs'//g" \
    -e "s/'novnc-pve'//g" \
    -e "s/'libpve-network-perl'/'archmox-pve-network'/g" \
    -e "s/'kernel-headers'/'linux-lts-headers'/g" \
    -e "s/'aio'/'libaio'/g" \
    "$file"
  # collapse any continuation lines left with only whitespace between quotes
  python3 - "$file" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p).read()
# Remove lines that became empty inside depends() arrays like "'',\n" artifacts
s = re.sub(r"\n\s*''", "", s)
open(p, "w").write(s)
PY
}

for rel in "${!UPSTREAM[@]}"; do
  dir="${ROOT}/packages/${rel}"
  pkg="${dir}/PKGBUILD"
  [[ -f "${pkg}" ]] || { echo "missing: ${pkg}" >&2; exit 1; }
  url="${UPSTREAM[$rel]}"
  repo="$(basename "${url}" .git)"

  python3 - "$pkg" "$url" "$repo" <<'PY'
import re, sys

pkg_path, url, repo = sys.argv[1], sys.argv[2], sys.argv[3]
src = open(pkg_path).read()

# 1) Replace tarball source with upstream git source (rolling master).
src = re.sub(
    r'source=\("https://github\.com/archmox/archmox/archive/v\$\{pkgver\}\.tar\.gz"\)',
    f'source=("git+{url}")\n# Rolling port: track upstream master until pinned '
    f'refs are validated.\nsha256sums=(\'SKIP\')',
    src,
)
# Drop any pre-existing sha256sums line following our inserted one
src = re.sub(r"(sha256sums=\('SKIP'\))\nsha256sums=\('SKIP'\)", r"\1", src)

# 2) Point every function into the upstream checkout root (upstream
#    repositories do not use the monorepo's packages/<cat>/<name> layout).
src = re.sub(
    r'"\$\{srcdir\}/archmox-\$\{pkgver\}/packages/[a-z]+/[a-z0-9-]+',
    '"${srcdir}/%s' % repo,
    src,
)

# 3b) Fix indentation of the guarded LICENSE block.
src = src.replace("\nfi\n}", "\n  fi\n}")

# 3) Cargo flags: no vendored deps in upstream checkouts.
src = src.replace("cargo build --release --frozen", "cargo build --release")
src = src.replace("cargo test --release --frozen", "cargo test --release")
src = src.replace('cargo install --root="${pkgdir}/usr" --frozen',
                  'cargo install --locked --root="${pkgdir}/usr" --path .')

# 4) Guard LICENSE installation (not all upstream roots ship LICENSE).
src = src.replace(
    'install -Dm644 LICENSE "${pkgdir}/usr/share/licenses/${pkgname}/LICENSE"',
    'if [[ -f LICENSE ]]; then\n'
    '    install -Dm644 LICENSE '
    '"${pkgdir}/usr/share/licenses/${pkgname}/LICENSE"\n'
    'fi',
)

open(pkg_path, "w").write(src)
print(f"rewrote {pkg_path}")
PY

  fix_dep_names "${pkg}"
done

# proxmox-ve is a pure metapackage: no upstream source to fetch.
cat > "${ROOT}/packages/pve/proxmox-ve/PKGBUILD" <<'EOF'
# Maintainer: Archmox Team <dev@archmox.acreetionos.org>

pkgname=archmox-proxmox-ve
pkgver=1.0.0
pkgrel=1
pkgdesc="Proxmox VE metapackage - installs all PVE components for Arch Linux"
arch=('x86_64')
url="https://archmox.acreetionos.org"
license=('AGPL3')
depends=('archmox-pve-manager' 'archmox-qemu-server' 'archmox-pve-container'
         'archmox-pve-cluster' 'archmox-pve-storage' 'archmox-pve-network'
         'archmox-pve-firewall' 'archmox-pve-ha-manager'
         'archmox-pve-access-control' 'archmox-pve-guest-common'
         'archmox-pve-http-server' 'archmox-pve-docs'
         'archmox-pve-edk2-firmware' 'archmox-pve-xtermjs'
         'archmox-pve-zsync' 'archmox-pve-installer'
         'archmox-pve-lxc-syscalld')

package() {
  install -dm755 "${pkgdir}/usr/share/licenses/${pkgname}"
  cat > "${pkgdir}/usr/share/licenses/${pkgname}/LICENSE" <<'LICENSE'
Archmox Proxmox VE metapackage.
Components carry their own licenses; see each package.
LICENSE
}
EOF
echo "metapackage rewritten: packages/pve/proxmox-ve/PKGBUILD"

echo "All PKGBUILDs updated."
