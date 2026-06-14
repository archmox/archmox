# PVE Porting Guide: Debian to Arch Linux PKGBUILDs

## Overview

The Proxmox Virtual Environment (PVE) stack consists of approximately 50 interconnected packages spanning Perl modules, Rust crates, JavaScript frontends, and C system tools. Porting from the Debian `deb` packaging format to Arch Linux `PKGBUILD` format requires careful attention to dependency resolution, file system layout differences, and build system adaptation.

This guide documents the process of converting each PVE component into an `archmox-` prefixed PKGBUILD that builds cleanly on Arch Linux using Hyperbola GNU/Linux-libre as a stable LTS base with the Arch Linux LTS kernel carrying Proxmox patches.

## Package Inventory

The PVE packages are organized into four dependency tiers:

### Core Packages (6)
These must be built first as they provide the foundation for all other components:

- **proxmox-rs** — Rust core library providing low-level primitives (toolkit, REST server, API schema, compiler utilities). Builds with `cargo` and produces several shared libraries.
- **pve-common** — Perl library of shared utility functions used by every PVE daemon. Includes configuration file parsing, locking primitives, and system command wrappers.
- **proxmox-widget-toolkit** — ExtJS-based web UI widgets and components. A pure JavaScript package installed into the web server root.
- **proxmox-i18n** — Internationalization data files for the Proxmox web interface. Contains translation dictionaries for all supported languages.
- **pve-eslint** / **pve-jslint** — JavaScript linting tools used during the build of other packages.

### PVE Packages (22)
These form the main virtualization platform, listed in build order within the group:

| Package | Type | Dependencies | Porting Notes |
|---------|------|--------------|---------------|
| `pve-access-control` | Perl | pve-common, openssl, perl-crypt | Authentication realms, PAM, LDAP, TOTP 2FA |
| `pve-cluster` | Perl/C | pve-access-control, corosync, libqb | Cluster filesystem on pmxcfs |
| `pve-storage` | Perl | pve-common, LVM, ZFS, Ceph | Storage plugin architecture |
| `pve-firewall` | Perl | pve-common, iptables-nft, conntrack | nftables-based firewall management |
| `pve-guest-common` | Perl | pve-storage, pve-firewall | Guest VM abstraction layer |
| `pve-ha-manager` | Perl | pve-cluster, corosync | CRM and LRM for HA |
| `pve-network` | Perl | pve-common, Open vSwitch | SDN with VXLAN/VLAN |
| `pve-http-server` | Perl | pve-common, AnyEvent | HTTP/HTTPS daemon for API |
| `pve-container` | Perl | pve-guest-common, LXC, lxcfs | LXC container management |
| `qemu-server` | Perl | pve-guest-common, qemu, swtpm | KVM/QEMU VM management |
| `pve-edk2-firmware` | Package | OVMF | UEFI firmware blobs |
| `pve-xtermjs` | JS | xterm.js | Web terminal emulator |
| `pve-zsync` | Perl | pve-common, ZFS | ZFS snapshot replication |
| `pve-lxc-syscalld` | C | LXC | LXC syscall daemon |
| `pve-sheepdog` | Package | Sheepdog | Distributed block storage |
| `proxmox-yew-comp` | Rust | wasm-bindgen | Yew-based web components |
| `proxmox-datacenter-manager` | Rust | proxmox-rs | Multi-datacenter management |
| `pve-docs` | HTML | — | Documentation files |
| `pve-installer` | Shell | archiso | Installation ISO integration |
| `pve-manager` | Perl | All above | Main management daemon and UI |
| `proxmox-ve` | Meta | All PVE packages | Virtual package pulling in full stack |

### Infrastructure Packages (23)
Third-party and system-level packages with Proxmox patches:

- **zfs** — ZFS on Linux with Proxmox-specific tuning patches
- **ceph** — Ceph distributed storage (Pacific/Quincy releases)
- **corosync-pve** — Corosync cluster engine with PVE modifications
- **qemu** — QEMU full system emulator with Proxmox PCI/SPICE patches
- **lxc** — Linux Containers with PVE integration patches
- **lvm** — LVM2 with thin provisioning support
- **openvswitch** — Open vSwitch for SDN
- **vncterm/spiceterm** — Terminal emulators for VNC/SPICE console access
- **ksm-control-daemon** — Kernel Same-page Merging management
- **fence-agents-pve** — STONITH fence agents
- **resource-agents-pve** — Pacemaker resource agents
- And others in `packages/infra/`

## Porting Strategy

### 1. PKGBUILD Template

Each port follows this general pattern:

```bash
# Maintainer: Archmox Team <dev@archmox.acreetionos.org>

pkgname=archmox-<upstream-name>
pkgver=1.0.0
pkgrel=1
pkgdesc="<description> - ported for Arch Linux"
arch=('x86_64')
url="https://archmox.acreetionos.org"
license=('AGPL3')
depends=('archmox-pve-common' ...)
makedepends=('make' 'gcc' ...)
source=("https://github.com/archmox/archmox/archive/v${pkgver}.tar.gz")
sha256sums=('SKIP')

build() {
  cd "${srcdir}/archmox-${pkgver}/packages/pve/<pkgname>"
  make
}

package() {
  cd "${srcdir}/archmox-${pkgver}/packages/pve/<pkgname>"
  make DESTDIR="${pkgdir}" install
  install -Dm644 LICENSE "${pkgdir}/usr/share/licenses/${pkgname}/LICENSE"
}
```

### 2. Perl Module Path Mapping

Debian installs Perl modules under `/usr/share/perl5/` while Arch Linux uses `$(perl -V:vendorarch)` and `$(perl -V:vendorlib)`. The `Makefile.PL` files in Proxmox packages use `DESTDIR`-based installation, so the makefiles must be patched to use the Arch Perl vendor directories.

Key mapping:
- `/usr/lib/perl5/` → `/usr/lib/perl5/vendor_perl/`
- `/usr/share/perl5/` → `/usr/share/perl5/vendor_perl/`
- Debian's `perl-base` → Arch's `perl` package

### 3. Systemd Service Adaptation

Debian packages ship SysV init scripts in `/etc/init.d/` alongside systemd service files. Arch Linux uses only systemd. The service files are placed in `/usr/lib/systemd/system/` and activated via `systemctl enable --now`.

Key PVE services:
- `pveproxy.service` — HTTPS API proxy (nginx reverse proxy to pvedaemon)
- `pvedaemon.service` — Main PVE API daemon
- `pvestatd.service` — Status collector daemon
- `pve-cluster.service` — pmxcfs cluster filesystem
- `pve-ha-crm.service` — HA Cluster Resource Manager
- `pve-ha-lrm.service` — HA Local Resource Manager
- `pve-lxc-syscalld.service` — LXC syscall daemon
- `pve-firewall.service` — Firewall update daemon
- `corosync.service` — Corosync cluster engine
- `zfs-import-cache.service`, `zfs-mount.service`, `zfs-zed.service` — ZFS services
- `postgresql.service` — PostgreSQL for PBS

### 4. Configuration Paths

Proxmox uses a FUSE-based clustered filesystem (`pmxcfs`) mounted at `/etc/pve/`. This is the central configuration store:

```
/etc/pve/
  ├── corosync.conf          # Cluster configuration
  ├── datacenter.cfg         # Datacenter-wide settings
  ├── nodes/
  │   └── <hostname>/
  │       ├── qemu-server/   # VM configuration files (<vmid>.conf)
  │       ├── lxc/           # Container config files (<vmid>.conf)
  │       └── pve-ssl.pem    # Node SSL certificate
  ├── storage.cfg            # Storage configuration
  ├── user.cfg               # User and permission data
  ├── virtual-guest/         # Guest migration state
  ├── firewall/              # Cluster firewall rules
  └── ha/                    # HA resource configuration
```

On Arch Linux, `pmxcfs` still mounts to `/etc/pve/`. The PKGBUILD must ensure the filesystem is available by building `pve-cluster` with FUSE support and enabling the `pve-cluster.service`.

### 5. Web UI Assets

The PVE web interface is built with ExtJS and custom JavaScript components. Assets are installed to `/usr/share/pve-manager/` and served by `pveproxy` (nginx reverse proxy). The JavaScript build pipeline:

1. ExtJS framework → extracted to `/usr/share/javascript/extjs/`
2. Widget toolkit → `/usr/share/pve-manager/toolkit/`
3. pve-manager UI → `/usr/share/pve-manager/ext6/`
4. Custom CSS → compiled from Sass to `/usr/share/pve-manager/css/`

The `proxmox-widget-toolkit` and `pve-manager` packages each run a `make` step that invokes the Sencha CMD build tool (ported separately) to compile the ExtJS application.

### 6. Dependency Resolution Order

The build script at `scripts/ci/build-all.sh` enforces the correct build order. The dependency graph is:

```
Core (6) → PVE (22) → Infra (23)
```

Within PVE:
```
pve-access-control → pve-cluster → pve-storage → pve-firewall
                                                        ↓
pve-guest-common ←───────────────────────────────────────┘
    ↓
pve-container, qemu-server → pve-ha-manager
    ↓
pve-manager → proxmox-ve (metapackage)
```

Infrastructure packages should be built before PVE packages since they provide runtime dependencies (ZFS, Ceph, QEMU, Corosync, LXC):

```
zfs, lvm, ceph → pve-storage
corosync-pve → pve-cluster, pve-ha-manager
qemu → qemu-server
lxc → pve-container
```

## Common Pitfalls

### Debian-Specific Build Dependencies
Debian packages often depend on `dh-make-perl`, `debhelper`, `dctrl-tools`, and other Debian-specific tools. These must be replaced with their Arch counterparts or the build logic must be rewritten to use `makepkg` natively.

### Perl Module Availability
Some Perl modules that exist as Debian packages (`libcrypt-openssl-rsa-perl`) may have different names or versions in the Arch User Repository (AUR). Create an auxiliary PKGBUILD or use `cpanminus` to install missing modules.

### Kernel Module Dependencies
ZFS and OVS require kernel modules that must match the running kernel version. On Arch Linux LTS kernels (`linux-lts`), ensure the matching DKMS or prebuilt module packages are available.

### Patch Application
Proxmox applies patches to upstream packages (Corosync, QEMU, LXC). These patches live in `packages/infra/<pkgname>/`. The PKGBUILD must apply these patches before building using the `prepare()` function.

## Verification

After building all packages, verify correctness by:

1. Running `makepkg --check` where a `check()` function is defined
2. Installing packages in a Docker container or VM
3. Enabling services with `systemctl daemon-reload && systemctl enable --now <service>`
4. Confirming `pmxcfs` mounts at `/etc/pve/`
5. Accessing the web UI at `https://<hostname>:8006/`
6. Running `pveversion -v` to verify all package versions

## References

- [Arch Linux PKGBUILD Reference](https://wiki.archlinux.org/title/PKGBUILD)
- [Arch Linux Perl Package Guidelines](https://wiki.archlinux.org/title/Perl_package_guidelines)
- [Proxmox VE Source Code](https://git.proxmox.com/)
- [Archmox Build Script](https://github.com/archmox/archmox/blob/main/scripts/ci/build-all.sh)
