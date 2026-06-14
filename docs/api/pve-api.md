# PVE API Reference Overview

## Introduction

The Proxmox VE (PVE) API provides a comprehensive RESTful interface for managing all aspects of the virtual environment: nodes, VMs, containers, storage, networking, cluster, users, and permissions. The API is versioned as `api2/json` and returns JSON-formatted responses.

This document provides an overview of the API structure, authentication, common endpoints, and usage patterns.

## API Structure

### Base URL

```
https://<pve-host>:8006/api2/json/
```

### API Categories

The API is organized into a hierarchical path structure:

```
/api2/json/
  ├── access/                 # Authentication and authorization
  ├── cluster/                # Cluster-wide configuration
  ├── nodes/                  # Per-node resources
  │   └── <node>/
  │       ├── qemu/           # KVM virtual machines
  │       ├── lxc/            # LXC containers
  │       ├── storage/        # Storage content management
  │       ├── network/        # Network interface configuration
  │       ├── disks/          # Physical disk management
  │       ├── firewall/       # Node-level firewall
  │       ├── services/       # Systemd service management
  │       ├── tasks/          # Task (job) management
  │       ├── vzdump/         # Backup (vzdump)
  │       └── certinfo/       # SSL certificate information
  ├── pools/                  # Resource pools
  ├── storage/                # Storage configuration
  └── version/                # API version information
```

### HTTP Methods

| Method | Operation | Idempotent | Safe |
|--------|-----------|------------|------|
| `GET` | List or read resource | Yes | Yes |
| `POST` | Create or action | No | No |
| `PUT` | Update resource | Yes | No |
| `DELETE` | Remove resource | Yes | No |

## Authentication

### Token-Based Authentication (Recommended for Automation)

```bash
# Create an API token
pveum user token add root@pam automation --privsep 0

# Response:
# ┌────────┬──────────────────────────────────┐
# │ key    │ value                            │
# ╞════════╪══════════════════════════════════╡
# │ full-tokenid │ root@pam!automation        │
# │ value        │ a1b2c3d4-e5f6-...          │
# └────────┴──────────────────────────────────┘
```

Use the token in requests:

```bash
# API token authentication header
curl -H "Authorization: PVEAPIToken=root@pam!automation=a1b2c3d4-e5f6-..." \
  https://pve1:8006/api2/json/nodes
```

### Ticket-Based Authentication (Interactive)

```bash
# Obtain a ticket
curl -k -d "username=root@pam&password=<password>" \
  https://pve1:8006/api2/json/access/ticket

# Response contains:
# {
#   "data": {
#     "ticket": "PVE:root@pam:abc123...",
#     "CSRFPreventionToken": "abc123:def456..."
#   }
# }
```

## Common Endpoints

### Node Management

```bash
# List all nodes in the cluster
GET /api2/json/nodes

# Get node status
GET /api2/json/nodes/<node>/status

# Get node resource usage (RRD data)
GET /api2/json/nodes/<node>/rrddata?timeframe=hour

# Reboot node
POST /api2/json/nodes/<node>/status --data "command=reboot"

# Execute commands on node
POST /api2/json/nodes/<node>/execute --data "command=uptime"
```

### VM Management (QEMU)

```bash
# List VMs on a node
GET /api2/json/nodes/<node>/qemu
# Response: [{vmid, name, status, mem, cpu, disk, ...}]

# Get VM configuration
GET /api2/json/nodes/<node>/qemu/<vmid>/config

# Create a new VM
POST /api2/json/nodes/<node>/qemu
  --data "vmid=100"
  --data "name=web-01"
  --data "memory=4096"
  --data "cores=4"
  --data "ostype=l26"
  --data "scsi0=local-zfs:32"

# Start/Stop/Reboot VM
POST /api2/json/nodes/<node>/qemu/<vmid>/status/start
POST /api2/json/nodes/<node>/qemu/<vmid>/status/stop
POST /api2/json/nodes/<node>/qemu/<vmid>/status/reboot

# VM snapshots
POST /api2/json/nodes/<node>/qemu/<vmid>/snapshot
  --data "snapname=pre-update"
  --data "description=Before kernel update"

GET /api2/json/nodes/<node>/qemu/<vmid>/snapshot
DELETE /api2/json/nodes/<node>/qemu/<vmid>/snapshot/<snapname>

# Live migration
POST /api2/json/nodes/<node>/qemu/<vmid>/migrate
  --data "target=<target-node>"
  --data "online=1"

# VM resize (hot-add CPU/memory)
PUT /api2/json/nodes/<node>/qemu/<vmid>/resize
  --data "disk=scsi0"
  --data "size=+10G"

# Get VM VNC/SPICE console
POST /api2/json/nodes/<node>/qemu/<vmid>/spiceproxy
POST /api2/json/nodes/<node>/qemu/<vmid>/vncproxy
```

### Container Management (LXC)

```bash
# List containers
GET /api2/json/nodes/<node>/lxc

# Create container
POST /api2/json/nodes/<node>/lxc
  --data "vmid=200"
  --data "ostemplate=local:vztmpl/ubuntu-24.04-standard_24.04-1_amd64.tar.zst"
  --data "storage=local-zfs"
  --data "rootfs=size=32G"
  --data "net0=name=eth0,bridge=vmbr0,ip=dhcp"

# Container lifecycle
POST /api2/json/nodes/<node>/lxc/<ctid>/status/start
POST /api2/json/nodes/<node>/lxc/<ctid>/status/stop

# Container console
POST /api2/json/nodes/<node>/lxc/<ctid>/vncproxy

# Execute command inside container
POST /api2/json/nodes/<node>/lxc/<ctid>/exec
  --data "command=apt-get update"
```

### Storage Management

```bash
# List all storage backends
GET /api2/json/storage

# Get storage content
GET /api2/json/nodes/<node>/storage/<storage>/content

# Create a new storage (via API, requires datacenter perms)
POST /api2/json/storage
  --data "storage=backup-zfs"
  --data "type=zfspool"
  --data "pool=rpool/backup"
  --data "content=backup"

# Upload ISO
POST /api2/json/nodes/<node>/storage/<storage>/upload
  --data "content=iso"
  --data "filename=debian-12.iso"
  --data-urlencode "tmpfile@/tmp/debian-12.iso"

# Remove a volume
DELETE /api2/json/nodes/<node>/storage/<storage>/content/<volid>

# Get storage status (usage, health)
GET /api2/json/nodes/<node>/storage/<storage>/status
```

### Cluster Management

```bash
# Cluster status
GET /api2/json/cluster/status

# Cluster resource map (all VMs/CTs across all nodes)
GET /api2/json/cluster/resources
GET /api2/json/cluster/resources?type=vm
GET /api2/json/cluster/resources?type=storage

# Cluster logs
GET /api2/json/cluster/log

# Cluster options
GET /api2/json/cluster/options
PUT /api2/json/cluster/options
  --data "console=xtermjs"

# Join info
GET /api2/json/cluster/config/join
```

### Firewall Management

```bash
# Cluster firewall options
GET /api2/json/cluster/firewall/options
PUT /api2/json/cluster/firewall/options
  --data "enable=1"

# Cluster firewall rules
GET /api2/json/cluster/firewall/rules
POST /api2/json/cluster/firewall/rules
  --data "action=ACCEPT"
  --data "source=10.0.0.0/8"
  --data "dest=+management"
  --data "proto=tcp"
  --data "dport=8006"

# VM/CT firewall
GET /api2/json/nodes/<node>/qemu/<vmid>/firewall/rules
POST /api2/json/nodes/<node>/qemu/<vmid>/firewall/rules
  --data "action=DROP"
  --data "source=0.0.0.0/0"
  --data "dport=22"
```

### User and Permission Management

```bash
# List users
GET /api2/json/access/users

# Create user
POST /api2/json/access/users
  --data "userid=joe@pve"
  --data "password=securepassword"
  --data "enable=1"

# List roles
GET /api2/json/access/roles

# List ACL entries
GET /api2/json/access/acl

# Set ACL
PUT /api2/json/access/acl
  --data "path=/vms/100"
  --data "userid=joe@pve"
  --data "role=VMAdmin"

# List authentication realms
GET /api2/json/access/realms
```

### HA Management

```bash
# List HA resources
GET /api2/json/cluster/ha/resources

# Add HA resource
POST /api2/json/cluster/ha/resources
  --data "sid=vm:100"
  --data "state=started"
  --data "group=production"

# HA resource status
GET /api2/json/cluster/ha/resources/status

# HA groups
GET /api2/json/cluster/ha/groups
POST /api2/json/cluster/ha/groups
  --data "group=production"
  --data "nodes=node1,node2,node3"
  --data "restricted=1"
```

### Task Management

```bash
# List running/finished tasks
GET /api2/json/nodes/<node>/tasks

# Get task log
GET /api2/json/nodes/<node>/tasks/<upid>/log

# Task status
GET /api2/json/nodes/<node>/tasks/<upid>/status

# Stop a running task
DELETE /api2/json/nodes/<node>/tasks/<upid>
```

## API Error Handling

### Response Format

Successful response:
```json
{
  "data": { ... }
}
```

Error response:
```json
{
  "errors": {
    "vmid": "already exists"
  },
  "data": null
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/expired ticket) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Internal Server Error |
| 501 | Not Implemented |

### Rate Limiting

The API may return `429 Too Many Requests` with a `Retry-After` header when rate limits are exceeded.

## API Best Practices

1. **Use API tokens** for automation (not passwords)
2. **Handle pagination** with `?limit=N&start=offset` for large lists
3. **Use WebSocket** for real-time updates (console, task log streaming)
4. **Check task UPID** after long-running operations to track completion
5. **Cache responses** with appropriate ETags/If-None-Match headers
6. **Batch operations** when possible to reduce API calls

## References

- [PVE API Viewer](https://pve.proxmox.com/pve-docs/api-viewer/)
- [Proxmox VE API Specification](https://pve.proxmox.com/wiki/Proxmox_VE_API)
- [Archmox API Proxy](https://github.com/archmox/archmox/blob/main/worker/index.js)
