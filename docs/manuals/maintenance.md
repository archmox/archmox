# Archmox Maintenance and Updates

## Overview

This guide covers day-to-day maintenance tasks, update procedures, backup and restore operations, health monitoring, and troubleshooting for Archmox deployments. Proper maintenance ensures cluster stability, data integrity, and availability of virtualized workloads.

## Update Procedures

### Updating Archmox Packages

Archmox follows Arch Linux's rolling release model. All components are updated via `pacman`:

```bash
# Update package database
sudo pacman -Sy

# Preview available updates
sudo pacman -Qqu | grep archmox

# Update all Archmox packages
sudo pacman -S archmox-proxmox-ve

# Update individual components
sudo pacman -S archmox-pve-manager
sudo pacman -S archmox-proxmox-backup
sudo pacman -S archmox-pmg-api

# Full system update (Arch + Archmox)
sudo pacman -Syu
```

### Update Sequence for Clustered Deployments

For multi-node clusters, follow this sequence to minimize downtime:

1. **Check cluster health**:
   ```bash
   pvecm status
   pvecm nodes
   ```

2. **Live migrate VMs off the target node**:
   ```bash
   for vmid in $(qm list | tail -n +2 | awk '{print $1}'); do
     qm migrate $vmid <other-node> --online
   done
   ```

3. **Stop cluster services**:
   ```bash
   systemctl stop pve-ha-lrm pve-ha-crm pve-cluster corosync
   ```

4. **Update packages**:
   ```bash
   pacman -Syu
   ```

5. **Reboot if kernel updated**:
   ```bash
   reboot
   ```

6. **Verify services**:
   ```bash
   systemctl start corosync pve-cluster
   pvecm status  # Should show the node rejoined
   ```

7. **Migrate VMs back** and repeat for each node

### Kernel Updates

Archmox uses the `linux-lts` kernel. After a kernel update:

```bash
# Ensure ZFS modules match the new kernel
sudo pacman -S zfs-utils-dkms
sudo dkms autoinstall -k $(uname -r)

# Rebuild out-of-tree modules
sudo mkinitcpio -p linux-lts

# Reboot to load new kernel
sudo reboot

# Verify ZFS loaded
zfs version
```

### Rolling Back Updates

If an update causes issues:

```bash
# Check pacman logs for the previous package versions
grep "archmox-" /var/log/pacman.log | tail -20

# Download previous version from pacman cache
sudo pacman -U /var/cache/pacman/pkg/archmox-pve-manager-1.0.0-1-x86_64.pkg.tar.zst

# Or rebuild from source with the previous tag
git checkout v1.0.0
bash scripts/ci/build-all.sh
```

## Health Monitoring

### Service Status

```bash
# Check all Archmox services
systemctl status 'pve*'
systemctl status 'pmg*'
systemctl status corosync postgresql nginx postfix

# Journal logs for a specific service
journalctl -u pveproxy -n 100 -f
journalctl -u pve-cluster --since "1 hour ago"
```

### Cluster Health

```bash
# Cluster status
pvecm status

# Node list
pvecm nodes

# Corosync ring health
corosync-cfgtool -s

# Quorum status
corosync-quorumtool -p

# pmxcfs status
pve-cluster status
cat /etc/pve/.version  # Shows cluster version counter
```

### Storage Health

```bash
# ZFS pool status
zpool status
zpool iostat -v 5

# ZFS filesystem usage
zfs list
zfs get all rpool/data

# Ceph status (if configured)
ceph status
ceph osd tree
ceph df

# LVM status
pvs
vgs
lvs -a -o+discard

# Disk health
smartctl -a /dev/sda
```

### Performance Monitoring

```bash
# Node resource usage
pvesh get /nodes/<nodename>/status
pvesh get /nodes/<nodename>/rrddata --timeframe hour

# VM performance
pvesh get /nodes/<nodename>/qemu/<vmid>/status/current
pvesh get /nodes/<nodename>/qemu/<vmid>/rrddata --timeframe hour

# Container performance
pvesh get /nodes/<nodename>/lxc/<ctid>/status/current

# Real-time metrics
# CPU, memory, network, disk I/O per VM
```

### Alert Configuration

Configure email alerts for critical events:

```bash
# Set admin contact
pvesh set /cluster/options --mailto admin@example.com --mailfrom pve@example.com

# Notification events
# VM/CT start/stop failures, HA events, backup failures, storage issues
pvesh get /cluster/notifications
```

## Backup and Restore

### Datastore Backup

```bash
# PBS datastore backup configuration
proxmox-backup-manager datastore list

# Manual verification
proxmox-backup-manager verify --datastore main

# Check backup integrity
proxmox-backup-client verify --crypt-mode encrypt
```

### Configurations Backup

The configuration in `/etc/pve/` is cluster-replicated, but backing up the local system files is still important:

```bash
# Backup cluster configuration
tar czf /root/pve-config-$(date +%Y%m%d).tar.gz /etc/pve/

# Backup Corosync config
tar czf /root/corosync-config-$(date +%Y%m%d).tar.gz /etc/corosync/

# Backup PBS config
tar czf /root/pbs-config-$(date +%Y%m%d).tar.gz /etc/proxmox-backup/

# Backup PMG config
tar czf /root/pmg-config-$(date +%Y%m%d).tar.gz /etc/pmg/
```

### Database Backup

```bash
# PBS PostgreSQL backup
sudo -u postgres pg_dump proxmox-backup > /root/pbs-db-$(date +%Y%m%d).sql

# PMG statistics database (if PostgreSQL-based)
sudo -u postgres pg_dump pmg > /root/pmg-db-$(date +%Y%m%d).sql
```

### Full Node Restore Procedure

In the event of a complete node failure:

1. **Reinstall Arch Linux** on the replacement hardware
2. **Install Archmox packages** following the installation guide
3. **Copy cluster key** from an existing node:
   ```bash
   scp existing-node:/etc/pve/priv/pve-root-ca.pem /etc/pve/priv/
   scp existing-node:/etc/pve/priv/pve-root-ca.key /etc/pve/priv/
   ```
4. **Join the cluster**: `pvecm add <existing-node-ip>`
5. **Re-add storage** (ZFS import, Ceph OSD, etc.)
6. **Verify** all services and VMs

## Certificate Management

### Renewing SSL Certificates

```bash
# Check certificate expiry
openssl x509 -in /etc/pve/local/pve-ssl.pem -noout -dates

# Regenerate self-signed certificate
pvecm updatecerts --force

# Use Let's Encrypt (requires ACME)
pveacme register --account admin@example.com
pveacme order default
systemctl restart pveproxy
```

### Cluster Certificate Rotation

```bash
# Rotate cluster certificates
pvecm updatecerts --force

# On each node, restart services
systemctl restart pveproxy pvedaemon pvestatd
```

## Capacity Planning

### Monitoring Disk Usage

```bash
# ZFS pool capacity
zpool list
NAME      SIZE  ALLOC   FREE  CKPOINT  EXPANDSZ   FRAG    CAP  DEDUP    HEALTH
rpool    3.62T  1.20T  2.42T        -         -     8%    33%  1.00x    ONLINE

# Datastore usage
proxmox-backup-manager datastore list

# VM storage totals
pvesh get /cluster/resources --type storage
```

### Adding Storage

```bash
# Add a new ZFS vdev
zpool add rpool mirror /dev/nvme1n1 /dev/nvme2n1

# Add Ceph OSD
ceph orch daemon add osd <hostname>:/dev/sdX

# Extend LVM thin pool
lvextend -L +100G pve-vg/thin-pool
```

## Disaster Recovery

### Node Failure Recovery

1. **Isolate the failed node** (fencing via IPMI/STONITH)
2. **Verify remaining nodes have quorum**: `pvecm status`
3. **Wait for HA recovery** if resources were HA-managed
4. **Manually recover non-HA VMs**:
   ```bash
   qm start <vmid> --force
   ```
5. **Remove failed node from cluster**:
   ```bash
   pvecm delnode <failed-hostname>
   ```

### Storage Failure Recovery

```bash
# ZFS pool degredation
zpool status -v
zpool clear rpool  # Clear errors
zpool replace rpool /dev/failed-disk /dev/new-disk

# Ceph OSD failure
ceph osd down osd.3
ceph osd out osd.3
ceph osd crush remove osd.3
ceph osd rm osd.3
ceph auth del osd.3
```

### Backup Restore

```bash
# Restore VM from PBS backup
proxmox-backup-client restore \
  --repository root@pam@pbs-01:main \
  host/<backup-id>/<snapshot-id> \
  target-dir/

# Restore VM from VZDump
vzdump restore /var/lib/vz/dump/vzdump-qemu-100-2026_06_13-00_00_00.vma.lzo 100

# Restore container
pct restore 200 /var/lib/vz/dump/vzdump-lxc-200-2026_06_13-00_00_00.tar.zst \
  --storage local-zfs
```

## Routine Maintenance Tasks

### Daily

- [ ] Check cluster status: `pvecm status`
- [ ] Review system logs: `journalctl -p err -b`
- [ ] Verify backup completion: `proxmox-backup-manager job list`

### Weekly

- [ ] Run backup verification: `proxmox-backup-manager verify --datastore main`
- [ ] Check ZFS pool health: `zpool status`
- [ ] Review storage capacity: `pvesh get /cluster/resources --type storage`

### Monthly

- [ ] Apply system updates: `pacman -Syu`
- [ ] Run ZFS scrub: `zpool scrub rpool`
- [ ] Check certificate expiry dates
- [ ] Review user accounts and permissions
- [ ] Rotate logs if needed: `logrotate -f /etc/logrotate.conf`

### Quarterly

- [ ] Full cluster health audit
- [ ] Test disaster recovery procedures
- [ ] Update documentation
- [ ] Review capacity trends
- [ ] Test bare-metal restore from ISO

## Troubleshooting Guide

### High CPU on pvedaemon

```bash
# Check which API endpoints are being called frequently
journalctl -u pvedaemon --since "1 hour ago" | grep "API call"

# Check for stuck processes
perl -d:Trace pvedaemon  # Debug mode (do not run in production)
```

### Corosync Stopped Unexpectedly

```bash
# Check corosync logs
journalctl -u corosync -n 200

# Verify network connectivity between nodes
corosync-cfgtool -s

# Check firewall rules (UDP port 5405 must be open)
iptables -L -n | grep 5405
```

### ZFS Performance Degradation

```bash
# Check for fragmentation
zpool list -v rpool

# Check ARC hit rate
cat /proc/spl/kstat/zfs/arcstats | grep -E "^(hits|misses|hit_rate)"

# Check for slow disks
zpool iostat -v rpool 5

# Clear ZFS cache (if needed, will temporarily slow reads)
echo 0 > /proc/sys/kernel/sched_migration_cost_ns
```

## References

- [Arch Linux System Maintenance](https://wiki.archlinux.org/title/System_maintenance)
- [Proxmox VE Maintenance](https://pve.proxmox.com/wiki/Maintenance)
- [ZFS Troubleshooting Guide](https://openzfs.github.io/openzfs-docs/Performance%20and%20Tuning/index.html)
- [Ceph Administration](https://docs.ceph.com/en/latest/rados/operations/)
- [Archmox Fleet Health](https://github.com/archmox/archmox/blob/main/worker/index.js)
