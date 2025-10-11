const { v4: uuidv4 } = require('uuid');

class NetworkDeviceManager {
    constructor(db) {
        this.db = db;
    }

    // =====================================================
    // Device CRUD Operations
    // =====================================================

    async getDevices(filters = {}) {
        try {
            let query = `
                SELECT
                    d.*,
                    s.name as site_name,
                    array_agg(DISTINCT jsonb_build_object(
                        'id', ip.id,
                        'ip_address', ip.ip_address,
                        'subnet', ip.subnet,
                        'vlan_id', ip.vlan_id,
                        'interface_name', ip.interface_name,
                        'is_primary', ip.is_primary
                    )) FILTER (WHERE ip.id IS NOT NULL) as ip_addresses
                FROM archiflow.network_devices d
                LEFT JOIN archiflow.sites s ON d.site_id = s.id
                LEFT JOIN archiflow.ip_allocations ip ON d.id = ip.device_id
                WHERE 1=1
            `;

            const params = [];
            let paramCount = 0;

            if (filters.device_type) {
                paramCount++;
                query += ` AND d.device_type = $${paramCount}`;
                params.push(filters.device_type);
            }

            if (filters.status) {
                paramCount++;
                query += ` AND d.status = $${paramCount}`;
                params.push(filters.status);
            }

            if (filters.site_id) {
                paramCount++;
                query += ` AND d.site_id = $${paramCount}`;
                params.push(filters.site_id);
            }

            query += ` GROUP BY d.id, s.name ORDER BY d.name`;

            const result = await this.db.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('[NetworkDeviceManager] Error getting devices:', error);
            throw error;
        }
    }

    async getDevice(deviceId) {
        try {
            const query = `
                SELECT
                    d.*,
                    s.name as site_name,
                    array_agg(DISTINCT jsonb_build_object(
                        'id', ip.id,
                        'ip_address', ip.ip_address,
                        'subnet', ip.subnet,
                        'vlan_id', ip.vlan_id,
                        'interface_name', ip.interface_name,
                        'is_primary', ip.is_primary
                    )) FILTER (WHERE ip.id IS NOT NULL) as ip_addresses
                FROM archiflow.network_devices d
                LEFT JOIN archiflow.sites s ON d.site_id = s.id
                LEFT JOIN archiflow.ip_allocations ip ON d.id = ip.device_id
                WHERE d.id = $1
                GROUP BY d.id, s.name
            `;

            const result = await this.db.query(query, [deviceId]);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error getting device:', error);
            throw error;
        }
    }

    async createDevice(deviceData) {
        try {
            const {
                name,
                device_type,
                manufacturer,
                model,
                serial_number,
                asset_id,
                status = 'active',
                location,
                rack_position,
                site_id,
                metadata = {},
                created_by = 'system'
            } = deviceData;

            const query = `
                INSERT INTO archiflow.network_devices (
                    name, device_type, manufacturer, model,
                    serial_number, asset_id, status, location,
                    rack_position, site_id, metadata, created_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *
            `;

            const params = [
                name, device_type, manufacturer, model,
                serial_number, asset_id, status, location,
                rack_position, site_id, JSON.stringify(metadata), created_by
            ];

            const result = await this.db.query(query, params);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error creating device:', error);
            throw error;
        }
    }

    async updateDevice(deviceId, updates) {
        try {
            const allowedFields = [
                'name', 'device_type', 'manufacturer', 'model',
                'serial_number', 'asset_id', 'status', 'location',
                'rack_position', 'site_id', 'metadata', 'modified_by'
            ];

            const setClauses = [];
            const params = [];
            let paramCount = 1;

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    setClauses.push(`${key} = $${paramCount}`);
                    params.push(key === 'metadata' ? JSON.stringify(value) : value);
                    paramCount++;
                }
            }

            if (setClauses.length === 0) {
                return null;
            }

            params.push(deviceId);
            const query = `
                UPDATE archiflow.network_devices
                SET ${setClauses.join(', ')}, modified_at = NOW()
                WHERE id = $${paramCount}
                RETURNING *
            `;

            const result = await this.db.query(query, params);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error updating device:', error);
            throw error;
        }
    }

    async deleteDevice(deviceId) {
        try {
            const query = `
                DELETE FROM archiflow.network_devices
                WHERE id = $1
                RETURNING id, name
            `;

            const result = await this.db.query(query, [deviceId]);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error deleting device:', error);
            throw error;
        }
    }

    // =====================================================
    // IP Address Management
    // =====================================================

    async allocateIP(deviceId, ipData) {
        try {
            const {
                ip_address,
                subnet,
                vlan_id,
                interface_name,
                mac_address,
                is_primary = false,
                allocation_type = 'static',
                dns_servers,
                gateway
            } = ipData;

            const query = `
                INSERT INTO archiflow.ip_allocations (
                    device_id, ip_address, subnet, vlan_id,
                    interface_name, mac_address, is_primary,
                    allocation_type, dns_servers, gateway
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;

            const params = [
                deviceId, ip_address, subnet, vlan_id,
                interface_name, mac_address, is_primary,
                allocation_type, dns_servers, gateway
            ];

            const result = await this.db.query(query, params);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error allocating IP:', error);
            throw error;
        }
    }

    async releaseIP(allocationId) {
        try {
            const query = `
                DELETE FROM archiflow.ip_allocations
                WHERE id = $1
                RETURNING *
            `;

            const result = await this.db.query(query, [allocationId]);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error releasing IP:', error);
            throw error;
        }
    }

    async getNextAvailableIP(poolId) {
        try {
            const query = `SELECT archiflow.get_next_available_ip($1) as next_ip`;
            const result = await this.db.query(query, [poolId]);
            return result.rows[0]?.next_ip;
        } catch (error) {
            console.error('[NetworkDeviceManager] Error getting next available IP:', error);
            throw error;
        }
    }

    // Allocate an IP from ip_addresses table
    async allocateIPFromPool(ipAddress, deviceName, poolId = null, vlanId = null) {
        try {
            // Get the NetBox prefix to determine the subnet
            let subnet = null;
            if (poolId) {
                const prefixQuery = `SELECT prefix FROM archiflow.netbox_prefixes WHERE netbox_id = $1`;
                const prefixResult = await this.db.query(prefixQuery, [poolId]);
                if (prefixResult.rows.length > 0) {
                    subnet = prefixResult.rows[0].prefix;
                }
            }

            // Check if IP is already allocated
            const checkQuery = `
                SELECT * FROM archiflow.ip_allocations
                WHERE ip_address = $1
            `;
            const checkResult = await this.db.query(checkQuery, [ipAddress]);

            if (checkResult.rows.length > 0) {
                console.log('[NetworkDeviceManager] IP already allocated:', ipAddress);
                return null;
            }

            // Insert new IP allocation with VLAN
            const insertQuery = `
                INSERT INTO archiflow.ip_allocations (
                    ip_address,
                    subnet,
                    vlan_id,
                    allocation_type,
                    created_at
                )
                VALUES ($1, $2, $3, 'static', NOW())
                RETURNING *
            `;

            const result = await this.db.query(insertQuery, [ipAddress, subnet, vlanId]);

            console.log('[NetworkDeviceManager] IP allocated successfully:', ipAddress, 'from prefix', subnet, 'with VLAN', vlanId);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error allocating IP:', error);
            throw error;
        }
    }

    // Release an IP back to the pool
    async releaseIPFromPool(ipAddress) {
        try {
            const query = `
                DELETE FROM archiflow.ip_allocations
                WHERE ip_address = $1
                RETURNING *
            `;

            const result = await this.db.query(query, [ipAddress]);

            if (result.rows.length === 0) {
                console.log('[NetworkDeviceManager] IP not found or already released:', ipAddress);
                return null;
            }

            console.log('[NetworkDeviceManager] IP released successfully:', ipAddress);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error releasing IP:', error);
            throw error;
        }
    }

    // =====================================================
    // Port Connection Management
    // =====================================================

    async createConnection(connectionData) {
        try {
            const {
                source_device_id,
                source_port,
                target_device_id,
                target_port,
                connection_type = 'ethernet',
                bandwidth,
                duplex = 'full',
                vlan_ids,
                is_trunk = false,
                status = 'active'
            } = connectionData;

            const query = `
                INSERT INTO archiflow.port_connections (
                    source_device_id, source_port, target_device_id,
                    target_port, connection_type, bandwidth, duplex,
                    vlan_ids, is_trunk, status
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;

            const params = [
                source_device_id, source_port, target_device_id,
                target_port, connection_type, bandwidth, duplex,
                vlan_ids, is_trunk, status
            ];

            const result = await this.db.query(query, params);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error creating connection:', error);
            throw error;
        }
    }

    async getDeviceConnections(deviceId) {
        try {
            const query = `
                SELECT
                    c.*,
                    sd.name as source_device_name,
                    td.name as target_device_name
                FROM archiflow.port_connections c
                JOIN archiflow.network_devices sd ON c.source_device_id = sd.id
                JOIN archiflow.network_devices td ON c.target_device_id = td.id
                WHERE c.source_device_id = $1 OR c.target_device_id = $1
                ORDER BY c.created_at DESC
            `;

            const result = await this.db.query(query, [deviceId]);
            return result.rows;
        } catch (error) {
            console.error('[NetworkDeviceManager] Error getting connections:', error);
            throw error;
        }
    }

    async deleteConnection(connectionId) {
        try {
            const query = `
                DELETE FROM archiflow.port_connections
                WHERE id = $1
                RETURNING *
            `;

            const result = await this.db.query(query, [connectionId]);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error deleting connection:', error);
            throw error;
        }
    }

    async isPortAvailable(deviceId, portName) {
        try {
            const query = `SELECT archiflow.is_port_available($1, $2) as available`;
            const result = await this.db.query(query, [deviceId, portName]);
            return result.rows[0]?.available || false;
        } catch (error) {
            console.error('[NetworkDeviceManager] Error checking port availability:', error);
            throw error;
        }
    }

    // =====================================================
    // Template Management
    // =====================================================

    async getDeviceTemplates(category = null) {
        try {
            // Get device types from NetBox cache
            let query = `
                SELECT
                    netbox_id as id,
                    model as name,
                    manufacturer_name as category,
                    manufacturer_name as manufacturer,
                    model,
                    slug as device_type,
                    manufacturer_slug,
                    part_number,
                    u_height,
                    is_full_depth,
                    description,
                    front_image_url,
                    rear_image_url
                FROM archiflow.netbox_device_types
                WHERE 1=1
            `;

            const params = [];
            if (category) {
                query += ` AND manufacturer_name = $1`;
                params.push(category);
            }

            query += ` ORDER BY manufacturer_name, model`;

            const result = await this.db.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('[NetworkDeviceManager] Error getting templates:', error);
            throw error;
        }
    }

    async createDeviceFromTemplate(templateId, deviceData) {
        try {
            // Get template
            const templateQuery = `
                SELECT * FROM archiflow.device_templates
                WHERE id = $1
            `;
            const templateResult = await this.db.query(templateQuery, [templateId]);
            const template = templateResult.rows[0];

            if (!template) {
                throw new Error('Template not found');
            }

            // Merge template data with provided data
            const mergedData = {
                device_type: template.device_type,
                manufacturer: template.manufacturer,
                model: template.model,
                ...deviceData,
                metadata: {
                    ...template.metadata,
                    ...deviceData.metadata,
                    template_id: templateId
                }
            };

            return await this.createDevice(mergedData);
        } catch (error) {
            console.error('[NetworkDeviceManager] Error creating device from template:', error);
            throw error;
        }
    }

    // =====================================================
    // VLAN Management
    // =====================================================

    async getVLANs(siteId = null) {
        try {
            // Get VLANs from NetBox cache (include site-specific and global VLANs)
            let query = `
                SELECT
                    netbox_id as id,
                    vid,
                    name,
                    site_id,
                    site_name,
                    status,
                    role_name,
                    description
                FROM archiflow.netbox_vlans
                WHERE status = 'active'
            `;

            const params = [];
            if (siteId) {
                query += ` AND (site_id = $1 OR site_id IS NULL)`;
                params.push(siteId);
            }

            query += ` ORDER BY vid`;

            const result = await this.db.query(query, params);
            console.log(`[NetworkDeviceManager] Found ${result.rows.length} VLANs for site: ${siteId || 'all'}`);
            return result.rows;
        } catch (error) {
            console.error('[NetworkDeviceManager] Error getting VLANs:', error);
            throw error;
        }
    }

    // =====================================================
    // IP Pool Management
    // =====================================================

    async getIPPools(siteId = null) {
        try {
            // Get IP prefixes from NetBox cache (all active prefixes can be used for IP allocation)
            let query = `
                SELECT
                    netbox_id as id,
                    prefix as network,
                    prefix as name,
                    family,
                    site_id,
                    site_name,
                    vlan_id,
                    status,
                    role_name,
                    is_pool,
                    description,
                    0 as allocated_count
                FROM archiflow.netbox_prefixes
                WHERE status = 'active'
            `;

            const params = [];
            if (siteId) {
                // Filter by specific site (allow NULL site_id too with OR condition)
                query += ` AND (site_id = $1 OR site_id IS NULL)`;
                params.push(siteId);
            }
            // If siteId is not provided, return ALL prefixes (no additional filter)

            query += ` ORDER BY prefix`;

            const result = await this.db.query(query, params);
            console.log(`[NetworkDeviceManager] Found ${result.rows.length} IP pools for site: ${siteId || 'all'}`);
            return result.rows;
        } catch (error) {
            console.error('[NetworkDeviceManager] Error getting IP pools:', error);
            throw error;
        }
    }

    async getPoolIPAddresses(poolId, limit = 254) {
        try {
            // Get NetBox prefix details
            const prefixQuery = `SELECT * FROM archiflow.netbox_prefixes WHERE netbox_id = $1`;
            const prefixResult = await this.db.query(prefixQuery, [poolId]);

            if (prefixResult.rows.length === 0) {
                throw new Error('IP Prefix not found');
            }

            const prefix = prefixResult.rows[0];

            // Generate all IPs from CIDR
            const allIPs = this.generateIPsFromCIDR(prefix.prefix, limit);

            // CRITICAL FIX: Get allocated IPs from NetBox cache ONLY (don't mix with ArchiFlow tables)
            // This shows REAL-TIME data from NetBox, not stale cache
            const allocatedQuery = `
                SELECT DISTINCT
                    CASE
                        WHEN address LIKE '%/%' THEN split_part(address, '/', 1)
                        ELSE address
                    END as ip_address,
                    device_name,
                    synced_at as allocated_at,
                    'netbox' as source
                FROM archiflow.netbox_ip_addresses
                WHERE device_name IS NOT NULL
                  AND address::inet << $1::inet
            `;
            const allocatedResult = await this.db.query(allocatedQuery, [prefix.prefix]);
            const allocatedMap = {};
            allocatedResult.rows.forEach(row => {
                allocatedMap[row.ip_address] = {
                    device_name: row.device_name,
                    allocated_at: row.allocated_at,
                    source: row.source
                };
            });

            console.log(`[NetworkDeviceManager] Found ${allocatedResult.rows.length} allocated IPs in prefix ${prefix.prefix}`);

            // Format IPs with allocation status
            const ips = allIPs.map(ip => {
                const allocated = allocatedMap[ip];
                return {
                    ip_address: ip,
                    is_allocated: !!allocated,
                    device_name: allocated ? allocated.device_name : null,
                    allocated_at: allocated ? allocated.allocated_at : null,
                    is_gateway: false,
                    is_reserved: false
                };
            });

            return {
                prefix: prefix.prefix,
                ips
            };
        } catch (error) {
            console.error('[NetworkDeviceManager] Error getting pool IPs:', error);
            throw error;
        }
    }

    // Helper method to generate all IPs from a CIDR prefix
    generateIPsFromCIDR(cidr, limit = 254) {
        const [networkIP, prefixLength] = cidr.split('/');
        const prefix = parseInt(prefixLength);

        // Convert IP to integer
        const ipToInt = (ip) => {
            return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
        };

        // Convert integer to IP
        const intToIP = (int) => {
            return [
                (int >>> 24) & 255,
                (int >>> 16) & 255,
                (int >>> 8) & 255,
                int & 255
            ].join('.');
        };

        const networkInt = ipToInt(networkIP);
        const hostBits = 32 - prefix;
        const numHosts = Math.pow(2, hostBits);
        const maxIPs = Math.min(numHosts - 2, limit); // -2 for network and broadcast, respect limit

        const ips = [];
        for (let i = 1; i <= maxIPs; i++) { // Start from 1 to skip network address
            ips.push(intToIP(networkInt + i));
        }

        return ips;
    }

    // =====================================================
    // Diagram Integration
    // =====================================================

    async mapDeviceToDiagram(deviceId, diagramId, cellData) {
        try {
            const {
                cell_id,
                x_position,
                y_position,
                width,
                height,
                style
            } = cellData;

            const query = `
                INSERT INTO archiflow.device_diagram_mapping (
                    device_id, diagram_id, cell_id,
                    x_position, y_position, width, height, style
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (device_id, diagram_id)
                DO UPDATE SET
                    cell_id = $3,
                    x_position = $4,
                    y_position = $5,
                    width = $6,
                    height = $7,
                    style = $8,
                    modified_at = NOW()
                RETURNING *
            `;

            const params = [
                deviceId, diagramId, cell_id,
                x_position, y_position, width, height, style
            ];

            const result = await this.db.query(query, params);
            return result.rows[0];
        } catch (error) {
            console.error('[NetworkDeviceManager] Error mapping device to diagram:', error);
            throw error;
        }
    }

    async getDevicesInDiagram(diagramId) {
        try {
            const query = `
                SELECT
                    d.*,
                    m.cell_id,
                    m.x_position,
                    m.y_position,
                    m.width,
                    m.height,
                    m.style,
                    array_agg(DISTINCT jsonb_build_object(
                        'id', ip.id,
                        'ip_address', ip.ip_address,
                        'vlan_id', ip.vlan_id,
                        'interface_name', ip.interface_name
                    )) FILTER (WHERE ip.id IS NOT NULL) as ip_addresses
                FROM archiflow.device_diagram_mapping m
                JOIN archiflow.network_devices d ON m.device_id = d.id
                LEFT JOIN archiflow.ip_allocations ip ON d.id = ip.device_id
                WHERE m.diagram_id = $1
                GROUP BY d.id, m.cell_id, m.x_position, m.y_position, m.width, m.height, m.style
            `;

            const result = await this.db.query(query, [diagramId]);
            return result.rows;
        } catch (error) {
            console.error('[NetworkDeviceManager] Error getting devices in diagram:', error);
            throw error;
        }
    }

    /**
     * CRITICAL FIX: Get next available device name counter from NetBox cache + local DB
     * Prevents duplicate device names by checking BOTH NetBox and ArchiFlow databases
     * @param {string} prefix - Device type prefix (SW, RTR, FW, etc.)
     * @param {string} siteCode - Site code (e.g., MAIN, BACKUP, SITE)
     * @returns {Promise<number>} Next available counter number
     */
    async getNextDeviceCounter(prefix, siteCode) {
        try {
            const pattern = `${prefix}-${siteCode}-%`;
            let maxNumber = 0;

            // Query BOTH NetBox cache AND local database for device names
            const query = `
                SELECT name FROM archiflow.netbox_devices WHERE name LIKE $1
                UNION
                SELECT name FROM archiflow.network_devices WHERE name LIKE $1
                ORDER BY name DESC
                LIMIT 100
            `;

            const result = await this.db.query(query, [pattern]);

            console.log(`[NetworkDeviceManager] Found ${result.rows.length} existing devices matching pattern: ${pattern}`);

            if (result.rows.length === 0) {
                console.log(`[NetworkDeviceManager] No existing devices found, starting at 1`);
                return 1;
            }

            // Parse device names to extract numbers
            // Pattern: SW-MAIN-01, RTR-BACKUP-02, etc.
            const regex = new RegExp(`^${prefix}-${siteCode}-(\\d+)$`, 'i');

            for (const row of result.rows) {
                const match = row.name.match(regex);
                if (match && match[1]) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNumber) {
                        maxNumber = num;
                    }
                }
            }

            console.log(`[NetworkDeviceManager] Max number found: ${maxNumber}, returning ${maxNumber + 1}`);

            // Return next available number
            return maxNumber + 1;

        } catch (error) {
            console.error('[NetworkDeviceManager] Error getting next device counter:', error);
            // If error, return 1 as fallback
            return 1;
        }
    }
}

module.exports = NetworkDeviceManager;