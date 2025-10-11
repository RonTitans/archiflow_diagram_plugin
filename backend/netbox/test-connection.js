/**
 * Test NetBox Connection
 * Quick script to test if NetBox API client can connect and fetch data
 */

require('dotenv').config();
const netboxClient = require('./client');

async function testNetBoxConnection() {
  console.log('====================================');
  console.log('Testing NetBox API Connection');
  console.log('====================================\n');

  try {
    // Test 1: Basic connection
    console.log('1. Testing basic connection...');
    const connectionTest = await netboxClient.testConnection();
    console.log('✅ Connection successful!\n');

    // Test 2: Fetch sites
    console.log('2. Fetching sites...');
    const sites = await netboxClient.getSites();
    console.log(`✅ Fetched ${sites.length} sites:`);
    sites.forEach(site => {
      console.log(`   - ${site.name} (ID: ${site.id}, Slug: ${site.slug})`);
    });
    console.log('');

    // Test 3: Fetch device types
    console.log('3. Fetching device types...');
    const deviceTypes = await netboxClient.getDeviceTypes();
    console.log(`✅ Fetched ${deviceTypes.length} device types:`);
    deviceTypes.forEach(dt => {
      console.log(`   - ${dt.manufacturer.name} ${dt.model} (ID: ${dt.id})`);
    });
    console.log('');

    // Test 4: Fetch IP prefixes
    console.log('4. Fetching IP prefixes...');
    const prefixes = await netboxClient.getPrefixes();
    console.log(`✅ Fetched ${prefixes.length} IP prefixes:`);
    prefixes.forEach(prefix => {
      const siteName = prefix.site ? prefix.site.name : 'Global';
      console.log(`   - ${prefix.prefix} (Site: ${siteName}, Status: ${prefix.status.label})`);
    });
    console.log('');

    // Test 5: Fetch VLANs
    console.log('5. Fetching VLANs...');
    const vlans = await netboxClient.getVLANs();
    console.log(`✅ Fetched ${vlans.length} VLANs:`);
    vlans.forEach(vlan => {
      console.log(`   - VLAN ${vlan.vid}: ${vlan.name}`);
    });
    console.log('');

    // Test 6: Fetch device roles
    console.log('6. Fetching device roles...');
    const roles = await netboxClient.getDeviceRoles();
    console.log(`✅ Fetched ${roles.length} device roles:`);
    roles.forEach(role => {
      console.log(`   - ${role.name} (Slug: ${role.slug})`);
    });
    console.log('');

    console.log('====================================');
    console.log('✅ All tests passed!');
    console.log('NetBox API client is working correctly.');
    console.log('====================================');

  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the test
testNetBoxConnection();
