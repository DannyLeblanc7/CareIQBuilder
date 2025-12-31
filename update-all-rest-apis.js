/**
 * Script to update all Scripted REST API files to use getGlobalDebugSetting()
 * instead of gs.getProperty() for debug logging
 *
 * Usage: node update-all-rest-apis.js
 */

const fs = require('fs');
const path = require('path');

// Pattern to find
const oldPattern = /var isDebugEnabled = gs\.getProperty\('x_cadal_careiq_e_0\.careiq\.platform\.globalDebug'\) === 'true';/g;

// Replacement pattern
const newPattern = `// Instantiate CareIQ Services to get debug setting
        var careiqServices = new x_cadal_careiq_e_0.CareIQExperienceServices();
        var isDebugEnabled = careiqServices.getGlobalDebugSetting();`;

// Find all *-api*.js files in the directory
const directory = 'C:/Users/zolmo/ServiceNow/CareIQ Builder - Start to work';
const allFiles = fs.readdirSync(directory);
const apiFiles = allFiles
    .filter(f => f.includes('-api') && f.endsWith('.js'))
    .map(f => path.join(directory, f));

let updatedCount = 0;
let skippedCount = 0;
let errorCount = 0;

console.log(`Found ${apiFiles.length} API files to check...`);
console.log('');

apiFiles.forEach(filePath => {
    const fileName = path.basename(filePath);

    try {
        // Skip if already updated (check for CareIQExperienceServices)
        const content = fs.readFileSync(filePath, 'utf8');

        if (content.includes('CareIQExperienceServices')) {
            console.log(`⏭️  SKIP: ${fileName} (already updated)`);
            skippedCount++;
            return;
        }

        if (content.match(oldPattern)) {
            // Update the file
            const updatedContent = content.replace(oldPattern, newPattern);
            fs.writeFileSync(filePath, updatedContent, 'utf8');
            console.log(`✅ UPDATED: ${fileName}`);
            updatedCount++;
        } else {
            console.log(`⏭️  SKIP: ${fileName} (pattern not found)`);
            skippedCount++;
        }
    } catch (error) {
        console.log(`❌ ERROR: ${fileName} - ${error.message}`);
        errorCount++;
    }
});

console.log('');
console.log('='.repeat(60));
console.log('SUMMARY:');
console.log(`  ✅ Updated: ${updatedCount} files`);
console.log(`  ⏭️  Skipped: ${skippedCount} files`);
console.log(`  ❌ Errors: ${errorCount} files`);
console.log(`  📊 Total: ${apiFiles.length} files`);
console.log('='.repeat(60));
console.log('');
console.log('NOTE: Review the changes with git diff before committing.');
