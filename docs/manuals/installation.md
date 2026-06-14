# Archmox Installation Manual

## Prerequisites

Before installing Archmox, ensure your system meets these requirements:

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 64-bit x86-64, 2 cores | 8+ cores with VT-x/AMD-V |
| RAM | 4 GB | 16+ GB (ZFS ARC scales with RAM) |
| Storage | 64 GB | 256+ GB SSD/NVMe |
| Network | 1 Gbps NIC | 2x 10 Gbps NIC (bonded) |

### Software Requirements

- Arch Linux (or Hyperbola GNU/Linux-libre as the LTS base)
- `linux-lts` kernel or `linux` kernel
- `systemd` as init system
- `pacman` package manager
- `sudo` configured for the installation user

## Installation Methods

### Method 1: From the Archmox Binary Repository (Recommended)

This method installs pre-built packages from the Archmox CDN repository.

#### Step 1: Add the Archmox Repository

Create `/etc/pacman.d/archmox.conf`:

```ini
[archmox]
SigLevel = Optional TrustAll
Server = https://cdn.archmox.acreetionos.org/repo
```

Include it in `/etc/pacman.conf`:

```ini
# At the end of /etc/pacman.conf
Include = /etc/pacman.d/archmox.conf
```

#### Step 2: Update Package Database

```bash
sudo pacman -Sy
```

#### Step 3: Install the Metapackage

```bash
# Full Archmox stack (PVE + PBS + PMG)
sudo pacman -S archmox-proxmox-ve

# Or individual components:
sudo pacman -S archmox-pve-manager          # PVE only
sudo pacman -S archmox-proxmox-backup       # PBS only
sudo pacman -S archmox-pmg-api              # PMG only
```

#### Step 4: Enable and Start Services

```bash
# PVE
sudo systemctl enable --now pveproxy pvedaemon pvestatd pve-cluster

# PBS
sudo systemctl enable --now proxmox-backup postgresql

# PMG
sudo systemctl enable --now pmg-smtp-filter pmg-policy pmg-log-tracker

# Infrastructure
sudo systemctl enable --now corosync
sudo systemctl enable --now zfs-import-cache zfs-mount zfs-zed
```

### Method 2: From Source (PKGBUILD)

For development or customization, build directly from PKGBUILDs.

#### Step 1: Clone the Repository

```bash
git clone https://github.com/archmox/archmox.git
cd archmox
```

#### Step 2: Install Build Dependencies

```bash
sudo pacman -S base-devel git rust cargo cmake \
  perl perl-module-build nodejs npm \
  zfs-utils ceph-common lvm2 corosync libqb \
  qemu-full lxc lxcfs openvswitch
```

#### Step 3: Run the Build Script

```bash
# Build all packages in dependency order
bash scripts/ci/build-all.sh

# Or build individual groups:
bash scripts/ci/build-all.sh --only proxmox-rs
bash scripts/ci/build-all.sh --only pve-common
```

#### Step 4: Install Built Packages

```bash
cd repo
sudo pacman -U *.pkg.tar.zst
```

### Method 3: From ISO (Coming Soon)

Archmox installation ISOs are built using `archiso` and provide a guided installer:

1. Download the ISO from [cdn.archmox.acreetionos.org](https://cdn.archmox.acreetionos.org)
2. Write to USB: `dd if=archmox-<version>.iso of=/dev/sdX bs=4M status=progress`
3. Boot from USB
4. Follow the interactive installer (partitioning, networking, package selection)
5. Reboot into the installed system

## Post-Installation Configuration

### Network Configuration

Configure networking for the management interface:

```bash
# Set hostname
hostnamectl set-hostname pve1.example.com

# Configure network bridge (vmbr0)
cat > /etc/systemd/network/10-bridge.netdev << EOF
[NetDev]
Name=vmbr0
Kind=bridge
EOF

cat > /etc/systemd/network/20-bridge.network << EOF
[Match]
Name=vmbr0

[Network]
Address=10.0.10.10/24
Gateway=10.0.10.1
DNS=10.0.10.1
EOF

systemctl restart systemd-networkd
```

### Storage Configuration

#### ZFS Setup

```bash
# Create ZFS pool
zpool create -f -o ashift=12 rpool \
  mirror /dev/sda /dev/sdb \
  mirror /dev/sdc /dev/sdd

# Create datasets
zfs create rpool/data -o mountpoint=/var/lib/vz
zfs create rpool/template -o mountpoint=/var/lib/vz/template

# Enable compression
zfs set compression=lz4 rpool/data
```

#### Ceph Setup (Clustered Deployments)

```bash
# Bootstrap Ceph (on first node)
cephadm bootstrap --mon-ip 10.0.10.10

# Add OSDs on each node
ceph orch device zap <hostname> /dev/sdX --force
ceph orch daemon add osd <hostname>:/dev/sdX

# Create RBD pools
ceph osd pool create vm-images 128
rbd pool init vm-images
```

### Web Interface Access

After installation, the web interface is available at:

```
https://<node-ip>:8006/    # PVE/PMG
https://<node-ip>:8007/    # PBS
```

Default login:
- Username: `root`
- Password: (system root password)
- Realm: `Linux PAM`

### TLS Certificate

For production deployments, replace the self-signed certificate:

```bash
pvesh set /nodes/<nodename>/cert/info \
  --certificates "$(cat /path/to/fullchain.pem)"
pvecm updatecerts --force
systemctl restart pveproxy
```

### Firewall Configuration

```bash
# Enable the Archmox firewall
pvesh set /nodes/<nodename>/firewall/options --enable 1

# Create cluster-level rules
cat > /etc/pve/firewall/cluster.fw << EOF
[OPTIONS]
enable: 1

[RULES]
IN SSH(ACCEPT) -source 10.0.0.0/8
IN ACCEPT -source 10.0.0.0/8 -dest +management
IN HTTPS(ACCEPT) -source 0.0.0.0/0
IN ACCEPT -p tcp -dport 8006 -source 0.0.0.0/0
EOF
```

## Cluster Setup

### Create a New Cluster

On the first node:

```bash
pvecm create archmox-cluster --link0 10.0.10.10
```

### Add Nodes to the Cluster

On subsequent nodes:

```bash
pvecm add 10.0.10.10
```

### Verify Cluster Status

```bash
pvecm status
pvecm nodes
```

Expected output (3-node cluster):
```
Quorum information
------------------
Date:             Sat Jun 13 12:00:00 2026
Quorum provider:  corosync_votequorum
Nodes:            3
Node ID:          0x00000001
Ring ID:          1.1234
Quorate:          Yes

Votequorum information
----------------------
Expected votes:   3
Highest expected: 3
Total votes:      3
Quorum:           2
Flags:            Quorate

Membership information
----------------------
    Nodeid      Votes Name
0x00000001          1 10.0.10.10
0x00000002          1 10.0.10.11
0x00000003          1 10.0.10.12
```

## Post-Install Checklist

1. [ ] Verify all services are running: `systemctl status pveproxy pvedaemon pve-cluster`
2. [ ] Access web UI and verify login
3. [ ] Configure storage backends via Web UI > Datacenter > Storage
4. [ ] Upload or download an ISO template
5. [ ] Create a test VM and verify it starts
6. [ ] Set up backup schedule (vzdump or PBS)
7. [ ] Configure firewall rules
8. [ ] Set up user accounts and permissions
9. [ ] Join additional nodes to cluster (if applicable)
10. [ ] Test live migration between nodes (clustered only)
11. [ ] Set up HA for production workloads

## Troubleshooting

### Common Issues

**pve-cluster fails to start**:
```bash
# Check corosync configuration
corosync-cfgtool -s

# Check corosync logs
journalctl -u corosync -u pve-cluster

# Verify network ports (UDP 5405)
ss -ulpn | grep corosync
```

**Web UI not accessible**:
```bash
# Check pveproxy status
systemctl status pveproxy

# Check firewall rules
nft list ruleset

# Verify network binding
ss -tlnp | grep 8006
```

**ZFS pool not found**:
```bash
zpool import -a  # Import all available pools
zpool status     # Check pool health
```

## References

- [Arch Linux Installation Guide](https://wiki.archlinux.org/title/Installation_guide)
- [Proxmox VE Installation Guide](https://pve.proxmox.com/wiki/Installation)
- [Archmox Build Script](https://github.com/archmox/archmox/blob/main/scripts/ci/build-all.sh)
- [Archmox ISO Build](https://github.com/archmox/archmox/blob/main/iso/archiso/build.sh)
