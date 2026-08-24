#!/usr/bin/env bash
# profiledef.sh — mkarchiso profile definition for the Archmox ISO
# This file is sourced by mkarchiso(1). See archiso's releng profile for
# the canonical description of every option.

# shellcheck disable=SC2034

iso_name="archmox"
iso_label="ARCHMOX_$(date --date="@${SOURCE_DATE_EPOCH:-$(date +%s)}" +%Y%m%d)"
iso_publisher="Archmox Team <dev@archmox.acreetionos.org>"
iso_application="Archmox Live/Installation Media (Proxmox stack on Arch Linux)"
iso_version="${ARCHMOX_VERSION:-$(date --date="@${SOURCE_DATE_EPOCH:-$(date +%s)}" +%Y.%m.%d)}"
install_dir="archmox"

buildmodes=('iso')

bootmodes=(
  'bios.syslinux.mbr'
  'bios.syslinux.eltorito'
  'uefi-ia32.grub.esp'
  'uefi-x64.grub.esp'
  'uefi-ia32.grub.eltorito'
  'uefi-x64.grub.eltorito'
)

arch="x86_64"
pacman_conf="pacman.conf"
airootfs_image_type="squashfs"
airootfs_image_tool_options=('-comp' 'zstd' '-Xcompression-level' '15' '-b' '1M')
bootstrap_tarball_compression=('zstd' '-c' '-T0' '--auto-compress' '--long')

file_permissions=(
  ["/etc/shadow"]="0:0:400"
  ["/etc/gshadow"]="0:0:400"
  ["/root"]="0:0:750"
  ["/root/.archmox-firstboot.sh"]="0:0:755"
  ["/var/lib/vz"]="0:0:755"
)
