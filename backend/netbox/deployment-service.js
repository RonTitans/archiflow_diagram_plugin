/**
 * NetBox Deployment Service
 *
 * Handles deployment of ArchiFlow diagram devices to NetBox
 * Creates devices, interfaces, IP assignments, and VLAN associations
 */

const netboxClient = require('./client');

class NetBoxDeploymentService {
  constructor(db) {
    this.netbox = netboxClient;
    this.db = db;
  }

  /**
   * Deploy a single device from ArchiFlow diagram to NetBox
   * @param {Object} deviceData - Device data from diagram
   * @param {number} siteId - NetBox site ID
   * @param {string} diagramId - ArchiFlow diagram UUID
   * @returns {Promise<Object>} Deployment result with NetBox IDs
   */
  async deployDevice(deviceData, siteId, diagramId) {
    console.log('[NetBox Deploy] Starting deployment for device:', deviceData.name);

    const result = {
      success: false,
      deviceName: deviceData.name,
      netboxDeviceId: null,
      netboxInterfaceId: null,
      netboxIpId: null,
      errors: []
    };

    try {
      console.log('[NetBox Deploy] Device data received:', JSON.stringify(deviceData, null, 2));

      // Extract template_id from metadata if present, otherwise from root
      const templateId = deviceData.metadata?.template_id || deviceData.template_id;
      const vlanId = deviceData.metadata?.vlan_id || deviceData.vlan_id;
      const ipAddress = deviceData.metadata?.ip_address || deviceData.ip_address;
      const poolId = deviceData.metadata?.pool_id || deviceData.pool_id;

      console.log('[NetBox Deploy] template_id:', templateId);
      console.log('[NetBox Deploy] device_type:', deviceData.device_type);
      console.log('[NetBox Deploy] vlan_id:', vlanId);
      console.log('[NetBox Deploy] Site ID:', siteId);

      if (!templateId) {
        throw new Error('Device template_id is required but not found in device data');
      }

      // Step 1: Get or create default device role
      const deviceRole = await this.getOrCreateDeviceRole(deviceData.device_type);
      console.log('[NetBox Deploy] Device role:', deviceRole);

      // Step 2: Create device in NetBox
      // NetBox v4 API format
      const devicePayload = {
        name: deviceData.name,
        device_type: parseInt(templateId), // NetBox device type ID (ensure it's a number)
        role: deviceRole.id,  // NetBox v4 uses 'role' not 'device_role'
        site: parseInt(siteId),  // Ensure site ID is a number
        status: 'active'
      };

      console.log('[NetBox Deploy] Sending payload to NetBox:', JSON.stringify(devicePayload, null, 2));

      const netboxDevice = await this.createNetBoxDevice(devicePayload);

      result.netboxDeviceId = netboxDevice.id;
      console.log('[NetBox Deploy] ✅ Device created:', netboxDevice.name, 'ID:', netboxDevice.id);

      // Step 3: Create management interface if IP address is provided
      if (ipAddress) {
        const netboxInterface = await this.createManagementInterface(
          netboxDevice.id,
          deviceData.name,
          vlanId  // Pass VLAN ID to interface
        );

        result.netboxInterfaceId = netboxInterface.id;
        console.log('[NetBox Deploy] ✅ Interface created:', netboxInterface.name);

        // Step 4: Assign IP address to interface
        // NetBox v4 API format for assigning IP to interface
        // Note: VLAN is set on the interface, not on the IP
        const ipPayload = {
          address: `${ipAddress}/32`,
          assigned_object_type: 'dcim.interface',
          assigned_object_id: netboxInterface.id,
          status: 'active'
        };

        console.log('[NetBox Deploy] Creating IP with payload:', JSON.stringify(ipPayload));

        const netboxIp = await this.assignIPAddress(ipPayload);

        result.netboxIpId = netboxIp.id;
        console.log('[NetBox Deploy] ✅ IP assigned:', netboxIp.address);

        // Step 5: Set as primary IP for device
        await this.setPrimaryIP(netboxDevice.id, netboxIp.id);
        console.log('[NetBox Deploy] ✅ Set as primary IP');
      }

      // Step 6: Store NetBox device ID in ArchiFlow database
      await this.storeNetBoxMapping(diagramId, deviceData, result.netboxDeviceId);

      result.success = true;
      console.log('[NetBox Deploy] ✅ Deployment complete for:', deviceData.name);

      return result;

    } catch (error) {
      console.error('[NetBox Deploy] ❌ Deployment failed:', error.message);
      result.errors.push(error.message);
      throw error;
    }
  }

  /**
   * Get existing device role or create a default one
   * @param {string} deviceType - Device type (switch, router, firewall, etc.)
   * @returns {Promise<Object>} Device role
   */
  async getOrCreateDeviceRole(deviceType) {
    try {
      // Map ArchiFlow device types to NetBox role names
      const roleNameMap = {
        'switch': 'Access Switch',
        'router': 'Router',
        'firewall': 'Firewall',
        'server': 'Server',
        'load_balancer': 'Load Balancer',
        'access_point': 'Access Point'
      };

      const roleName = roleNameMap[deviceType] || 'Network Device';

      // Try to find existing role in cache
      const cacheQuery = `
        SELECT netbox_id, name, slug
        FROM archiflow.netbox_device_roles
        WHERE name = $1
        LIMIT 1
      `;
      const cacheResult = await this.db.query(cacheQuery, [roleName]);

      if (cacheResult.rows.length > 0) {
        console.log('[NetBox Deploy] Using cached device role:', roleName);
        return {
          id: cacheResult.rows[0].netbox_id,
          name: cacheResult.rows[0].name,
          slug: cacheResult.rows[0].slug
        };
      }

      // Fetch from NetBox
      const roles = await this.netbox.getDeviceRoles();
      const role = roles.find(r => r.name === roleName);

      if (role) {
        console.log('[NetBox Deploy] Found device role:', roleName);
        return role;
      }

      // If no role found, use the first available or throw error
      if (roles.length > 0) {
        console.log('[NetBox Deploy] Using default role:', roles[0].name);
        return roles[0];
      }

      throw new Error('No device roles available in NetBox');

    } catch (error) {
      console.error('[NetBox Deploy] Error getting device role:', error.message);
      throw error;
    }
  }

  /**
   * Create device in NetBox
   * @param {Object} deviceData - NetBox device creation payload
   * @returns {Promise<Object>} Created device
   */
  async createNetBoxDevice(deviceData) {
    try {
      return await this.netbox.createDevice(deviceData);
    } catch (error) {
      // Check if device already exists
      if (error.response?.data?.name) {
        console.log('[NetBox Deploy] Device may already exist, checking...');
        const existing = await this.netbox.getDeviceByName(deviceData.name);
        if (existing) {
          console.log('[NetBox Deploy] Using existing device:', existing.name);
          return existing;
        }
      }
      throw error;
    }
  }

  /**
   * Create management interface on device
   * @param {number} deviceId - NetBox device ID
   * @param {string} deviceName - Device name for interface naming
   * @param {number|null} vlanId - Optional VLAN ID to assign as untagged VLAN
   * @returns {Promise<Object>} Created interface
   */
  async createManagementInterface(deviceId, deviceName, vlanId = null) {
    try {
      const interfaceData = {
        device: deviceId,
        name: 'Management',
        type: 'virtual', // Virtual interface for management
        enabled: true
      };

      // Add untagged VLAN if provided (for access mode)
      if (vlanId) {
        interfaceData.untagged_vlan = parseInt(vlanId);
        interfaceData.mode = 'access'; // Set to access mode for single VLAN
      }

      console.log('[NetBox Deploy] Creating interface with data:', JSON.stringify(interfaceData));

      return await this.netbox.createInterface(interfaceData);
    } catch (error) {
      console.error('[NetBox Deploy] Error creating interface:', error.message);
      throw error;
    }
  }

  /**
   * Assign IP address to device interface
   * @param {Object} ipData - IP address assignment data
   * @returns {Promise<Object>} Created or updated IP address
   */
  async assignIPAddress(ipData) {
    try {
      return await this.netbox.createIPAddress(ipData);
    } catch (error) {
      // Check if IP already exists (duplicate error)
      if (error.response?.status === 400 && error.response?.data?.address) {
        const errorMsg = JSON.stringify(error.response.data.address);
        if (errorMsg.includes('Duplicate')) {
          console.log('[NetBox Deploy] IP already exists, checking...');

          // Extract IP address without CIDR for search
          const ipAddress = ipData.address.split('/')[0];

          // Find existing IP
          const existingIPs = await this.netbox.getIPAddresses({ address: ipAddress });

          if (existingIPs && existingIPs.length > 0) {
            const existingIP = existingIPs[0];
            console.log('[NetBox Deploy] Found existing IP:', existingIP.address, 'ID:', existingIP.id);

            // Update the existing IP with new assignment
            // Note: VLAN is set on the interface, not on the IP
            const updatePayload = {
              assigned_object_type: ipData.assigned_object_type,
              assigned_object_id: ipData.assigned_object_id,
              status: ipData.status
            };

            console.log('[NetBox Deploy] Updating IP with payload:', JSON.stringify(updatePayload));

            const updatedIP = await this.netbox.updateIPAddress(existingIP.id, updatePayload);

            console.log('[NetBox Deploy] ✅ Updated existing IP:', updatedIP.address);
            return updatedIP;
          }
        }
      }

      console.error('[NetBox Deploy] Error assigning IP:', error.message);
      throw error;
    }
  }

  /**
   * Set IP as primary for device
   * @param {number} deviceId - NetBox device ID
   * @param {number} ipId - NetBox IP address ID
   * @returns {Promise<Object>} Updated device
   */
  async setPrimaryIP(deviceId, ipId) {
    try {
      return await this.netbox.updateDevice(deviceId, {
        primary_ip4: ipId
      });
    } catch (error) {
      console.error('[NetBox Deploy] Error setting primary IP:', error.message);
      // Don't throw - this is not critical
      return null;
    }
  }

  /**
   * Store NetBox device ID mapping in ArchiFlow database
   * @param {string} diagramId - ArchiFlow diagram UUID
   * @param {Object} deviceData - Device data from diagram
   * @param {number} netboxDeviceId - NetBox device ID
   */
  async storeNetBoxMapping(diagramId, deviceData, netboxDeviceId) {
    try {
      const query = `
        INSERT INTO archiflow.netbox_device_mappings (
          diagram_id,
          device_name,
          archiflow_device_data,
          netbox_device_id,
          deployed_at
        )
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (diagram_id, device_name)
        DO UPDATE SET
          netbox_device_id = EXCLUDED.netbox_device_id,
          deployed_at = NOW()
        RETURNING *
      `;

      const result = await this.db.query(query, [
        diagramId,
        deviceData.name,
        JSON.stringify(deviceData),
        netboxDeviceId
      ]);

      console.log('[NetBox Deploy] ✅ Stored mapping for device:', deviceData.name);
      return result.rows[0];

    } catch (error) {
      // If table doesn't exist, create it
      if (error.code === '42P01') { // undefined_table
        await this.createMappingTable();
        return await this.storeNetBoxMapping(diagramId, deviceData, netboxDeviceId);
      }
      console.error('[NetBox Deploy] Error storing mapping:', error.message);
      // Don't throw - mapping is nice to have but not critical
    }
  }

  /**
   * Create mapping table if it doesn't exist
   */
  async createMappingTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS archiflow.netbox_device_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        diagram_id UUID NOT NULL,
        device_name VARCHAR(255) NOT NULL,
        archiflow_device_data JSONB,
        netbox_device_id INTEGER NOT NULL,
        deployed_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(diagram_id, device_name)
      );

      CREATE INDEX IF NOT EXISTS idx_netbox_mappings_diagram
        ON archiflow.netbox_device_mappings(diagram_id);

      CREATE INDEX IF NOT EXISTS idx_netbox_mappings_netbox_device
        ON archiflow.netbox_device_mappings(netbox_device_id);
    `;

    await this.db.query(createTableQuery);
    console.log('[NetBox Deploy] ✅ Created netbox_device_mappings table');
  }

  /**
   * Deploy all devices from a diagram to NetBox
   * @param {string} diagramId - ArchiFlow diagram UUID
   * @param {Array} devices - Array of device data from diagram
   * @param {number} siteId - NetBox site ID
   * @returns {Promise<Object>} Deployment summary
   */
  async deployDiagram(diagramId, devices, siteId) {
    console.log(`[NetBox Deploy] Starting diagram deployment: ${devices.length} devices`);

    const results = {
      total: devices.length,
      succeeded: 0,
      failed: 0,
      devices: []
    };

    for (const device of devices) {
      try {
        const deployResult = await this.deployDevice(device, siteId, diagramId);
        results.devices.push(deployResult);
        results.succeeded++;
      } catch (error) {
        results.devices.push({
          success: false,
          deviceName: device.name,
          errors: [error.message]
        });
        results.failed++;
        console.error(`[NetBox Deploy] Failed to deploy ${device.name}:`, error.message);
      }
    }

    console.log(`[NetBox Deploy] Deployment complete: ${results.succeeded}/${results.total} succeeded`);
    return results;
  }

  /**
   * Update diagram status to deployed
   * @param {string} diagramId - ArchiFlow diagram UUID
   * @param {string} status - New status (draft/deployed)
   */
  async updateDiagramStatus(diagramId, status) {
    try {
      // BUG FIX #4: Update deployment_status column (not just status)
      const query = `
        UPDATE archiflow.diagrams
        SET
          deployment_status = $1::varchar,
          deployed_at = CASE WHEN $1::varchar = 'deployed' THEN NOW() ELSE deployed_at END,
          modified_at = NOW()
        WHERE id = $2::uuid
        RETURNING *
      `;

      const result = await this.db.query(query, [status, diagramId]);

      if (result.rows.length > 0) {
        console.log('[NetBox Deploy] ✅ Updated diagram deployment_status to:', status);
        return result.rows[0];
      }

      return null;

    } catch (error) {
      // Check if deployment_status column doesn't exist
      if (error.code === '42703') { // undefined_column
        await this.addDiagramStatusColumn();
        return await this.updateDiagramStatus(diagramId, status);
      }
      console.error('[NetBox Deploy] Error updating diagram status:', error.message);
      throw error;
    }
  }

  /**
   * Add deployment_status and deployed_at columns to diagrams table if they don't exist
   * BUG FIX #4: Use deployment_status column name (not status)
   */
  async addDiagramStatusColumn() {
    const alterQuery = `
      ALTER TABLE archiflow.diagrams
      ADD COLUMN IF NOT EXISTS deployment_status VARCHAR(50) DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS deployed_at TIMESTAMP;

      CREATE INDEX IF NOT EXISTS idx_diagrams_status
        ON archiflow.diagrams(status);
    `;

    await this.db.query(alterQuery);
    console.log('[NetBox Deploy] ✅ Added status column to diagrams table');
  }
}

// Export class (will be instantiated in websocket-server.js)
module.exports = NetBoxDeploymentService;
