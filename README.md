# Archmox

**Open Source Virtualization Stack for Arch Linux — sponsored by the AcreetionOS Project**

Archmox ports the Proxmox ecosystem — Proxmox VE (virtualization), Proxmox Backup
Server (backup), and Proxmox Mail Gateway (mail filtering) — to run natively on
Arch Linux. Everything is packaged as PKGBUILDs, distributed through a binary
pacman repository, and installable from a bootable ISO.

## Status

Work in progress. Packaging definitions, build tooling, CI, and documentation are
in place; package sources are pulled from their upstream repositories at build
time. See [docs/architecture/overview.md](docs/architecture/overview.md) for the
full stack architecture.

## Repository Layout

| Path | Description |
|------|-------------|
| `packages/core/` | Shared Rust/Perl/JS foundations (`proxmox-rs`, `pve-common`, widget toolkit, i18n) |
| `packages/pve/` | Proxmox VE service layer (cluster, storage, firewall, HA, manager, …) |
| `packages/pbs/` | Proxmox Backup Server components |
| `packages/pmg/` | Proxmox Mail Gateway components |
| `packages/infra/` | Infrastructure: QEMU, LXC, ZFS, Ceph, Corosync, OVS, firmware, … |
| `iso/` | archiso profile + airootfs overlay for the installation ISO |
| `kernel/` | Kernel patch series and configs |
| `meta/` | Stack manifests and submodule bookkeeping |
| `scripts/ci/` | Package building and repository database tooling |
| `scripts/release/` | ISO release tooling |
| `tests/` | Unit, integration, and stress test harnesses |
| `docs/` | Architecture docs, manuals, porting guides, API references |
| `website/`, `worker/` | Cloudflare Pages site and API worker |

## Quick Start (Building Packages)

On an Arch Linux machine or container:

```sh
# Install toolchain
sudo pacman -S --needed base-devel git rust cargo cmake

# Build every package in dependency order
bash scripts/ci/build-all.sh

# Or build a single package
bash scripts/ci/build-all.sh --only pve-cluster

# Assemble the local binary repository
bash scripts/ci/repo-add.sh
```

Packages land in `repo/`. To consume them:

```ini
[archmox]
SigLevel = Optional TrustAll
Server = file:///path/to/archmox/repo
```

## Building the ISO

```sh
sudo pacman -S --needed archiso
sudo bash scripts/release/make-iso.sh --clean
```

The installer image is written to `out/`.

## Running Tests

```sh
bash tests/run-tests.sh           # everything that does not need root
sudo bash tests/run-tests.sh      # includes integration checks
```

## Using the Repository

Add to `/etc/pacman.conf`:

```ini
[archmox]
SigLevel = Optional TrustAll
Server = https://cdn.archmox.acreetionos.org/repo/$arch
```

Then:

```sh
pacman -Sy archmox-proxmox-ve
```

## Documentation

- [Architecture Overview](docs/architecture/overview.md)
- [Storage Architecture](docs/architecture/storage.md)
- [Cluster & HA Architecture](docs/architecture/cluster.md)
- [Installation Manual](docs/manuals/installation.md)
- [Configuration Manual](docs/manuals/configuration.md)
- [Maintenance Manual](docs/manuals/maintenance.md)
- [PVE Port Guide](docs/porting-guides/pve-port.md)
- [PBS Port Guide](docs/porting-guides/pbs-port.md)
- [PMG Port Guide](docs/porting-guides/pmg-port.md)

## License

AGPL-3.0 — see [LICENSE](LICENSE). Upstream components retain their original
licenses (AGPL-3.0, GPL-2.0, CDDL, LGPL-2.1, etc.), carried through each package.
