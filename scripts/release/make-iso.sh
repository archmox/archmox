#!/usr/bin/env bash
#============================================================================
# make-iso.sh — Build an Archmox installation ISO using archiso
#============================================================================
set -euo pipefail

readonly SELF="$(realpath "$0")"
readonly ROOT="$(realpath "${SELF}/../..")"
readonly ISODIR="${ROOT}/iso"
readonly BUILDDIR="${ROOT}/build/iso"
readonly OUTDIR="${ROOT}/out"
readonly LOGDIR="${ROOT}/logs"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

log()    { echo -e "${GREEN}[ISO]${NC} $*"; }
warn()   { echo -e "${YELLOW}[WARN]${NC} $*" >&2; }
error()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }
info()   { echo -e "${CYAN}[INFO]${NC} $*"; }

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Build an Archmox installation ISO.

Options:
  --clean       Remove old build artifacts before building
  --out <dir>   Output directory for the ISO (default: ${OUTDIR})
  --label <str> ISO volume label (default: ARCHMOX_YYYYMMDD)
  --no-build    Skip building packages, use existing repo/
  --help, -h    Show this help

Environment:
  ARCHMOX_VERSION  Override the version string embedded in the ISO
EOF
  exit 0
}

check_dependencies() {
  local missing=()
  for cmd in mkarchiso pacman makepkg; do
    if ! command -v "${cmd}" &>/dev/null; then
      missing+=("${cmd}")
    fi
  done

  # Check for archiso
  if ! pacman -Qi archiso &>/dev/null 2>&1; then
    missing+=("archiso (package)")
  fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    error "Missing dependencies: ${missing[*]}"
    info "Install them with: sudo pacman -S archiso"
    exit 1
  fi
}

prepare_build_directory() {
  local clean="$1"
  if [[ "${clean}" == true ]]; then
    log "Cleaning old build artifacts..."
    rm -rf "${BUILDDIR}"
  fi

  mkdir -p "${BUILDDIR}" "${OUTDIR}" "${LOGDIR}"
}

setup_archiso_profile() {
  log "Setting up archiso profile from ${ISODIR}/archiso..."

  # Copy the archiso profile to the build directory
  if [[ -d "${BUILDDIR}/archlive" ]]; then
    rm -rf "${BUILDDIR}/archlive"
  fi
  cp -a "${ISODIR}/archiso" "${BUILDDIR}/archlive"

  # Generate version file
  local version="${ARCHMOX_VERSION:-$(date +%Y%m%d)}"
  echo "${version}" > "${BUILDDIR}/archlive/airootfs/root/.archmox_version"

  # Copy airootfs customization if present
  if [[ -d "${ISODIR}/airootfs" ]]; then
    rsync -a "${ISODIR}/airootfs/" "${BUILDDIR}/archlive/airootfs/"
  fi

  # Set ISO volume label
  local label="${1:-ARCHMOX_${version}}"
  sed -i "s/^iso_label=.*\$/iso_label=\"${label}\"/" \
    "${BUILDDIR}/archlive/build.sh" 2>/dev/null || true
  echo "${label}" > "${BUILDDIR}/archlive/iso_label"
}

include_packages() {
  log "Including Archmox packages in ISO..."

  local repo_dir="${ROOT}/repo"
  local pacman_conf="${BUILDDIR}/archlive/pacman.conf"

  if [[ ! -d "${repo_dir}" ]]; then
    warn "No repo directory found at ${repo_dir}. Building packages first..."
    bash "${ROOT}/scripts/ci/build-all.sh"
  fi

  local pkg_count
  pkg_count="$(find "${repo_dir}" -maxdepth 1 -name '*.pkg.tar.zst' -type f | wc -l)"
  info "Found ${pkg_count} packages to include"

  if [[ "${pkg_count}" -gt 0 ]]; then
    # Create a local repo inside the archiso airootfs
    local airootfs_repo="${BUILDDIR}/archlive/airootfs/opt/archmox-repo"
    mkdir -p "${airootfs_repo}"

    cp "${repo_dir}"/*.pkg.tar.zst "${airootfs_repo}/" 2>/dev/null || true
    if ls "${repo_dir}"/*.sig &>/dev/null 2>&1; then
      cp "${repo_dir}"/*.sig "${airootfs_repo}/" 2>/dev/null || true
    fi

    # Create repo database for the offline repo
    repo-add "${airootfs_repo}/archmox.db.tar.zst" \
      "${airootfs_repo}"/*.pkg.tar.zst 2>/dev/null || true

    # Add the local repo to the archiso pacman.conf
    cat >> "${pacman_conf}" <<-EOF

[archmox]
SigLevel = Optional TrustAll
Server = file:///opt/archmox-repo
EOF
  fi

  # Ensure essential packages are in the package list
  local pkglist_file="${BUILDDIR}/archlive/packages.x86_64"
  if [[ -f "${pkglist_file}" ]]; then
    {
      echo "archmox-proxmox-ve"
      echo "archmox-pve-manager"
      echo "archmox-qemu-server"
      echo "archmox-pve-container"
      echo "archmox-pve-storage"
      echo "archmox-pve-cluster"
      echo "archmox-pve-firewall"
      echo "archmox-pve-ha-manager"
      echo "archmox-proxmox-backup"
      echo "proxmox-archive-keyring"
    } >> "${pkglist_file}"
  fi
}

build_iso() {
  log "Building ISO with mkarchiso..."
  mkdir -p "${LOGDIR}"

  if mkarchiso -v -w "${BUILDDIR}/work" -o "${OUTDIR}" \
    "${BUILDDIR}/archlive" 2>&1 | tee "${LOGDIR}/mkarchiso.log"; then
    log "ISO built successfully!"
    info "Output: ${OUTDIR}"
    # Show the generated ISO file
    ls -lh "${OUTDIR}"/*.iso 2>/dev/null || true
  else
    error "ISO build failed. Check ${LOGDIR}/mkarchiso.log"
    exit 1
  fi
}

post_processing() {
  # Compute checksums for the ISO
  local iso_file
  iso_file="$(ls -t "${OUTDIR}"/*.iso 2>/dev/null | head -1)"
  if [[ -n "${iso_file}" ]]; then
    log "Computing checksums..."
    cd "${OUTDIR}"
    sha256sum "$(basename "${iso_file}")" > "${iso_file}.sha256"
    md5sum "$(basename "${iso_file}")" > "${iso_file}.md5"
    log "Checksums written."
    cat "${iso_file}.sha256"
  fi
}

#--------------------------------------------------------------------------
# Main
#--------------------------------------------------------------------------
main() {
  local clean=false
  local label=""
  local skip_build=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --clean)    clean=true ;;
      --out)      OUTDIR="$2"; shift ;;
      --label)    label="$2"; shift ;;
      --no-build) skip_build=true ;;
      --help|-h)  usage ;;
      *)          warn "Unknown: $1"; usage ;;
    esac
    shift
  done

  check_dependencies
  prepare_build_directory "${clean}"

  if [[ "${skip_build}" == false ]] && [[ "${clean}" == true ]]; then
    log "Building all packages before ISO generation..."
    bash "${ROOT}/scripts/ci/build-all.sh"
  fi

  setup_archiso_profile "${label:-}"
  include_packages
  build_iso
  post_processing

  info "=========================================="
  info " ISO build complete!"
  info " Output: ${OUTDIR}"
  info "=========================================="
}

main "$@"
