#!/usr/bin/env bash
#============================================================================
# build.sh — Archiso build configuration for Archmox ISO
#============================================================================
# This file is the main archiso build configuration. It is sourced by
# mkarchiso during the ISO build process.

set -euo pipefail

# ISO metadata
iso_name="archmox"
iso_label="ARCHMOX_$(date +%Y%m%d)"
iso_publisher="Archmox Team <dev@archmox.acreetionos.org>"
iso_application="Archmox - Proxmox on Arch Linux"
iso_version="$(cat /root/.archmox_version 2>/dev/null || date +%Y%m%d)"
install_dir="archmox"
bootmodes=('bios.syslinux.mbr' 'bios.syslinux.eltorito' 'uefi-ia32.grub.esp' 'uefi-x64.grub.esp' 'uefi-ia32.grub.eltorito' 'uefi-x64.grub.eltorito')
arch="x86_64"
pacman_conf="pacman.conf"
airootfs_image_type="squashfs"
airootfs_image_tool_options=('-comp' 'zstd' '-Xcompression-level' '15' '-b' '1M')
file_permissions=(
  ["/etc/shadow"]="0:0:400"
  ["/etc/gshadow"]="0:0:400"
  ["/root"]="0:0:750"
  ["/root/.automated_script_setup"]="0:0:755"
  ["/root/customize_airootfs.sh"]="0:0:755"
  ["/var/lib/pve"]="0:0:755"
  ["/etc/pve"]="0:0:755"
)

# Kernel selection
kernel=("linux-lts" "linux-lts-headers")

# Basic packages included in every Archmox installation
packages=(
  # Base system
  "base"
  "base-devel"
  "linux-lts"
  "linux-lts-headers"
  "linux-firmware"
  "amd-ucode"
  "intel-ucode"
  "grub"
  "efibootmgr"
  "shim"
  "sbctl"
  "sudo"
  "openssh"
  "vim"
  "nano"
  "git"
  "wget"
  "curl"

  # Networking
  "networkmanager"
  "dhcpcd"
  "bind"
  "dnsmasq"
  "bridge-utils"
  "openvswitch"
  "ethtool"
  "iproute2"
  "iptables-nft"
  "nftables"
  "conntrack-tools"
  "tcpdump"
  "traceroute"

  # Storage
  "lvm2"
  "btrfs-progs"
  "xfsprogs"
  "e2fsprogs"
  "dosfstools"
  "ntfs-3g"
  "exfatprogs"
  "mdadm"
  "dmraid"
  "parted"
  "gptfdisk"
  "util-linux"
  "cifs-utils"
  "nfs-utils"
  "zfs-utils-dkms"
  "ceph-common"

  # Virtualization
  "qemu-full"
  "qemu-audio-alsa"
  "qemu-audio-pa"
  "qemu-audio-spice"
  "qemu-block-iscsi"
  "qemu-block-rbd"
  "qemu-desktop"
  "qemu-hw-usb-redirect"
  "qemu-ui-spice-core"
  "qemu-ui-vnc"
  "qemu-vhost-user-gpu"
  "lxc"
  "lxcfs"
  "libvirt"
  "edk2-ovmf"
  "swtpm"
  "dmidecode"
  "seabios"

  # Clustering
  "corosync"
  "pacemaker"
  "libqb"
  "crmsh"
  "fence-agents"
  "watchdog"

  # Perl
  "perl"
  "perl-json"
  "perl-libwww"
  "perl-http-message"
  "perl-http-daemon"
  "perl-io-socket-ssl"
  "perl-net-ip"
  "perl-net-dns"
  "perl-net-ssleay"
  "perl-uri"
  "perl-xml-libxml"
  "perl-xml-simple"
  "perl-cgi"
  "perl-crypt-openssl-rsa"
  "perl-crypt-openssl-x509"
  "perl-crypt-ssleay"
  "perl-authen-pam"
  "perl-ldap"
  "perl-template-toolkit"
  "perl-datetime"
  "perl-db-file"
  "perl-file-slurp"
  "perl-filesys-df"
  "perl-linux-inotify2"
  "perl-mailtools"
  "perl-mime-lite"
  "perl-string-shellquote"
  "perl-libintl-perl"
  "perl-module-build"
  "perl-extutils-makemaker"

  # Rust
  "rust"
  "cargo"

  # Node.js / JavaScript
  "nodejs"
  "npm"

  # Database
  "postgresql"
  "postgresql-libs"

  # Web server
  "nginx"

  # Mail
  "postfix"
  "procmail"

  # Monitoring & logging
  "rsyslog"
  "logrotate"
  "systemd-journal-remote"
  "lm_sensors"
  "smartmontools"
  "htop"
  "iotop"
  "iftop"

  # Miscellaneous
  "snapraid"
  "graphviz"
  "dtach"
  "screen"
  "tmux"
  "rsync"
  "sshfs"
  "pv"
  "dialog"
  "squashfs-tools"
  "arch-install-scripts"

  # Proxmox keyring (needed for signature verification)
  "proxmox-archive-keyring"
)

# Non-default packages excluded
packages_exclude=(
  "vi"
  "nano-syntax-highlighting"
)

# Services enabled at boot
services=(
  "NetworkManager"
  "sshd"
  "systemd-resolved"
  "pveproxy"
  "pvedaemon"
  "pvestatd"
  "corosync"
  "pve-cluster"
  "pve-ha-crm"
  "pve-ha-lrm"
  "postgresql"
  "nginx"
  "postfix"
  "smartd"
  "lm_sensors"
  "rsyslog"
  "logrotate.timer"
  "pve-lxc-syscalld"
  "zfs-import-cache"
  "zfs-mount"
  "zfs-zed"
)
