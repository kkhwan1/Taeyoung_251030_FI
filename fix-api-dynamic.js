const fs = require('fs');
const path = require('path');

const filesToFix = [
  './src/app/api/reports/cash-flow/route.ts',
  './src/app/api/price-history/months/route.ts',
  './src/app/api/stock/alerts/route.ts',
  './src/app/api/stock/reports/route.ts',
  './src/app/api/stock/simple/route.ts',
  './src/app/api/bom/full-tree/route.ts',
  './src/app/api/notifications/preferences/route.ts'
];

let fixedCount = 0;

filesToFix.forEach(filePath => {
  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP: ${filePath} (file not found)`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');

  // Check if already has dynamic export
  if (content.includes("export const dynamic = 'force-dynamic'")) {
    console.log(`SKIP: ${filePath} (already has force-dynamic)`);
    return;
  }

  // Find the first import statement
  const importMatch = content.match(/^import .+$/m);

  if (!importMatch) {
    console.log(`SKIP: ${filePath} (no import statements found)`);
    return;
  }

  // Find all imports at the top
  const lines = content.split('\n');
  let lastImportIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('import{')) {
      lastImportIndex = i;
    } else if (lines[i].trim() === '' || lines[i].trim().startsWith('//') || lines[i].trim().startsWith('/*') || lines[i].trim().startsWith('*')) {
      // Allow blank lines and comments after imports
      continue;
    } else if (lastImportIndex > 0) {
      // Found first non-import, non-blank line after imports
      break;
    }
  }

  // Insert the dynamic export after the last import
  lines.splice(lastImportIndex + 1, 0, '', '// Force dynamic rendering', "export const dynamic = 'force-dynamic';");

  content = lines.join('\n');

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`FIXED: ${filePath}`);
  fixedCount++;
});

console.log(`\nTotal files fixed: ${fixedCount}`);
