![Archmox Logo](https://raw.githubusercontent.com/archmox/.github/main/archmox-logo.svg)

# Open Source Virtualization Stack for Arch Linux

**Note**: Archmox is a port of the Proxmox virtualization stack onto Arch Linux via Hyperbola GNU/Linux-libre base, with LTS kernels sourced from Arch Linux. This is a community project and is not affiliated with Proxmox Server Solutions GmbH.

## About

Archmox brings the power of Proxmox VE, Proxmox Backup Server, and Proxmox Mail Gateway to the Arch Linux ecosystem. By leveraging Hyperbola GNU/Linux-libre as a stable, LTS-focused base and grafting Arch Linux's LTS kernel with Proxmox patches, we get:

- **Enterprise-grade virtualization** (KVM + LXC)
- **Software-defined storage** (ZFS, Ceph, LVM)
- **High-availability clustering** (Corosync + HA Manager)
- **Content-addressable backup** (Proxmox Backup Server)
- **All on pacman** — PKGBUILDs instead of .deb packages

## How-To Download

Archmox ISOs and binary repositories are available via the [Archmox CDN](https://cdn.archmox.org/). See the [releases page](https://github.com/archmox/iso/releases) for the latest builds.

## How-To Contribute

Archmox is a community-driven port. We accept pull requests and use GitHub for development. Check our [Contributing Guide](https://github.com/archmox/meta/blob/main/CONTRIBUTING.md) for details.

Key areas needing help:
- Porting Perl modules from Debian paths to Arch paths
- Converting debian/rules to PKGBUILDs
- Adapting pve-installer for archiso
- Testing on bare metal

## Get Support

- **Community Forum**: [https://forum.archmox.org/](https://forum.archmox.org/)
- **Matrix Chat**: [#archmox:matrix.org](https://matrix.to/#/#archmox:matrix.org)
- **Mailing List**: [archmox-dev@lists.archmox.org](mailto:archmox-dev@lists.archmox.org)

## How-To Report Bugs or Request Features

Please file bugs and feature requests in the appropriate component repository's issue tracker. If you're unsure which repository, use the [meta issue tracker](https://github.com/archmox/meta/issues).

## How-To Report Security Issues

Report security vulnerabilities to **<security@archmox.org>**. Please encrypt sensitive reports using our [Security GPG Key](https://archmox.org/security.gpg).

## Documentation

- **Archmox VE**: [https://pve.archmox.org/docs/](https://pve.archmox.org/docs/)
- **Archmox Backup Server**: [https://pbs.archmox.org/docs/](https://pbs.archmox.org/docs/)
- **Archmox Mail Gateway**: [https://pmg.archmox.org/docs/](https://pmg.archmox.org/docs/)
- **Porting Guide**: [https://docs.archmox.org/porting/](https://docs.archmox.org/porting/)

## Code License & Trademark

Archmox is 100% Open Source, released under the [GNU Affero General Public License, version 3](https://www.gnu.org/licenses/agpl-3.0.html) or similar FOSS licenses — mirroring Proxmox's licensing.

Proxmox® is a registered trademark of Proxmox Server Solutions GmbH. Archmox is an independent community project and is not endorsed by or affiliated with Proxmox Server Solutions GmbH.

Archmox® is a pending trademark of the Archmox project.
