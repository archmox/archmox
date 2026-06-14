# Archmox Stack Architecture Overview

## Introduction

Archmox is a complete, open-source virtualization and infrastructure platform ported from the Proxmox ecosystem to run natively on Arch Linux. It brings the full suite of Proxmox VE (virtualization), Proxmox Backup Server (backup), and Proxmox Mail Gateway (mail filtering) to the Arch Linux ecosystem, packaged entirely as PKGBUILDs and managed via `pacman`.

This document describes the high-level architecture of the Archmox stack, including the layered component model, inter-process communication, storage abstraction, cluster fabric, and security model.

## Architecture Layers

The Archmox stack is organized into five layers:

```
┌──────────────────────────────────────────────────────────┐
│                    Web UI Layer                          │
│  pve-manager (ExtJS)  │  pmg-gui (ExtJS)  │  PBS UI      │
│  proxmox-widget-toolkit  │  proxmox-i18n               │
├──────────────────────────────────────────────────────────┤
│                    API Layer                             │
│  pveproxy (nginx + Perl)  │  pmg-api  │  proxmox-backup  │
│  pvedaemon  │  pve-http-server                         │
├──────────────────────────────────────────────────────────┤
│                 Service Layer                            │
│  pve-cluster (pmxcfs)  │  pve-ha-manager (CRM/LRM)     │
│  pve-firewall  │  pve-container  │  qemu-server         │
│  pve-storage  │  pve-access-control  │  pve-network     │
├──────────────────────────────────────────────────────────┤
│               Infrastructure Layer                       │
│  QEMU/KVM  │  LXC  │  ZFS  │  Ceph  │  Corosync        │
│  LVM  │  Open vSwitch  │  nftables                      │
├──────────────────────────────────────────────────────────┤
│               Operating System Layer                     │
│  Hyperbola GNU/Linux-libre (LTS) + Arch LTS Kernel      │
│  systemd  │  pacman  │  Linux LTS with Proxmox patches  │
└──────────────────────────────────────────────────────────┘
```

### 1. Operating System Layer

The base OS is Hyperbola GNU/Linux-libre, a stable LTS-focused distribution that provides a rock-solid foundation. The kernel is Arch Linux's LTS kernel (`linux-lts`) carrying Proxmox's patches for:

- **ZFS** — Native ZFS support via DKMS or prebuilt modules
- **Corosync** — Cluster heartbeat and membership
- **QEMU/KVM** — PCI passthrough, SPICE optimizations, VFIO
- **LXC** — Container cgroup and namespace management
- **OVS** — Open vSwitch kernel module
- **nftables** — Firewall backend (replacing iptables)

### 2. Infrastructure Layer

This layer provides the building blocks for virtualization, storage, and networking:

- **QEMU/KVM** — Full hardware virtualization with UEFI (OVMF), TPM (swtpm), GPU passthrough (VFIO), and live migration
- **LXC** — OS-level container virtualization with cgroups v2 and namespaces
- **ZFS** — Copy-on-write filesystem with snapshots, replication, and compression
- **Ceph** — Distributed object/RBD storage with self-healing and replication
- **Corosync** — Cluster membership and messaging (totem protocol)
- **LVM** — Logical volume management with thin provisioning
- **Open vSwitch** — Software-defined networking with VXLAN, VLAN, and QinQ
- **nftables** — Packet filtering and NAT

### 3. Service Layer

The service layer consists of the core Proxmox daemons and management components:

- **pve-cluster (pmxcfs)** — FUSE-based clustered configuration filesystem. All cluster nodes share configuration files (datacenter.cfg, storage.cfg, user.cfg, VM configs) through pmxcfs, which uses corosync for distributed locking and replication.

- **pve-ha-manager** — High Availability manager split into two daemons:
  - **CRM** (Cluster Resource Manager) — One leader per cluster that schedules resource placement
  - **LRM** (Local Resource Manager) — Runs on each node to execute local resource operations
  
- **pve-firewall** — Cluster-wide firewall management that generates nftables rules from the centralized configuration in pmxcfs.

- **pve-container** — LXC container lifecycle management (create, start, stop, migrate, snapshot).

- **qemu-server** — QEMU/KVM VM lifecycle management with drive configuration, network interfaces, PCI passthrough, and migration orchestration.

- **pve-storage** — Storage plugin system that abstracts ZFS, Ceph RBD, LVM, NFS, iSCSI, GlusterFS, and directory-based storage.

- **pve-access-control** — Authentication and authorization with support for PAM, LDAP, Active Directory, and TOTP two-factor authentication.

- **pve-network** — Software-defined networking controller for VXLAN, VLAN, QinQ, and BGP EVPN.

### 4. API Layer

The API layer provides RESTful and WebSocket interfaces for all management operations:

- **pveproxy** — Nginx reverse proxy that terminates HTTPS and routes requests to pvedaemon. Handles SSL/TLS, rate limiting, and WebSocket upgrades for console access (VNC, SPICE, xterm.js).

- **pvedaemon** — Perl-based API daemon that implements the PVE REST API. Each API call goes through authentication → authorization → rate limiting → handler execution.

- **pmg-api** — PMG's API daemon for mail gateway management.

- **proxmox-backup** — PBS's Rust-based server with built-in HTTP API (no nginx required).

### 5. Web UI Layer

The web interface is built on ExtJS 6 (Sencha) with custom Proxmox components:

- **proxmox-widget-toolkit** — Base ExtJS widgets and utilities shared across PVE, PBS, and PMG
- **proxmox-i18n** — Internationalization strings for all supported languages
- **PVE Manager UI** — Datacenter overview, node management, VM/CT management, storage, network, firewall, HA, and user administration
- **PBS UI** — Datastore management, backup jobs, verification, remote sync, and tape management
- **PMG UI** — Mail traffic overview, rule management, quarantine, statistics, and user administration

## Inter-Process Communication

### REST API

All management operations go through the REST API. The API is structured as a JSON-RPC-like interface accessed via HTTP/HTTPS:

```
GET    /api2/json/nodes/{node}/qemu          # List VMs on a node
POST   /api2/json/nodes/{node}/qemu          # Create a VM
GET    /api2/json/nodes/{node}/qemu/{vmid}   # Get VM status
POST   /api2/json/nodes/{node}/qemu/{vmid}/status/start  # Start VM
DELETE /api2/json/nodes/{node}/qemu/{vmid}   # Destroy VM
```

API authentication is via:
- **API Tokens** — Long-lived tokens for automation
- **Ticket-based auth** — Session cookies from `POST /api2/json/access/ticket`
- **Two-factor** — TOTP tokens required when enabled

### pmxcfs (Clustered Configuration Filesystem)

pmxcfs is a FUSE filesystem that presents cluster configuration as regular files in `/etc/pve/`. Under the hood:

```
┌─────────────────────────────────────────────────────────┐
│ /etc/pve/ (FUSE mount)                                  │
│                                                         │
│  pve-cluster daemon ←──→ corosync ←──→ other nodes     │
│       │                                                 │
│       ↓                                                 │
│  SQLite database (in-memory + WAL on disk)             │
│       │                                                 │
│       ↓                                                 │
│  libfuse2 → FUSE kernel module → VFS (applications)    │
└─────────────────────────────────────────────────────────┘
```

Key properties:
- **Strong consistency**: All writes go through corosync's distributed consensus
- **File-level locking**: POSIX file locks are translated to distributed locks
- **Read cache**: Frequently read files are cached in memory
- **Journaled writes**: SQLite WAL ensures crash recovery

### IPC Mechanisms

| Mechanism | Use Case | Components |
|-----------|----------|------------|
| REST API | Management operations | UI ↔ API daemons |
| Unix sockets | Local daemon communication | pvedaemon ↔ pvestatd |
| Shared memory | Performance-critical data | corosync ↔ libqb |
| D-Bus | System events | pve-firewall ↔ systemd |
| WebSocket | Real-time updates | UI ↔ pveproxy (VNC/SPICE) |
| TCP sockets | Cross-node communication | corosync (totem), live migration |

## Security Model

### Authentication

Archmox supports multiple authentication realms:

- **Linux PAM** — System user authentication
- **PVE Realm** — Built-in user database with password hashing (SHA-256 + salt)
- **LDAP** — Lightweight Directory Access Protocol
- **Active Directory** — Windows domain authentication
- **Two-Factor Auth** — TOTP (RFC 6238) via authenticator apps

### Authorization (RBAC)

Resource-based access control with roles:

```
Roles: Administrator, User, Auditor, NoAccess
Permissions (on path):
  /vms/{vmid}      → VM.Migrate, VM.PowerMgmt, VM.Config
  /storage/{store}  → Datastore.Allocate, Datastore.Audit
  /pool/{poolname}  → Pool.Allocate
  /                 → Sys.Audit, Sys.Console, Sys.Modify
```

Permissions are evaluated by the most specific path match with the most permissive role.

### Network Security

- **HTTPS only** for all management interfaces (port 8006 for PVE/PMG, port 8007 for PBS)
- **Cluster traffic** encrypted with corosync's cryptographic mode (AES-256-GCM)
- **Live migration** optionally encrypted with TLS
- **Firewall** at VM, node, and cluster levels with nftables
- **SPICE/VNC** tunnels through the API proxy with WebSocket encryption

## Storage Architecture

See the [Storage Architecture](storage.md) document for details on ZFS, Ceph, LVM, and the storage plugin system.

## Cluster Architecture

See the [Cluster and HA Architecture](cluster.md) document for details on corosync-based clustering, quorum, and high availability.

## Package Management

Archmox packages are built as PKGBUILDs and distributed through an Arch Linux binary repository. The repo is defined in `/etc/pacman.conf`:

```
[archmox]
SigLevel = Optional TrustAll
Server = https://cdn.archmox.acreetionos.org/repo
```

Packages are named with the `archmox-` prefix (e.g., `archmox-pve-manager`, `archmox-proxmox-backup`) to avoid conflicts with any AUR packages.

## References

- [Proxmox VE Administration Guide](https://pve.proxmox.com/pve-docs/)
- [Proxmox Backup Server Documentation](https://pbs.proxmox.com/docs/)
- [Proxmox Mail Gateway Documentation](https://pmg.proxmox.com/pmg-docs/)
- [Arch Linux Package Guidelines](https://wiki.archlinux.org/title/Arch_package_guidelines)
- [Archmox Build System](https://github.com/archmox/archmox/)
