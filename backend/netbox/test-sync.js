/**
 * Test NetBox Sync Service
 * Tests synchronization of NetBox data to ArchiFlow cache
 */

require('dotenv').config();
const { Pool } = require('pg');
const NetBoxSyncService = require('./sync-service');

// Database configuration
const dbPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'archiflow',
  user: process.env.DB_USER || 'archiflow_user',
  password: process.env.DB_PASSWORD || 'archiflow_pass',
});

async function testSync() {
  console.log('====================================');
  console.log('Testing NetBox Sync Service');
  console.log('====================================\n');

  const syncService = new NetBoxSyncService(dbPool);

  try {
    // Test 1: Sync all data
    console.log('1. Syncing all NetBox data...\n');
    const syncResult = await syncService.syncAll();
    console.log('\n✅ Sync completed!');
    console.log('Results:', JSON.stringify(syncResult, null, 2));
    console.log('');

    // Test 2: Get sync status
    console.log('2. Checking sync status...');
    const syncStatus = await syncService.getSyncStatus();
    console.log('✅ Sync status:');
    syncStatus.forEach(status => {
      console.log(`   - ${status.entity_type}: ${status.sync_status} (${status.records_synced} records)`);
    });
    console.log('');

    // Test 3: Get cached sites
    console.log('3. Retrieving cached sites...');
    const sites = await syncService.getCachedSites();
    console.log(`✅ Found ${sites.length} cached sites:`);
    sites.forEach(site => {
      console.log(`   - ${site.name} (NetBox ID: ${site.netbox_id}, Slug: ${site.slug})`);
    });
    console.log('');

    // Test 4: Get cached device types
    console.log('4. Retrieving cached device types...');
    const deviceTypes = await syncService.getCachedDeviceTypes();
    console.log(`✅ Found ${deviceTypes.length} cached device types:`);
    deviceTypes.forEach(dt => {
      console.log(`   - ${dt.manufacturer_name} ${dt.model} (NetBox ID: ${dt.netbox_id})`);
    });
    console.log('');

    // Test 5: Get cached prefixes
    console.log('5. Retrieving cached IP prefixes...');
    const prefixes = await syncService.getCachedPrefixes();
    console.log(`✅ Found ${prefixes.length} cached prefixes:`);
    prefixes.forEach(prefix => {
      const siteName = prefix.site_name || 'Global';
      console.log(`   - ${prefix.prefix} (Site: ${siteName}, Status: ${prefix.status})`);
    });
    console.log('');

    // Test 6: Get cached VLANs
    console.log('6. Retrieving cached VLANs...');
    const vlans = await syncService.getCachedVLANs();
    console.log(`✅ Found ${vlans.length} cached VLANs:`);
    vlans.forEach(vlan => {
      console.log(`   - VLAN ${vlan.vid}: ${vlan.name}`);
    });
    console.log('');

    console.log('====================================');
    console.log('✅ All sync tests passed!');
    console.log('NetBox data is now cached in ArchiFlow database.');
    console.log('====================================');

  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  } finally {
    await dbPool.end();
  }
}

// Run the test
testSync();
