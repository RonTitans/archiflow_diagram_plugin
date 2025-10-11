/**
 * NetBox API Client
 *
 * Handles all communication with NetBox REST API
 * Documentation: https://docs.netbox.dev/en/stable/integrations/rest-api/
 */

const axios = require('axios');

class NetBoxClient {
  constructor() {
    this.baseURL = process.env.NETBOX_URL || 'http://netbox:8080';
    this.token = process.env.NETBOX_API_TOKEN || '0123456789abcdef0123456789abcdef01234567';

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Token ${this.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    console.log(`[NetBox Client] Initialized with URL: ${this.baseURL}`);
  }

  /**
   * Test connection to NetBox
   */
  async testConnection() {
    try {
      const response = await this.client.get('/api/');
      console.log('[NetBox Client] Connection successful');
      return { success: true, version: response.data };
    } catch (error) {
      console.error('[NetBox Client] Connection failed:', error.message);
      throw new Error(`NetBox connection failed: ${error.message}`);
    }
  }

  /**
   * ==========================================
   * SITES
   * ==========================================
   */

  /**
   * Get all sites from NetBox
   * @returns {Promise<Array>} List of sites
   */
  async getSites() {
    try {
      const response = await this.client.get('/api/dcim/sites/');
      console.log(`[NetBox] Fetched ${response.data.count} sites`);
      return response.data.results;
    } catch (error) {
      console.error('[NetBox] Error fetching sites:', error.message);
      throw error;
    }
  }

  /**
   * Get single site by ID
   * @param {number} siteId - NetBox site ID
   * @returns {Promise<Object>} Site details
   */
  async getSite(siteId) {
    try {
      const response = await this.client.get(`/api/dcim/sites/${siteId}/`);
      return response.data;
    } catch (error) {
      console.error(`[NetBox] Error fetching site ${siteId}:`, error.message);
      throw error;
    }
  }

  /**
   * ==========================================
   * DEVICE TYPES
   * ==========================================
   */

  /**
   * Get all device types from NetBox
   * @returns {Promise<Array>} List of device types
   */
  async getDeviceTypes() {
    try {
      const response = await this.client.get('/api/dcim/device-types/');
      console.log(`[NetBox] Fetched ${response.data.count} device types`);
      return response.data.results;
    } catch (error) {
      console.error('[NetBox] Error fetching device types:', error.message);
      throw error;
    }
  }

  /**
   * Get single device type by ID
   * @param {number} deviceTypeId - NetBox device type ID
   * @returns {Promise<Object>} Device type details
   */
  async getDeviceType(deviceTypeId) {
    try {
      const response = await this.client.get(`/api/dcim/device-types/${deviceTypeId}/`);
      return response.data;
    } catch (error) {
      console.error(`[NetBox] Error fetching device type ${deviceTypeId}:`, error.message);
      throw error;
    }
  }

  /**
   * ==========================================
   * DEVICE ROLES
   * ==========================================
   */

  /**
   * Get all device roles from NetBox
   * @returns {Promise<Array>} List of device roles
   */
  async getDeviceRoles() {
    try {
      const response = await this.client.get('/api/dcim/device-roles/');
      console.log(`[NetBox] Fetched ${response.data.count} device roles`);
      return response.data.results;
    } catch (error) {
      console.error('[NetBox] Error fetching device roles:', error.message);
      throw error;
    }
  }

  /**
   * ==========================================
   * IP PREFIXES (IP Pools)
   * ==========================================
   */

  /**
   * Get all IP prefixes from NetBox
   * @param {number} siteId - Optional: filter by site ID
   * @returns {Promise<Array>} List of prefixes
   */
  async getPrefixes(siteId = null) {
    try {
      const params = siteId ? { site_id: siteId } : {};
      const response = await this.client.get('/api/ipam/prefixes/', { params });
      console.log(`[NetBox] Fetched ${response.data.count} prefixes`);
      return response.data.results;
    } catch (error) {
      console.error('[NetBox] Error fetching prefixes:', error.message);
      throw error;
    }
  }

  /**
   * Get available IPs from a prefix
   * @param {number} prefixId - NetBox prefix ID
   * @returns {Promise<Array>} List of available IP addresses
   */
  async getAvailableIPs(prefixId) {
    try {
      const response = await this.client.get(`/api/ipam/prefixes/${prefixId}/available-ips/`);
      console.log(`[NetBox] Fetched available IPs from prefix ${prefixId}`);
      return response.data;
    } catch (error) {
      console.error(`[NetBox] Error fetching available IPs from prefix ${prefixId}:`, error.message);
      throw error;
    }
  }

  /**
   * ==========================================
   * VLANS
   * ==========================================
   */

  /**
   * Get all VLANs from NetBox
   * @param {number} siteId - Optional: filter by site ID
   * @returns {Promise<Array>} List of VLANs
   */
  async getVLANs(siteId = null) {
    try {
      const params = siteId ? { site_id: siteId } : {};
      const response = await this.client.get('/api/ipam/vlans/', { params });
      console.log(`[NetBox] Fetched ${response.data.count} VLANs`);
      return response.data.results;
    } catch (error) {
      console.error('[NetBox] Error fetching VLANs:', error.message);
      throw error;
    }
  }

  /**
   * ==========================================
   * DEVICES (Deployment)
   * ==========================================
   */

  /**
   * Create a new device in NetBox
   * @param {Object} deviceData - Device configuration
   * @returns {Promise<Object>} Created device
   */
  async createDevice(deviceData) {
    try {
      const response = await this.client.post('/api/dcim/devices/', deviceData);
      console.log(`[NetBox] Created device: ${response.data.name} (ID: ${response.data.id})`);
      return response.data;
    } catch (error) {
      console.error('[NetBox] Error creating device:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Update an existing device in NetBox
   * @param {number} deviceId - NetBox device ID
   * @param {Object} deviceData - Updated device data
   * @returns {Promise<Object>} Updated device
   */
  async updateDevice(deviceId, deviceData) {
    try {
      const response = await this.client.patch(`/api/dcim/devices/${deviceId}/`, deviceData);
      console.log(`[NetBox] Updated device ID ${deviceId}`);
      return response.data;
    } catch (error) {
      console.error(`[NetBox] Error updating device ${deviceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get device by name
   * @param {string} deviceName - Device name
   * @returns {Promise<Object|null>} Device or null if not found
   */
  async getDeviceByName(deviceName) {
    try {
      const response = await this.client.get('/api/dcim/devices/', {
        params: { name: deviceName }
      });
      return response.data.count > 0 ? response.data.results[0] : null;
    } catch (error) {
      console.error(`[NetBox] Error fetching device ${deviceName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get all devices from NetBox (for checking existing device names)
   * @param {Object} filters - Optional filters (site_id, name__ic, etc.)
   * @returns {Promise<Array>} List of devices
   */
  async getDevices(filters = {}) {
    try {
      const response = await this.client.get('/api/dcim/devices/', {
        params: filters
      });
      console.log(`[NetBox] Fetched ${response.data.count} devices`);
      return response.data.results;
    } catch (error) {
      console.error('[NetBox] Error fetching devices:', error.message);
      throw error;
    }
  }

  /**
   * Get devices matching a name pattern (for auto-naming)
   * @param {string} namePattern - Device name pattern (e.g., "SW-MAIN")
   * @returns {Promise<Array>} Matching devices
   */
  async getDevicesByPattern(namePattern) {
    try {
      const response = await this.client.get('/api/dcim/devices/', {
        params: {
          name__isw: namePattern,  // name starts with (case-insensitive)
          limit: 100
        }
      });
      console.log(`[NetBox] Found ${response.data.count} devices matching pattern: ${namePattern}`);
      return response.data.results;
    } catch (error) {
      console.error(`[NetBox] Error fetching devices by pattern ${namePattern}:`, error.message);
      throw error;
    }
  }

  /**
   * ==========================================
   * INTERFACES
   * ==========================================
   */

  /**
   * Create an interface on a device
   * @param {Object} interfaceData - Interface configuration
   * @returns {Promise<Object>} Created interface
   */
  async createInterface(interfaceData) {
    try {
      const response = await this.client.post('/api/dcim/interfaces/', interfaceData);
      console.log(`[NetBox] Created interface: ${response.data.name} (ID: ${response.data.id})`);
      return response.data;
    } catch (error) {
      console.error('[NetBox] Error creating interface:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * ==========================================
   * IP ADDRESSES
   * ==========================================
   */

  /**
   * Create an IP address assignment
   * @param {Object} ipData - IP address configuration
   * @returns {Promise<Object>} Created IP address
   */
  async createIPAddress(ipData) {
    try {
      const response = await this.client.post('/api/ipam/ip-addresses/', ipData);
      console.log(`[NetBox] Created IP address: ${response.data.address} (ID: ${response.data.id})`);
      return response.data;
    } catch (error) {
      console.error('[NetBox] Error creating IP address:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get IP addresses with optional filters
   * @param {Object} params - Query parameters (e.g., { address: '10.0.0.1' })
   * @returns {Promise<Array>} IP addresses
   */
  async getIPAddresses(params = {}) {
    try {
      const response = await this.client.get('/api/ipam/ip-addresses/', { params });
      console.log(`[NetBox] Fetched ${response.data.results.length} IP addresses`);
      return response.data.results;
    } catch (error) {
      console.error('[NetBox] Error fetching IP addresses:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Update an existing IP address
   * @param {number} ipId - IP address ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object>} Updated IP address
   */
  async updateIPAddress(ipId, updateData) {
    try {
      const response = await this.client.patch(`/api/ipam/ip-addresses/${ipId}/`, updateData);
      console.log(`[NetBox] Updated IP address: ${response.data.address} (ID: ${ipId})`);
      return response.data;
    } catch (error) {
      console.error('[NetBox] Error updating IP address:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * ==========================================
   * CABLES
   * ==========================================
   */

  /**
   * Create a cable connection between interfaces
   * @param {Object} cableData - Cable configuration
   * @returns {Promise<Object>} Created cable
   */
  async createCable(cableData) {
    try {
      const response = await this.client.post('/api/dcim/cables/', cableData);
      console.log(`[NetBox] Created cable (ID: ${response.data.id})`);
      return response.data;
    } catch (error) {
      console.error('[NetBox] Error creating cable:', error.response?.data || error.message);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new NetBoxClient();
