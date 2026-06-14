#!/usr/bin/env bash
#============================================================================
# build-all.sh — Build all Archmox packages in dependency order
#============================================================================
set -euo pipefail

readonly SELF="$(realpath "$0")"
readonly ROOT="$(realpath "${SELF}/../..")"
readonly LOGDIR="${ROOT}/logs"
readonly BUILDDIR="${ROOT}/build"
readonly REPODIR="${ROOT}/repo"
readonly MAKEFLAGS="${MAKEFLAGS:--j$(nproc)}"

export MAKEFLAGS

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

#--------------------------------------------------------------------------
# Package groups listed in strict dependency order
#--------------------------------------------------------------------------
CORE_PKGS=(
  proxmox-rs
  pve-common
  proxmox-widget-toolkit
  proxmox-i18n
  pve-eslint
  pve-jslint
)

PVE_PKGS=(
  pve-access-control
  pve-cluster
  pve-storage
  pve-firewall
  pve-guest-common
  pve-ha-manager
  pve-network
  pve-http-server
  pve-container
  qemu-server
  pve-edk2-firmware
  pve-xtermjs
  pve-zsync
  pve-lxc-syscalld
  pve-sheepdog
  proxmox-yew-comp
  proxmox-datacenter-manager
  pve-docs
  pve-installer
  pve-manager
  proxmox-ve
)

PBS_PKGS=(
  pxar
  proxmox-fuse-rs
  proxmox-backup
  proxmox-backup-qemu
)

PMG_PKGS=(
  pmg-api
  pmg-gui
  pmg-docs
)

INFRA_PKGS=(
  libiscsi
  lvm
  lxc
  zfs
  ksm-control-daemon
  pve-libspice-server
  pve-firmware
  vncterm
  spiceterm
  corosync-pve
  corosync-qdevice
  openvswitch
  redhat-cluster-pve
  gfs2-utils
  fence-agents-pve
  resource-agents-pve
  ceph
  qemu
  dab
  dab-pve-appliances
  libgtk3-webkit-perl
  proxmox-firewall
)

#--------------------------------------------------------------------------
# Helper functions
#--------------------------------------------------------------------------
log()    { echo -e "${GREEN}[BUILD]${NC} $*"; }
warn()   { echo -e "${YELLOW}[WARN]${NC} $*" >&2; }
error()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }
info()   { echo -e "${CYAN}[INFO]${NC} $*"; }

_pkgdir_to_cat() {
  local name="$1"
  case "$name" in
    proxmox-rs|pve-common|proxmox-widget-toolkit|proxmox-i18n|pve-eslint|pve-jslint)
      echo "core" ;;
    pxar|proxmox-fuse-rs|proxmox-backup|proxmox-backup-qemu)
      echo "pbs" ;;
    pmg-api|pmg-gui|pmg-docs)
      echo "pmg" ;;
    libiscsi|lvm|lxc|zfs|ksm-control-daemon|pve-libspice-server|pve-firmware|vncterm|spiceterm|corosync-pve|corosync-qdevice|openvswitch|redhat-cluster-pve|gfs2-utils|fence-agents-pve|resource-agents-pve|ceph|qemu|dab|dab-pve-appliances|libgtk3-webkit-perl|proxmox-firewall)
      echo "infra" ;;
    *)
      echo "pve" ;;
  esac
}

build_package() {
  local pkgname="$1"
  local category
  category="$(_pkgdir_to_cat "$pkgname")"
  local pkgdir="${ROOT}/packages/${category}/${pkgname}"

  if [[ ! -f "${pkgdir}/PKGBUILD" ]]; then
    error "PKGBUILD not found for ${pkgname} (${pkgdir})"
    return 1
  fi

  log ":: Building ${pkgname}..."
  mkdir -p "${LOGDIR}" "${BUILDDIR}"

  # Copy source into build directory to avoid polluting the repo
  local build_dir="${BUILDDIR}/${pkgname}"
  rm -rf "${build_dir}"
  mkdir -p "${build_dir}"
  cp -a "${pkgdir}/PKGBUILD" "${build_dir}/"

  # Symlink or copy any helper files if they exist
  if [[ -d "${pkgdir}/src" ]]; then
    cp -a "${pkgdir}/src" "${build_dir}/"
  fi

  pushd "${build_dir}" >/dev/null 2>&1

  # Build with makepkg
  if makepkg -s --noconfirm 2>&1 | tee "${LOGDIR}/${pkgname}.log"; then
    popd >/dev/null 2>&1
    # Install the resulting package
    local pkgfile
    pkgfile="$(find "${build_dir}" -name '*.pkg.tar.zst' -type f 2>/dev/null | head -1)"
    if [[ -n "${pkgfile}" ]]; then
      mkdir -p "${REPODIR}"
      cp "${pkgfile}" "${REPODIR}/"
      log "${pkgname} built successfully → ${REPODIR}/$(basename "${pkgfile}")"
    else
      warn "${pkgname}: no .pkg.tar.zst found (might be a metapackage)"
    fi
    return 0
  else
    popd >/dev/null 2>&1
    error "${pkgname} BUILD FAILED! Check ${LOGDIR}/${pkgname}.log"
    return 1
  fi
}

#--------------------------------------------------------------------------
# Main build orchestration
#--------------------------------------------------------------------------
main() {
  local skip_failures=false
  local start_from=""
  local only_pkg=""

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --skip-failures) skip_failures=true ;;
      --from) start_from="$2"; shift ;;
      --only) only_pkg="$2"; shift ;;
      --help|-h)
        echo "Usage: $0 [--skip-failures] [--from <pkgname>] [--only <pkgname>]"
        exit 0
        ;;
      *) error "Unknown option: $1"; exit 1 ;;
    esac
    shift
  done

  # Build all package groups in order
  local all_pkgs=()
  all_pkgs+=("${CORE_PKGS[@]}" "${PVE_PKGS[@]}" "${PBS_PKGS[@]}" "${PMG_PKGS[@]}" "${INFRA_PKGS[@]}")

  local started=false
  [[ -z "${start_from}" ]] && started=true

  info "=========================================="
  info " Archmox Build Script"
  info " Logs:      ${LOGDIR}"
  info " Packages:  ${REPODIR}"
  info " Skip fail: ${skip_failures}"
  info " Start at:  ${start_from:-<beginning>}"
  info " Only:      ${only_pkg:-<all>}"
  info "=========================================="
  echo

  for pkg in "${all_pkgs[@]}"; do
    # --from filtering
    if [[ -n "${start_from}" && "${started}" == false ]]; then
      if [[ "${pkg}" == "${start_from}" ]]; then
        started=true
      else
        continue
      fi
    fi

    # --only filtering
    if [[ -n "${only_pkg}" && "${pkg}" != "${only_pkg}" ]]; then
      continue
    fi

    if ! build_package "${pkg}"; then
      if [[ "${skip_failures}" == true ]]; then
        warn "${pkg} failed, continuing..."
        continue
      else
        error "Build aborted. ${pkg} failed."
        exit 1
      fi
    fi
  done

  # Update repo database
  if [[ -d "${REPODIR}" ]]; then
    log "Updating repository database..."
    bash "${ROOT}/scripts/ci/repo-add.sh"
  fi

  info "=========================================="
  info " All builds complete!"
  info "=========================================="
}

main "$@"
