/**
 * NetBox Sync Service
 *
 * Handles synchronization of NetBox data to ArchiFlow cache tables
 */

const netboxClient = require('./client');
const { Pool } = require('pg');

class NetBoxSyncService {
  constructor(dbPool) {
    this.db = dbPool;
    console.log('[NetBox Sync] Service initialized');
  }

  /**
   * Sync all NetBox data to ArchiFlow cache
   * IMPORTANT: Must delete child tables (prefixes/vlans) before parent (sites) due to FK constraints
   */
  async syncAll() {
    console.log('[NetBox Sync] Starting full sync...');
    const results = {};

    try {
      // Sync in order to avoid FK constraint violations:
      // 1. Clear child tables first (prefixes and vlans reference sites)
      await this.db.query('DELETE FROM archiflow.netbox_prefixes');
      await this.db.query('DELETE FROM archiflow.netbox_vlans');
      // 2. Then clear parent tables
      await this.db.query('DELETE FROM archiflow.netbox_sites');
      await this.db.query('DELETE FROM archiflow.netbox_device_types');
      await this.db.query('DELETE FROM archiflow.netbox_device_roles');

      // 3. Now sync in proper order (parents first, then children)
      results.sites = await this.syncSites();
      results.deviceTypes = await this.syncDeviceTypes();
      results.deviceRoles = await this.syncDeviceRoles();
      results.prefixes = await this.syncPrefixes();
      results.vlans = await this.syncVLANs();

      // 4. CRITICAL FIX: Sync devices and IP addresses for accurate name/IP checking
      results.devices = await this.syncDevices();
      results.ipAddresses = await this.syncIPAddresses();

      console.log('[NetBox Sync] Full sync completed successfully');
      return {
        success: true,
        synced_at: new Date().toISOString(),
        results
      };
    } catch (error) {
      console.error('[NetBox Sync] Full sync failed:', error.message);
      throw error;
    }
  }

  /**
   * Sync sites from NetBox
   */
  async syncSites() {
    console.log('[NetBox Sync] Syncing sites...');

    try {
      // Update sync status to in_progress
      await this.updateSyncStatus('sites', 'in_progress', 'Fetching sites from NetBox');

      // Fetch sites from NetBox
      const sites = await netboxClient.getSites();

      // Insert new data (table already cleared in syncAll)
      let syncedCount = 0;
      for (const site of sites) {
        await this.db.query(`
          INSERT INTO archiflow.netbox_sites (
            netbox_id, name, slug, status, description, facility,
            time_zone, physical_address, latitude, longitude,
            custom_fields, synced_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          ON CONFLICT (netbox_id) DO UPDATE SET
            name = EXCLUDED.name,
            slug = EXCLUDED.slug,
            status = EXCLUDED.status,
            description = EXCLUDED.description,
            facility = EXCLUDED.facility,
            time_zone = EXCLUDED.time_zone,
            physical_address = EXCLUDED.physical_address,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            custom_fields = EXCLUDED.custom_fields,
            synced_at = NOW()
        `, [
          site.id,
          site.name,
          site.slug,
          site.status.value,
          site.description || null,
          site.facility || null,
          site.time_zone || null,
          site.physical_address || null,
          site.latitude || null,
          site.longitude || null,
          JSON.stringify(site.custom_fields || {})
        ]);
        syncedCount++;
      }

      // Update sync status to success
      await this.updateSyncStatus('sites', 'success', `Synced ${syncedCount} sites`, syncedCount);

      console.log(`[NetBox Sync] ✅ Synced ${syncedCount} sites`);
      return { count: syncedCount, success: true };

    } catch (error) {
      await this.updateSyncStatus('sites', 'failed', error.message);
      console.error('[NetBox Sync] Failed to sync sites:', error.message);
      throw error;
    }
  }

  /**
   * Sync device types from NetBox
   */
  async syncDeviceTypes() {
    console.log('[NetBox Sync] Syncing device types...');

    try {
      await this.updateSyncStatus('device_types', 'in_progress', 'Fetching device types from NetBox');

      const deviceTypes = await netboxClient.getDeviceTypes();

      // Insert new data (table already cleared in syncAll)
      let syncedCount = 0;
      for (const dt of deviceTypes) {
        await this.db.query(`
          INSERT INTO archiflow.netbox_device_types (
            netbox_id, manufacturer_name, manufacturer_slug, model, slug,
            part_number, u_height, is_full_depth, description,
            front_image_url, rear_image_url, custom_fields, synced_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
          ON CONFLICT (netbox_id) DO UPDATE SET
            manufacturer_name = EXCLUDED.manufacturer_name,
            manufacturer_slug = EXCLUDED.manufacturer_slug,
            model = EXCLUDED.model,
            slug = EXCLUDED.slug,
            part_number = EXCLUDED.part_number,
            u_height = EXCLUDED.u_height,
            is_full_depth = EXCLUDED.is_full_depth,
            description = EXCLUDED.description,
            front_image_url = EXCLUDED.front_image_url,
            rear_image_url = EXCLUDED.rear_image_url,
            custom_fields = EXCLUDED.custom_fields,
            synced_at = NOW()
        `, [
          dt.id,
          dt.manufacturer.name,
          dt.manufacturer.slug,
          dt.model,
          dt.slug,
          dt.part_number || null,
          dt.u_height || null,
          dt.is_full_depth,
          dt.description || null,
          dt.front_image || null,
          dt.rear_image || null,
          JSON.stringify(dt.custom_fields || {})
        ]);
        syncedCount++;
      }

      await this.updateSyncStatus('device_types', 'success', `Synced ${syncedCount} device types`, syncedCount);

      console.log(`[NetBox Sync] ✅ Synced ${syncedCount} device types`);
      return { count: syncedCount, success: true };

    } catch (error) {
      await this.updateSyncStatus('device_types', 'failed', error.message);
      console.error('[NetBox Sync] Failed to sync device types:', error.message);
      throw error;
    }
  }

  /**
   * Sync device roles from NetBox
   */
  async syncDeviceRoles() {
    console.log('[NetBox Sync] Syncing device roles...');

    try {
      await this.updateSyncStatus('device_roles', 'in_progress', 'Fetching device roles from NetBox');

      const roles = await netboxClient.getDeviceRoles();

      // Insert new data (table already cleared in syncAll)
      let syncedCount = 0;
      for (const role of roles) {
        await this.db.query(`
          INSERT INTO archiflow.netbox_device_roles (
            netbox_id, name, slug, color, vm_role, description, custom_fields, synced_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (netbox_id) DO UPDATE SET
            name = EXCLUDED.name,
            slug = EXCLUDED.slug,
            color = EXCLUDED.color,
            vm_role = EXCLUDED.vm_role,
            description = EXCLUDED.description,
            custom_fields = EXCLUDED.custom_fields,
            synced_at = NOW()
        `, [
          role.id,
          role.name,
          role.slug,
          role.color,
          role.vm_role,
          role.description || null,
          JSON.stringify(role.custom_fields || {})
        ]);
        syncedCount++;
      }

      await this.updateSyncStatus('device_roles', 'success', `Synced ${syncedCount} device roles`, syncedCount);

      console.log(`[NetBox Sync] ✅ Synced ${syncedCount} device roles`);
      return { count: syncedCount, success: true };

    } catch (error) {
      await this.updateSyncStatus('device_roles', 'failed', error.message);
      console.error('[NetBox Sync] Failed to sync device roles:', error.message);
      throw error;
    }
  }

  /**
   * Sync IP prefixes from NetBox
   */
  async syncPrefixes() {
    console.log('[NetBox Sync] Syncing IP prefixes...');

    try {
      await this.updateSyncStatus('prefixes', 'in_progress', 'Fetching IP prefixes from NetBox');

      const prefixes = await netboxClient.getPrefixes();

      // Insert new data (table already cleared in syncAll)
      let syncedCount = 0;
      for (const prefix of prefixes) {
        await this.db.query(`
          INSERT INTO archiflow.netbox_prefixes (
            netbox_id, prefix, family, site_id, site_name, vlan_id,
            status, role_name, is_pool, description, custom_fields, synced_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          ON CONFLICT (netbox_id) DO UPDATE SET
            prefix = EXCLUDED.prefix,
            family = EXCLUDED.family,
            site_id = EXCLUDED.site_id,
            site_name = EXCLUDED.site_name,
            vlan_id = EXCLUDED.vlan_id,
            status = EXCLUDED.status,
            role_name = EXCLUDED.role_name,
            is_pool = EXCLUDED.is_pool,
            description = EXCLUDED.description,
            custom_fields = EXCLUDED.custom_fields,
            synced_at = NOW()
        `, [
          prefix.id,
          prefix.prefix,
          prefix.family.value,
          prefix.site?.id || null,
          prefix.site?.name || null,
          prefix.vlan?.id || null,
          prefix.status.value,
          prefix.role?.name || null,
          prefix.is_pool,
          prefix.description || null,
          JSON.stringify(prefix.custom_fields || {})
        ]);
        syncedCount++;
      }

      await this.updateSyncStatus('prefixes', 'success', `Synced ${syncedCount} prefixes`, syncedCount);

      console.log(`[NetBox Sync] ✅ Synced ${syncedCount} IP prefixes`);
      return { count: syncedCount, success: true };

    } catch (error) {
      await this.updateSyncStatus('prefixes', 'failed', error.message);
      console.error('[NetBox Sync] Failed to sync prefixes:', error.message);
      throw error;
    }
  }

  /**
   * Sync VLANs from NetBox
   */
  async syncVLANs() {
    console.log('[NetBox Sync] Syncing VLANs...');

    try {
      await this.updateSyncStatus('vlans', 'in_progress', 'Fetching VLANs from NetBox');

      const vlans = await netboxClient.getVLANs();

      // Insert new data (table already cleared in syncAll)
      let syncedCount = 0;
      for (const vlan of vlans) {
        await this.db.query(`
          INSERT INTO archiflow.netbox_vlans (
            netbox_id, vid, name, site_id, site_name, status,
            role_name, description, custom_fields, synced_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          ON CONFLICT (netbox_id) DO UPDATE SET
            vid = EXCLUDED.vid,
            name = EXCLUDED.name,
            site_id = EXCLUDED.site_id,
            site_name = EXCLUDED.site_name,
            status = EXCLUDED.status,
            role_name = EXCLUDED.role_name,
            description = EXCLUDED.description,
            custom_fields = EXCLUDED.custom_fields,
            synced_at = NOW()
        `, [
          vlan.id,
          vlan.vid,
          vlan.name,
          vlan.site?.id || null,
          vlan.site?.name || null,
          vlan.status.value,
          vlan.role?.name || null,
          vlan.description || null,
          JSON.stringify(vlan.custom_fields || {})
        ]);
        syncedCount++;
      }

      await this.updateSyncStatus('vlans', 'success', `Synced ${syncedCount} VLANs`, syncedCount);

      console.log(`[NetBox Sync] ✅ Synced ${syncedCount} VLANs`);
      return { count: syncedCount, success: true };

    } catch (error) {
      await this.updateSyncStatus('vlans', 'failed', error.message);
      console.error('[NetBox Sync] Failed to sync VLANs:', error.message);
      throw error;
    }
  }

  /**
   * Update sync status in database
   */
  async updateSyncStatus(entityType, status, message = null, recordsCount = 0) {
    await this.db.query(`
      INSERT INTO archiflow.netbox_sync_status (entity_type, sync_status, sync_message, records_synced, last_sync_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (entity_type) DO UPDATE SET
        sync_status = EXCLUDED.sync_status,
        sync_message = EXCLUDED.sync_message,
        records_synced = EXCLUDED.records_synced,
        last_sync_at = NOW()
    `, [entityType, status, message, recordsCount]);
  }

  /**
   * Get sync status for all entities
   */
  async getSyncStatus() {
    const result = await this.db.query(`
      SELECT entity_type, last_sync_at, sync_status, sync_message, records_synced
      FROM archiflow.netbox_sync_status
      ORDER BY entity_type
    `);
    return result.rows;
  }

  /**
   * Get cached sites from database
   */
  async getCachedSites() {
    const result = await this.db.query(`
      SELECT * FROM archiflow.netbox_sites
      ORDER BY name
    `);
    return result.rows;
  }

  /**
   * Get cached device types from database
   */
  async getCachedDeviceTypes() {
    const result = await this.db.query(`
      SELECT * FROM archiflow.netbox_device_types
      ORDER BY manufacturer_name, model
    `);
    return result.rows;
  }

  /**
   * Get cached prefixes from database
   */
  async getCachedPrefixes(siteId = null) {
    const query = siteId
      ? 'SELECT * FROM archiflow.netbox_prefixes WHERE site_id = $1 ORDER BY prefix'
      : 'SELECT * FROM archiflow.netbox_prefixes ORDER BY prefix';

    const params = siteId ? [siteId] : [];
    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get cached VLANs from database
   */
  async getCachedVLANs(siteId = null) {
    const query = siteId
      ? 'SELECT * FROM archiflow.netbox_vlans WHERE site_id = $1 ORDER BY vid'
      : 'SELECT * FROM archiflow.netbox_vlans ORDER BY vid';

    const params = siteId ? [siteId] : [];
    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get cached device roles from database
   */
  async getCachedDeviceRoles() {
    const result = await this.db.query(`
      SELECT * FROM archiflow.netbox_device_roles
      ORDER BY name
    `);
    return result.rows;
  }

  /**
   * CRITICAL FIX: Sync existing devices from NetBox
   * This ensures device name checking works correctly
   */
  async syncDevices() {
    console.log('[NetBox Sync] Syncing devices from NetBox...');

    try {
      await this.updateSyncStatus('devices', 'in_progress', 'Fetching devices from NetBox');

      // Fetch all devices from NetBox
      const devices = await netboxClient.getDevices();

      // Clear existing cache
      await this.db.query('DELETE FROM archiflow.netbox_devices');

      let syncedCount = 0;

      for (const device of devices) {
        await this.db.query(`
          INSERT INTO archiflow.netbox_devices (
            netbox_id, name, device_type_name, device_role_name,
            site_id, site_name, status, primary_ip4, primary_ip6,
            serial, asset_tag, platform_name, rack_name, position,
            custom_fields, synced_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
          ON CONFLICT (netbox_id) DO UPDATE SET
            name = EXCLUDED.name,
            device_type_name = EXCLUDED.device_type_name,
            device_role_name = EXCLUDED.device_role_name,
            site_id = EXCLUDED.site_id,
            site_name = EXCLUDED.site_name,
            status = EXCLUDED.status,
            primary_ip4 = EXCLUDED.primary_ip4,
            primary_ip6 = EXCLUDED.primary_ip6,
            serial = EXCLUDED.serial,
            asset_tag = EXCLUDED.asset_tag,
            platform_name = EXCLUDED.platform_name,
            rack_name = EXCLUDED.rack_name,
            position = EXCLUDED.position,
            custom_fields = EXCLUDED.custom_fields,
            synced_at = NOW()
        `, [
          device.id,
          device.name,
          device.device_type?.model || null,
          device.device_role?.name || device.role?.name || null,
          device.site?.id || null,
          device.site?.name || null,
          device.status?.value || 'active',
          device.primary_ip4?.address || null,
          device.primary_ip6?.address || null,
          device.serial || null,
          device.asset_tag || null,
          device.platform?.name || null,
          device.rack?.name || null,
          device.position || null,
          JSON.stringify(device.custom_fields || {})
        ]);
        syncedCount++;
      }

      await this.updateSyncStatus('devices', 'success', `Synced ${syncedCount} devices`, syncedCount);

      console.log(`[NetBox Sync] ✅ Synced ${syncedCount} device names from NetBox to cache`);
      return { count: syncedCount, success: true };

    } catch (error) {
      await this.updateSyncStatus('devices', 'failed', error.message);
      console.error('[NetBox Sync] Failed to sync devices:', error.message);
      throw error;
    }
  }

  /**
   * CRITICAL FIX: Sync IP addresses from NetBox
   * This ensures IP allocation status is accurate
   */
  async syncIPAddresses(prefixId = null) {
    console.log('[NetBox Sync] Syncing IP addresses from NetBox...');

    try {
      await this.updateSyncStatus('ip_addresses', 'in_progress', 'Fetching IP addresses from NetBox');

      // Fetch all IP addresses from NetBox
      const params = prefixId ? { parent: prefixId } : {};
      const ipAddresses = await netboxClient.getIPAddresses(params);

      // Clear existing cache
      await this.db.query('DELETE FROM archiflow.netbox_ip_addresses');

      let syncedCount = 0;

      for (const ip of ipAddresses) {
        // Store all IPs, even unallocated ones (we'll check assigned_object for availability)
        await this.db.query(`
          INSERT INTO archiflow.netbox_ip_addresses (
            netbox_id, address, status, assigned_object_type, assigned_object_id,
            device_name, interface_name, dns_name, description, custom_fields, synced_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT (netbox_id) DO UPDATE SET
            address = EXCLUDED.address,
            status = EXCLUDED.status,
            assigned_object_type = EXCLUDED.assigned_object_type,
            assigned_object_id = EXCLUDED.assigned_object_id,
            device_name = EXCLUDED.device_name,
            interface_name = EXCLUDED.interface_name,
            dns_name = EXCLUDED.dns_name,
            description = EXCLUDED.description,
            custom_fields = EXCLUDED.custom_fields,
            synced_at = NOW()
        `, [
          ip.id,
          ip.address,
          ip.status?.value || 'active',
          ip.assigned_object_type || null,
          ip.assigned_object_id || null,
          ip.assigned_object?.device?.name || null,
          ip.assigned_object?.name || null,
          ip.dns_name || null,
          ip.description || null,
          JSON.stringify(ip.custom_fields || {})
        ]);
        syncedCount++;
      }

      await this.updateSyncStatus('ip_addresses', 'success', `Synced ${syncedCount} IPs`, syncedCount);

      console.log(`[NetBox Sync] ✅ Synced ${syncedCount} IP addresses from NetBox to cache`);
      return { count: syncedCount, success: true };

    } catch (error) {
      await this.updateSyncStatus('ip_addresses', 'failed', error.message);
      console.error('[NetBox Sync] Failed to sync IP addresses:', error.message);
      throw error;
    }
  }
}

module.exports = NetBoxSyncService;
