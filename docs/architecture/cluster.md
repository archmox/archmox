# Cluster Communication and High Availability Architecture

## Overview

Archmox's clustering subsystem enables multiple physical nodes to operate as a unified virtualization platform. Clustering provides centralized management, live migration, high availability, and distributed storage access. The cluster stack is built on Corosync for group communication and the Proxmox Cluster Filesystem (pmxcfs) for distributed configuration management.

This document details the cluster architecture, communication protocols, quorum mechanisms, and the High Availability (HA) resource management system.

## Cluster Stack

```
┌─────────────────────────────────────────────────────────┐
│                    Management Layer                      │
│  pve-ha-crm  │  pve-ha-lrm  │  pve-firewall             │
├─────────────────────────────────────────────────────────┤
│                   Configuration Layer                    │
│  pmxcfs (FUSE)  │  pve-cluster daemon                   │
├─────────────────────────────────────────────────────────┤
│                  Messaging Layer                         │
│  corosync  │  libqb  │  totem (UDP/UDP6)                │
├─────────────────────────────────────────────────────────┤
│                   Transport Layer                        │
│  UDP (port 5405)  │  unicast/broadcast                  │
└─────────────────────────────────────────────────────────┘
```

### Corosync Cluster Engine

Corosync provides the core cluster communication infrastructure:

- **Totem Protocol**: A single-ring ordering and membership protocol that ensures all nodes see messages in the same order. Operates over UDP (unicast or multicast).
- **Configuration Database (ConfDB)**: A distributed key-value store for runtime cluster configuration.
- **Closed Process Group**: A membership service that tracks which nodes are currently active in the cluster.
- **Extended Virtual Synchrony (EVS)**: Guarantees that all nodes see the same membership transitions in the same order.

Corosync on Archmox is built from the `corosync-pve` package, which includes Proxmox-specific patches for improved reliability and integration with pmxcfs.

### Corosync Configuration

The cluster configuration is stored in `/etc/pve/corosync.conf`. A typical configuration:

```ini
totem {
    version: 2
    cluster_name: archmox-cluster
    transport: knet
    crypto_cipher: aes256
    crypto_hash: sha256
    secauth: on
    rrp_mode: active
}

nodelist {
    node {
        name: node1
        nodeid: 1
        ring0_addr: 10.0.10.1
        ring1_addr: 10.0.20.1
    }
    node {
        name: node2
        nodeid: 2
        ring0_addr: 10.0.10.2
        ring1_addr: 10.0.20.2
    }
    node {
        name: node3
        nodeid: 3
        ring0_addr: 10.0.10.3
        ring1_addr: 10.0.20.3
    }
}

quorum {
    provider: corosync_votequorum
    expected_votes: 3
    two_node: 0
    wait_for_all: 1
}

logging {
    to_syslog: yes
    debug: off
}
```

The `knet` transport (kronosnet) is the recommended transport protocol:
- Automatic failover between redundant network links
- Encryption (AES-256-GCM) and authentication
- Path MTU discovery and fragmentation handling
- TCP-friendly but with lower latency than TCP

### pmxcfs — Proxmox Cluster Filesystem

pmxcfs is the heart of cluster configuration management. It is a FUSE-based filesystem that presents cluster-wide configuration as regular files under `/etc/pve/`.

#### Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Applications (read/write /etc/pve/*)                     │
├──────────────────────────────────────────────────────────┤
│ FUSE Kernel Module                                       │
├──────────────────────────────────────────────────────────┤
│ pve-cluster daemon                                       │
│  ├── FUSE handler (libfuse2)                             │
│  ├── SQLite database (in-memory + journal)               │
│  ├── Corosync messaging layer (CPG)                      │
│  └── Write queue + lock manager                          │
├──────────────────────────────────────────────────────────┤
│ corosync → network → other nodes                         │
└──────────────────────────────────────────────────────────┘
```

#### Key Design Properties

1. **Strong Consistency**: All writes are replicated through corosync's CLM (Closed Process Group) before being committed. This ensures all nodes see the same data at the same logical time.

2. **Locking**: POSIX advisory locks (`flock`, `fcntl`) on pmxcfs files are translated into distributed locks. This prevents concurrent writes to the same configuration file from different nodes.

3. **Performance**: The SQLite database is held in memory for fast reads. Writes are journaled to disk for crash recovery. The FUSE layer provides caching for frequently accessed files.

4. **File Structure**:
   ```
   /etc/pve/
   ├── corosync.conf          # Cluster membership config
   ├── datacenter.cfg         # Datacenter-wide settings
   ├── storage.cfg            # Storage backend definitions
   ├── user.cfg               # User and ACL database
   ├── nodes/
   │   ├── <nodename>/
   │   │   ├── qemu-server/   # VM config files (<vmid>.conf)
   │   │   ├── lxc/           # CT config files (<ctid>.conf)
   │   │   ├── pve-ssl.pem    # Node SSL certificate
   │   │   ├── pve-ssl.key    # Node SSL key
   │   │   ├── pve-root.pem   # Cluster CA certificate
   │   │   └── priv/          # Private data (encrypted)
   │   └── ...
   ├── firewall/
   │   ├── cluster.fw         # Cluster-wide firewall rules
   │   └── <nodename>.fw      # Host-specific firewall rules
   ├── ha/
   │   ├── groups.cfg         # HA group definitions
   │   └── resources.cfg      # HA resource configuration
   ├── virtual-guest/         # Guest migration state
   ├── vzdump.cfg             # Backup job configuration
   ├── sdn/                   # SDN configuration
   └── .version               # Version tracking file
   ```

#### Write Path

When a process writes to `/etc/pve/storage.cfg`:

1. The write is intercepted by FUSE and forwarded to `pve-cluster`
2. `pve-cluster` creates a SQLite transaction
3. The change is broadcast to all cluster nodes via corosync CPG
4. All nodes acknowledge the change
5. The SQLite transaction is committed on all nodes
6. The FUSE write returns success

If a node is unreachable during a write, the operation blocks until the node responds or the cluster detects a failure and reconfigures membership.

## Cluster Formation and Membership

### Cluster Creation

A new cluster is initialized with:

```bash
pvecm create <clustername> --link0 <address>
```

This generates:
- A new cluster SSL Certificate Authority
- Initial corosync.conf with the first node
- SSH keys for inter-node communication
- The pmxcfs database

### Node Joining

Additional nodes join the cluster with:

```bash
pvecm add <existing-node-ip>
```

The joining flow:
1. New node sends join request to existing cluster node
2. Existing node authenticates the request (SSH key verification)
3. New node receives the cluster configuration
4. Corosync starts on the new node
5. The cluster renegotiates membership
6. pmxcfs syncs to the new node
7. All cluster services start on the new node

### Membership and Quorum

Corosync tracks cluster membership through periodic heartbeat messages:

- **Token passing**: The totem protocol passes a token around the ring. If a node fails to receive the token within a timeout, it is suspected failed.
- **Consensus**: After a membership change, all remaining nodes must agree on the new membership set.
- **Quorum**: At least `floor(N/2) + 1` nodes must be online for quorum. Without quorum, cluster operations are limited:
  - Configuration writes are blocked
  - HA resources are not started
  - Existing VMs/CTs continue running
  - Management reads are still possible

Quorum is enforced by `corosync_votequorum`. For a 3-node cluster, 2 nodes are needed for quorum. Two-node clusters can use `two_node: 1` which allows operation with either node up.

## High Availability

The HA system ensures that critical workloads (VMs and containers) are automatically restarted when a node fails.

### HA Components

#### CRM (Cluster Resource Manager)

The CRM runs as a single active instance across the cluster, elected via the cluster leader election. Responsibilities:

- **Resource scheduling**: Decides which node should run each HA resource
- **State machine**: Manages the lifecycle of HA resources (stopped → started → migrate → error)
- **Fencing coordination**: Initiates node fencing when required
- **Policy evaluation**: Applies HA group policies (e.g., "prefer node1, then node2")

The CRM elects a leader using the lowest-node-ID algorithm. If the CRM leader fails, another node takes over within ~20 seconds.

#### LRM (Local Resource Manager)

The LRM runs on every node and executes commands from the CRM:

- **Starting/stopping resources**: Calls qemu-server or pve-container to manage VMs/CTs
- **Health monitoring**: Reports resource status back to the CRM (started, stopped, error)
- **Watchdog integration**: Uses hardware watchdog (or softdog) to ensure LRM responsiveness

### HA Resource Lifecycle

```
                  ┌──────────────────┐
                  │    Stopped       │
                  └────────┬─────────┘
                           │ request_start
                  ┌────────▼─────────┐
                  │   Starting       │◄──── service_go_online (CRM)
                  └────────┬─────────┘
                           │ started
                  ┌────────▼─────────┐
            ┌────►│    Started       │
            │     └────────┬─────────┘
            │              │ stop
            │     ┌────────▼─────────┐
            │     │   Stopping       │
            │     └────────┬─────────┘
            │              │ stopped
            │     ┌────────▼─────────┐
            └─────│   Stopped        │
                  └────────┬─────────┘
                           │ error
                  ┌────────▼─────────┐
                  │    Error         │────► recovery (auto-restart)
                  └──────────────────┘
      stopped (forced) ──► Fenced (node reboot)
```

### Fencing

Fencing ensures that a failed node is isolated from shared resources before resources are recovered:

**Watchdog-based fencing** (default): Each node has a hardware or software watchdog (watchdog(4)). The LRM periodically pets the watchdog. If the LRM stops responding (node crash), the watchdog triggers a node reboot.

**STONITH fencing**: For shared storage configurations, STONITH (Shoot The Other Node In The Head) can be used. Supported fence devices:
- `fence_ipmilan` — IPMI/BMC-based power control
- `fence_ilo` — HP iLO
- `fence_drac` — Dell DRAC
- `fence_vmware` — VMware ESXi guest control
- `fence_apc` — APC PDU power control

### Service Recovery Policies

When an HA service fails, the CRM follows this recovery sequence:

1. **Local restart**: Attempt to restart on the same node (up to `max_restart` times)
2. **Migrate**: Move to another node in the same HA group
3. **Wait**: If no node is available, wait and retry
4. **Error**: After exhausting retries, mark as error

Configurable parameters:
```ini
/ha/resources/
  ├── vm:100/
  │   ├── state: started
  │   ├── group: production
  │   ├── max_restart: 3
  │   ├── max_relocate: 1
  │   └── target_node: node1
  └── ct:200/
      ├── state: started
      └── group: default
```

### HA Groups

Groups define placement policies:

```ini
/ha/groups.cfg:
group: production
    nodes: node1,node2,node3
    priority: 100
    restricted: 1
    nofailback: 0

group: test
    nodes: node3
    priority: 50
```

- **nodes**: Ordered list of preferred nodes
- **restricted**: If 1, resources only run on listed nodes
- **nofailback**: If 1, don't move resources back to preferred node after recovery
- **priority**: Higher priority groups get preference during recovery

## Live Migration

Migration moves a running VM or CT from one node to another with zero downtime:

### Pre-Copy Migration

1. **Setup**: Target node allocates resources (memory, disk)
2. **Pre-copy**: Source sends all memory pages to target while VM continues running
3. **Dirty page tracking**: QEMU tracks pages modified during step 2
4. **Iterative copy**: Repeatedly send dirty pages until the dirty page rate is low
5. **Stop-and-copy**: VM is paused, remaining state is transferred
6. **Resume**: VM resumes on the target node

### Post-Copy Migration

For very large-memory VMs with high dirty page rates:

1. VM execution is immediately transferred to the target
2. Memory pages are fetched on demand (demand paging) from the source
3. Background thread copies remaining pages
4. Network latency is critical for performance

### Storage Migration

Migration handles three storage scenarios:
- **Shared storage**: Only memory migration is needed (VMDK/RBD/iSCSI is already accessible from both nodes)
- **Local storage with replication**: ZFS snapshots are replicated to the target before memory migration starts
- **Local storage without replication**: Full disk copy using block-level streaming during migration

## References

- [Corosync Cluster Engine Documentation](https://corosync.github.io/corosync/)
- [Kronosnet Documentation](https://kronosnet.org/)
- [Proxmox VE HA Manager Documentation](https://pve.proxmox.com/wiki/High_Availability)
- [Proxmox Cluster Filesystem (pmxcfs) Architecture](https://pve.proxmox.com/wiki/Proxmox_Cluster_file_system_(pmxcfs))
