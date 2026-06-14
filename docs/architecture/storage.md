# Storage Backend Architecture

## Overview

Archmox provides a unified, pluggable storage architecture that abstracts away the complexity of different storage technologies. The storage subsystem, managed by the `pve-storage` package, presents a consistent API for managing virtual machine and container disk images across local and networked storage backends.

This document covers the storage plugin system, each supported backend in detail (ZFS, Ceph, LVM, and others), performance characteristics, replication strategies, and best practices for production deployments.

## Storage Plugin Architecture

The storage subsystem uses a plugin-based design where each backend implements a common interface. This allows new storage types to be added without modifying core management code.

```
┌──────────────────────────────────────────────────────────┐
│                    Management Layer                       │
│  pve-manager  │  qemu-server  │  pve-container          │
│  pve-storage  │  pve-ha-manager  │  vzdump               │
├──────────────────────────────────────────────────────────┤
│                   Storage Plugin API                      │
│  ┌───────────┐ ┌──────────┐ ┌────────┐ ┌────────────┐  │
│  │  ZFSPool  │ │ CephRBD  │ │  LVM   │ │  Directory │  │
│  │  (zfs)    │ │ (rbd)    │ │(lvmthin)│ │  (dir/nfs) │  │
│  └───────────┘ └──────────┘ └────────┘ └────────────┘  │
├──────────────────────────────────────────────────────────┤
│                   Backend Implementations                 │
│  ZFS │ Ceph RBD │ LVM/LVM-thin │ NFS │ iSCSI │ Gluster │
│  BTRFS │ Directory │ SMB/CIFS │ PBS-as-store │ Sheepdog │
└──────────────────────────────────────────────────────────┘
```

### Plugin Contract

Each storage plugin must implement these operations:

```perl
# Core lifecycle
new($storeid, %param)           # Initialize plugin instance
check_config($storeid, %param)  # Validate configuration

# Volume management
create_image($storeid, $volname, $size, $opts)
remove_image($storeid, $volname)
resize_image($storeid, $volname, $new_size)

# Volume information
list_images($storeid, $vmid)    # List volumes for a VM/CT
volume_info($storeid, $volname) # Volume size, format, etc.
volume_snapshot($storeid, $volname, $snapname)

# Clone and migration
clone_image($storeid, $volname, $new_vmid)
template_image($storeid, $volname)  # Convert to template
```


## ZFS Storage Backend

### Architecture

ZFS is the recommended storage backend for Archmox deployments. Its feature set aligns perfectly with virtualization workloads:

- **Copy-on-Write**: Instant snapshots and clones without performance impact for idle volumes
- **Data Integrity**: Checksums on all data and metadata prevent silent corruption
- **Compression**: Built-in LZ4/ZSTD compression reduces storage usage by 2-5x for VM disks
- **Deduplication**: Block-level deduplication (use with caution — memory intensive)
- **Caching**: ARC (Adaptive Replacement Cache) for read performance, ZIL for synchronous writes
- **RAID**: Software RAID via vdevs (mirror, RAID-Z1/2/3, striped)

### ZFS Pool Layout on Archmox

```
pool: rpool (or custom name)
  ├── vdev type: mirror | raidz | stripe
  ├── ashift: 12 (4K sectors) | 13 (8K sectors)
  ├── recordsize: 16K (VM block size)
  ├── atime: off
  ├── compression: lz4 | zstd
  ├── xattr: sa
  └── datasets:
      ├── rpool/ROOT/archmox     # OS root filesystem
      ├── rpool/data             # VM/CT disk images (volblocksize=8K)
      ├── rpool/backup           # Backup storage (recordsize=1M)
      └── rpool/template         # Container templates (recordsize=64K)
```

### VM Volume Types

ZFS provides two volume types for VMs:

1. **ZVOL** (zvol): Raw block device presented as `/dev/zvol/<pool>/<dataset>/<volume>`. Optimal for VMs with raw disk images:
   ```bash
   zfs create -V 32G -o volblocksize=8K -o compression=lz4 rpool/data/vm-100-disk-0
   ```

2. **Subvolume** (filesystem dataset): Used for container root filesystems:
   ```bash
   zfs create -o compression=lz4 -o mountpoint=/var/lib/lxc/101/rootfs rpool/data/subvol-101-disk-0
   ```

### ZFS Replication

Replication is handled by `pve-zsync` and `sanoid/syncoid`:

1. **Snapshot-based replication**: Snapshots are taken and sent to a remote ZFS pool via `zfs send | zfs recv`
2. **Incremental replication**: After initial full sync, only changed blocks are sent
3. **Replication schedules**: Configurable intervals (every 15min, hourly, daily)
4. **Failover**: Replicated VMs can be started on the remote node if the primary fails

```bash
# Manual replication
pve-zsync sync --source rpool/data/vm-100-disk-0 --dest backup-pool/vm-100
```

### ZFS Performance Tuning

```bash
# ARC size limits (default: 50% of RAM, max 16TB)
echo "options zfs zfs_arc_max=4294967296" > /etc/modprobe.d/zfs.conf
echo "options zfs zfs_arc_min=1073741824" >> /etc/modprobe.d/zfs.conf

# ZFS intent log on SSD (SLOG)
zpool add rpool log /dev/nvme1n1

# L2ARC on SSD (read cache)
zpool add rpool cache /dev/nvme2n1

# Disable access time updates
zfs set atime=off rpool/data

# Set optimal recordsize for VM blocks
zfs set recordsize=16K rpool/data
```

## Ceph Storage Backend

### Architecture

Ceph provides distributed block storage (RBD), object storage (RADOSGW), and shared filesystem (CephFS). In Archmox, Ceph is primarily used for RBD volumes:

```
┌──────────────────────────────────────────────────────────┐
│                     Archmox Nodes                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ MON+OSD  │  │ MON+OSD  │  │ MON+OSD  │               │
│  │ node1    │  │ node2    │  │ node3    │               │
│  └──────────┘  └──────────┘  └──────────┘               │
│         │             │             │                     │
│         └──────┬──────┴──────┬──────┘                     │
│                │             │                            │
│           ┌────▼────┐  ┌────▼────┐                       │
│           │Client 1 │  │Client 2 │  (VMs running here)   │
│           └─────────┘  └─────────┘                       │
└──────────────────────────────────────────────────────────┘
```

### Ceph Components

- **MON** (Monitor): Maintains cluster map and provides consensus (3 or 5 recommended)
- **OSD** (Object Storage Daemon): One per physical disk, handles data storage, replication, and recovery
- **MGR** (Manager): Provides cluster metrics, dashboard, and orchestration
- **MDS** (Metadata Server): Required only for CephFS

### Ceph Pool Configuration

```bash
# Create RBD pool for VM images
ceph osd pool create vm-images 128
ceph osd pool application enable vm-images rbd
rbd pool init vm-images

# Create RBD pool for backups
ceph osd pool create backup-pool 64
ceph osd pool application enable backup-pool rbd
rbd pool init backup-pool

# Set replication size
ceph osd pool set vm-images size 3    # 3 replicas
ceph osd pool set vm-images min_size 2 # Minimum to serve I/O
```

### Performance Optimization

```bash
# OSD settings for NVMe
ceph config set osd osd_op_queue mclock_scheduler
ceph config set osd osd_mclock_max_capacity_ratio 0.8
ceph config set osd osd_max_backfills 4
ceph config set osd osd_recovery_max_active 4

# Network tuning
ceph config set global public_network 10.0.10.0/24
ceph config set global cluster_network 10.0.20.0/24  # Dedicated replication network

# BlueStore block size
ceph config set osd bluestore_min_alloc_size 4096  # 4K for NVMe
```

### RBD Integration in pve-storage

The `CephRBD` plugin:

1. Authenticates to the Ceph cluster via `cephx` (keyring in `/etc/pve/priv/ceph/`)
2. Creates RBD images with QEMU-compatible striping
3. Maps RBD images to `/dev/rbd/<pool>/<image>` for container use
4. Integrates with QEMU's native RBD driver for direct block access

## LVM Storage Backend

### Architecture

LVM (Logical Volume Manager) with thin provisioning is supported for traditional, high-performance block storage:

```
Physical Disks
  └── LVM Physical Volumes (PV)
       └── Volume Group (VG)
            ├── Thin Pool (data + metadata)
            │    ├── Thin LV (vm-100-disk-0)
            │    ├── Thin LV (vm-100-disk-1)
            │    └── Thin LV (vm-101-disk-0)
            └── Traditional LV (backup-storage)
```

### Configuration

```bash
# Create PVs
pvcreate /dev/sda /dev/sdb

# Create VG
vgcreate pve-vg /dev/sda /dev/sdb

# Create thin pool (50% of VG for data, ~1% for metadata)
lvcreate -L 50G -T pve-vg/thin-pool -c 64K

# Register in pve-storage
pvesm add lvmthin local-lvm --vgname pve-vg --thinpool thin-pool
```

### Thin Provisioning

LVM thin pools support:
- **Overprovisioning**: Sum of thin LV sizes can exceed pool size
- **Snapshots**: Instant, space-efficient snapshots
- **Reduction**: Free space is returned to the pool when volumes are deleted

**Caution**: Monitor thin pool usage closely. When a thin pool reaches 100% capacity, all volumes become read-only until space is freed.

## Directory and Network-Based Storage

### Directory Storage

Simple storage type for directories, NFS exports, and SMB/CIFS shares:

```
Storage: local
  ├── /var/lib/vz/images/      # VM disk images
  ├── /var/lib/vz/template/    # OS templates
  │   ├── iso/                 # ISO images
  │   └── cache/               # Container template cache
  └── /var/lib/vz/dump/        # Backup dumps
```

### NFS Storage

Network-attached storage accessed via NFS:

```
Server: /export/vm-storage
Mount: /mnt/pve/nfs-storage
Option: vers=4.2,hard,intr,noatime
```

### iSCSI Storage

Block-level storage accessed via iSCSI:

```
Target: iqn.2026-06.com.example:storage
LUN: 1
Portal: 10.0.10.100:3260
Authentication: CHAP
```

### SMB/CIFS Storage

SMB network shares (useful for mixed environments):

```
Share: \\fileserver\vm-storage
Mount: /mnt/pve/smb-storage
Options: vers=3.0,credentials=/etc/pve/priv/smb-credentials
```

## Storage Replication

### ZFS Replication

ZFS replication uses `zfs send` over SSH:

```bash
# On source:
zfs snapshot -r rpool/data@repl-$(date +%s)
zfs send -R rpool/data@repl-... | ssh target zfs recv -F backup-pool/data

# Automated via pve-zsync:
pve-zsync create --source rpool/data/vm-100 --dest 10.0.10.2:backup-pool/100
```

### Ceph Replication

Ceph handles replication natively at the RADOS level:
- **Replicated pools**: Synchronous replication across OSDs (configurable replica count)
- **Erasure coded pools**: Space-efficient redundancy (e.g., k=2, m=1 means 1.5x overhead)
- **CRUSH map**: Controls data placement across hosts, racks, and data centers

### Cross-Cluster Replication

For disaster recovery between separate Archmox clusters:
- ZFS: `syncoid` or `sanoid` for periodic ZFS stream replication
- Ceph: `rbd mirroring` for asynchronous RBD image replication (journal-based or snapshot-based)
- PBS: `proxmox-backup-client` for off-site backup synchronization

## Storage Selection Guide

| Backend | Use Case | Performance | Complexity | Cost |
|---------|----------|-------------|------------|------|
| ZFS | General purpose | Excellent (with ARC) | Medium | Low |
| Ceph | Distributed HA | Good | High | Medium |
| LVM-thin | Local performance | Excellent | Low | Low |
| NFS | Shared nothing | Moderate | Low | Low |
| iSCSI | SAN integration | Good | Medium | High |
| Directory | Simple storage | Moderate | Very low | Low |

### Recommended Configurations

**Small deployment (1-3 nodes, local storage)**:
- ZFS with mirrors on each node
- ZFS replication for DR
- PBS on a separate node for backups

**Medium deployment (3-10 nodes, shared storage)**:
- Ceph with 3x replication
- Separate cluster network for OSD replication
- NVMe OSDs for performance-critical workloads
- PBS with erasure coding for backup

**Large deployment (10+ nodes, multi-site)**:
- Stretched Ceph cluster across two data centers
- Arbiter node for tie-breaking in third location
- RBD mirroring for cross-region DR
- Hierarchical storage with SSD/NVMe tier + HDD capacity tier

## References

- [ZFS on Linux Documentation](https://openzfs.github.io/openzfs-docs/)
- [Ceph Documentation](https://docs.ceph.com/)
- [LVM Administration Guide](https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/configuring_and_managing_logical_volumes/)
- [Proxmox Storage Documentation](https://pve.proxmox.com/wiki/Storage)
- [Archmox pve-storage PKGBUILD](https://github.com/archmox/archmox/blob/main/packages/pve/pve-storage/PKGBUILD)
