# Archmox Configuration Guide

## Overview

Archmox configuration is managed through a combination of centralized cluster-wide files (stored in pmxcfs at `/etc/pve/`), local system configuration (`/etc/`), and the web-based administration interface. This guide covers the key configuration files, their formats, and best practices for each component.

## Configuration Hierarchy

```
Cluster Level (/etc/pve/)
  ├── datacenter.cfg          # Global datacenter settings
  ├── storage.cfg             # All storage backends
  ├── user.cfg                # Users, groups, ACLs, realms
  ├── vzdump.cfg              # Backup scheduling (deprecated in favor of PBS)
  ├── firewall/
  │   ├── cluster.fw          # Cluster-wide firewall rules
  │   └── <nodename>.fw       # Per-node firewall rules
  ├── ha/
  │   ├── groups.cfg          # HA group definitions
  │   └── resources.cfg       # HA managed resources
  ├── sdn/
  │   └── <config>.cfg        # SDN zone/VNet configuration
  └── nodes/<nodename>/
      ├── qemu-server/        # VM configs (<vmid>.conf)
      ├── lxc/                # CT configs (<ctid>.conf)
      └── pve-ssl.pem         # Node SSL certificate

Node Level (/etc/)
  ├── corosync/
  │   └── corosync.conf       # Corosync cluster engine config
  ├── pmg/
  │   └── pmg.conf            # PMG mail gateway config
  ├── proxmox-backup/
  │   └── backup-server.toml  # PBS server config
  ├── nginx/
  │   └── pveproxy.conf       # PVE reverse proxy config
  ├── postfix/
  │   └── main.cf             # Postfix MTA config
  └── systemd/
      └── system/             # Service override files
```

## Datacenter Configuration

`/etc/pve/datacenter.cfg` defines global settings for the entire cluster:

```ini
# Keyboard layout
keyboard: en-us

# Console viewer
console: applet  # Options: applet, xtermjs, vv (virt-viewer)

# Language
language: en

# Maximum number of workers per node
max_workers: 5

# Migration settings
migration: network=10.0.10.0/24   # Dedicated migration network
migration_type: secure              # Options: secure, insecure

# Email notifications
mail_from: root@example.com
mail_to: admin@example.com

# HTTP proxy for node communication
http_proxy: http://proxy.example.com:3128

# Next Server (phone-home)
next_id: 100

# Timeout settings
console_timeout: 0                 # 0 = no timeout
status_view_ttl: 4                 # Cache status for N seconds

# User synchronization
user_sync_interval: 3600           # LDAP sync interval (seconds)
```

## Storage Configuration

`/etc/pve/storage.cfg` defines all storage backends:

```ini
# Directory-based storage
dir: local
    path /var/lib/vz
    content iso,vztmpl,backup,snippets
    maxfiles 7
    shared 0

# ZFS storage
zfspool: local-zfs
    pool rpool/data
    blocksize 8K
    content images,rootdir
    sparse 1

# Ceph RBD storage (requires Ceph cluster)
rbd: ceph-storage
    monhost 10.0.10.10 10.0.10.11 10.0.10.12
    pool vm-images
    content images,rootdir
    krbd 1
    cephx 1

# LVM-thin storage
lvmthin: local-lvm
    vgname pve-vg
    thinpool thin-pool
    content images,rootdir

# NFS storage
nfs: nfs-storage
    path /mnt/pve/nfs-storage
    server 10.0.20.100
    export /export/vm-storage
    options vers=4.2,hard,intr
    content iso,vztmpl,backup

# PBS storage (backup target)
pbs: pbs-remote
    server 10.0.30.10
    datastore main
    content backup
    username root@pam
    password <encrypted>
    fingerprint <tls-fingerprint>
```

### Content Types

Each storage can serve different content types:

| Content Type | Description | Store Type |
|---|---|---|
| `images` | VM disk images (raw/qcow2/vmdk) | ZFS, Ceph, LVM-thin, Directory |
| `rootdir` | Container root filesystems | ZFS, Ceph, LVM-thin, Directory |
| `iso` | ISO installation media | Directory, NFS |
| `vztmpl` | Container OS templates | Directory, NFS |
| `backup` | VZDump backup archives | Directory, NFS |
| `snippets` | Cloud-init and hook scripts | Directory |
| `import` | VM import data | Directory |

## User and Permission Configuration

### Authentication Realms

Realms are defined in `/etc/pve/user.cfg` implicitly. Supported realm types:

**Linux PAM Realm** (built-in):
- Users authenticate with their system Linux username/password
- No additional configuration needed

**PVE Realm** (built-in):
```bash
pveum user add joe@pve --password <password>
pveum role add VMAdmin -privs "VM.Allocate VM.Config VM.Console VM.Migrate VM.PowerMgmt"
pveum acl modify /vms/100 --user joe@pve --role VMAdmin
```

**LDAP Realm**:
```bash
pveum realm add my-ldap --type ldap \
  --server ldap.example.com \
  --base-dn dc=example,dc=com \
  --bind-dn cn=admin,dc=example,dc=com \
  --secure 1
```

### ACL Structure

```bash
# Path-based permissions
pveum acl modify /             --user admin@pve          --role Administrator
pveum acl modify /vms          --user operator@pve       --role PVEDatastoreUser
pveum acl modify /vms/100      --user joe@pve            --role VMAdmin
pveum acl modify /pool/prod    --group engineers          --role PVEPoolUser

# Group-level access
pveum group add engineers
pveum acl modify /pool/prod    --group engineers          --role PVEPoolUser

# Two-factor authentication
pveum user modify root@pam --enable-totp 1
```

## VM Configuration

Each VM has a configuration file at `/etc/pve/nodes/<nodename>/qemu-server/<vmid>.conf`:

```ini
# VM 100 - Web Server
boot: order=scsi0;ide2;net0
cores: 4
cpu: host
hotplug: disk,network,usb,memory,cpu
ide2: local:iso/debian-12.iso,media=cdrom
memory: 8192
name: web-01
net0: virtio=AA:BB:CC:DD:EE:01,bridge=vmbr0,firewall=1
numa: 0
onboot: 1
ostype: l26
scsi0: local-zfs:vm-100-disk-0,discard=on,iothread=1,size=64G,ssd=1
scsihw: virtio-scsi-single
smbios1: uuid=00000000-0000-4000-8000-000000000100
sockets: 2
tags: web,production
vga: virtio
watchdog: model=i6300esb,action=reset
```

### Key VM Configuration Options

| Option | Description | Common Values |
|--------|-------------|---------------|
| `balloon` | Memory ballooning (enable overcommit) | 0 (off), 1024-65536 (MB) |
| `bios` | BIOS firmware | seabios, ovmf (UEFI) |
| `efidisk` | UEFI variable store | `<storage>:<size>,efitype=4m` |
| `hostpci` | PCI passthrough | `hostpci0: 01:00.0,pcie=1,x-vga=1` |
| `machine` | Machine type | `q35` (recommended), `pc-i440fx-*` |
| `protection` | Protection from accidental removal | `true/false` |
| `scsihw` | SCSI controller | `virtio-scsi-single` (best), `megasas` |
| `serial` | Serial port | `socket` (for `qm terminal`) |
| `tablet` | USB tablet (absolute pointing) | `1` (enabled for SPICE) |
| `tpmstate` | TPM state storage | `<storage>:<size>,version=v2.0` |

## Container Configuration

Container configs at `/etc/pve/nodes/<nodename>/lxc/<ctid>.conf`:

```ini
# CT 200 - Database Server
arch: amd64
cores: 4
hostname: db-01
memory: 8192
net0: name=eth0,bridge=vmbr0,firewall=1,gw=10.0.10.1,ip=10.0.10.200/24,type=veth
onboot: 1
ostype: ubuntu
rootfs: local-zfs:subvol-200-disk-0,size=100G
swap: 2048
tags: database,production
unprivileged: 1
lxc.cgroup2.memory.max: 8589934592
lxc.cgroup2.cpu.weight: 500
```

### Container Options

| Option | Description |
|--------|-------------|
| `unprivileged` | Run container as unprivileged user (UID mapping) |
| `features` | Enable nesting, NFS, FUSE, etc. (`features: nesting=1`) |
| `mp0` | Mount point for bind-mounts (`mp0: /mnt/data,mp=/data`) |
| `lxc.*` | Raw LXC configuration options |

## PMG Configuration

`/etc/pmg/pmg.conf`:

```ini
# Mail Gateway Identity
mydomain: example.com
mynetworks: 127.0.0.0/8,10.0.0.0/8

# Internal MTA
relayhost: [mail.internal.example.com]:25

# Spam Detection
spam_level: 4.0           # Score to mark as spam
spam_level_quar: 8.0      # Score to quarantine
clamav_enable: 1           # Enable virus scanning

# DKIM
dkim_enable: 1
dkim_domain: example.com
dkim_selector: mail

# Quarantine
quarantine_digest_interval: daily
quarantine_retention: 30

# TLS
tls_enable: 1
tls_cert_file: /etc/pmg/tls/server.crt
tls_key_file: /etc/pmg/tls/server.key
```

## PBS Configuration

`/etc/proxmox-backup/backup-server.toml`:

```toml
# Server identity
server_name = "pbs-01"
auth_mode = "pam"

# Listen address
listen_address = "0.0.0.0:8007"
tls_listen_address = "0.0.0.0:8007"
tls_certificate = "/etc/proxmox-backup/tls/server.crt"
tls_key = "/etc/proxmox-backup/tls/server.key"

# API rate limiting
api_rate_limit = 100.0  # requests per second

# Datastore paths (defined in web UI or config)
# /etc/proxmox-backup/datastore/<name>.toml

# Garbage collection
gc_schedule = "daily"
gc_max_workers = 4

# Verification
verify_schedule = "weekly"
verify_new = true

# Remote sync
[[remote]]
name = "offsite"
host = "pbs-offsite.example.com"
fingerprint = "xx:xx:xx:..."
datastore = "backup"
```

## Network Configuration

### Bridge Configuration

```bash
# Create Linux bridge via systemd-networkd
cat > /etc/systemd/network/vmbr0.netdev << 'EOF'
[NetDev]
Name=vmbr0
Kind=bridge
EOF

cat > /etc/systemd/network/vmbr0.network << 'EOF'
[Match]
Name=vmbr0

[Network]
Address=10.0.10.10/24
Gateway=10.0.10.1
DNS=10.0.10.1
EOF
```

### SDN Configuration

Software-Defined Networking zones are configured via the web UI or CLI:

```bash
# Create a VXLAN zone
pvesh create /cluster/sdn/zones \
  --zone my-vxlan \
  --type vxlan \
  --peer 10.0.10.0/24 \
  --mtu 1500

# Create a VLAN zone
pvesh create /cluster/sdn/zones \
  --zone my-vlan \
  --type vlan \
  --bridge vmbr0

# Create a VNet
pvesh create /cluster/sdn/vnets \
  --vnet my-network \
  --zone my-vxlan \
  --vlan-id 100
```

## Service Configuration Overrides

Create systemd drop-in files for service customization:

```bash
mkdir -p /etc/systemd/system/pveproxy.service.d/
cat > /etc/systemd/system/pveproxy.service.d/custom.conf << 'EOF'
[Service]
Environment=PVE_DEBUG=1
RestartSec=10s
EOF

systemctl daemon-reload
systemctl restart pveproxy
```

## Backup Configuration

### PBS Backup Schedule

```bash
# Create backup job via CLI
proxmox-backup-manager job create \
  --id vm-daily \
  --datastore main \
  --schedule "daily 02:00" \
  --store backup-pool \
  --ns /vms

# Retention policy
proxmox-backup-manager datastore set main \
  --keep-last 7 \
  --keep-daily 30 \
  --keep-weekly 8 \
  --keep-monthly 12
```

### VZDump (Legacy)

```ini
# /etc/pve/vzdump.cfg
tmpdir: /var/tmp
dumpdir: /var/lib/vz/dump
storage: local
mailnotification: failure
mailto: admin@example.com
mode: snapshot
compress: zstd
exclude-path: /tmp,/var/tmp
```

## References

- [Proxmox VE Administration Guide](https://pve.proxmox.com/pve-docs/pve-admin-guide.html)
- [Proxmox Mail Gateway Admin Guide](https://pmg.proxmox.com/pmg-docs/pmg-admin-guide.html)
- [Proxmox Backup Server Admin Guide](https://pbs.proxmox.com/docs/)
- [Arch Linux System Administration](https://wiki.archlinux.org/title/Systemd)
- [Archmox PKGBUILD Repository](https://github.com/archmox/archmox/tree/main/packages)
