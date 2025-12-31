/**
 * Script to help generate the data migration for configuration properties
 * This shows the properties that need to be in the custom table
 *
 * You'll need to manually create these records in ServiceNow or export from sys_properties
 */

console.log('Configuration properties that need to be in the custom table:');
console.log('Table: x_cadal_careiq_e_0_careiq_system_properties');
console.log('');
console.log('Required records (name -> value):');
console.log('='.repeat(80));

const properties = [
    { name: 'x_cadal_careiq_e_0.careiq.platform.token', description: 'Auth token (refreshed automatically)' },
    { name: 'x_cadal_careiq_e_0.careiq.platform.app', description: 'App identifier (e.g., "app")' },
    { name: 'x_cadal_careiq_e_0.careiq.platform.region', description: 'Region (e.g., "stg" or "prod")' },
    { name: 'x_cadal_careiq_e_0.careiq.platform.version', description: 'API version (e.g., "v1")' },
    { name: 'x_cadal_careiq_e_0.careiq.platform.id', description: 'Client ID' },
    { name: 'x_cadal_careiq_e_0.careiq.platform.otoken', description: 'OAuth token' },
    { name: 'x_cadal_careiq_e_0.careiq.platform.apikey', description: 'API key' },
    { name: 'x_cadal_careiq_e_0.careiq.platform.staticurl', description: 'Static URL part (e.g., ".careiq.cadalysapp.com/api/")' },
    { name: 'x_cadal_careiq_e_0.careiq.platform.globalDebug', description: 'Debug logging flag ("true" or "false")' }
];

properties.forEach((prop, index) => {
    console.log(`${index + 1}. NAME: ${prop.name}`);
    console.log(`   DESCRIPTION: ${prop.description}`);
    console.log(`   VALUE: <copy from sys_properties>`);
    console.log('');
});

console.log('='.repeat(80));
console.log('');
console.log('To migrate:');
console.log('1. In ServiceNow, navigate to sys_properties table');
console.log('2. Filter for "x_cadal_careiq_e_0.careiq.platform"');
console.log('3. Copy the NAME and VALUE from each record');
console.log('4. Create new records in x_cadal_careiq_e_0_careiq_system_properties with same NAME and VALUE');
console.log('5. Test by calling a CareIQ Services method');
