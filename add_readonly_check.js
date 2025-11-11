const fs = require('fs');

const filePath = 'C:/Users/zolmo/ServiceNow/CareIQ Builder - Start to work/src/cadal-careiq-builder/index.js';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Add isReadOnly check after line 4966 (index 4965)
const readOnlyLines = [
	'',
	'\t\t\t\t\t\t// Check if assessment is read-only (published or unpublished)',
	'\t\t\t\t\t\tconst isReadOnly = state.currentAssessment?.status === \'published\' || state.currentAssessment?.status === \'unpublished\';'
];

lines.splice(4966, 0, ...readOnlyLines);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Added isReadOnly check to relationship modal');
