const fs = require('fs');
const path = require('path');

const filesToFix = [
  './src/app/invoices/page.tsx',
  './src/app/master/companies/page.tsx',
  './src/app/master/items/page.tsx',
  './src/app/page.tsx',
  './src/app/payments/page.tsx',
  './src/app/process/page.tsx',
  './src/app/purchases/page.tsx',
  './src/app/sales/page.tsx'
];

let fixedCount = 0;

filesToFix.forEach(filePath => {
  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP: ${filePath} (file not found)`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');

  // Check if both patterns exist
  const hasDynamicExport = content.includes('export const dynamic =');
  const hasDynamicImport = content.includes("import dynamic from 'next/dynamic'");

  if (!hasDynamicExport || !hasDynamicImport) {
    console.log(`SKIP: ${filePath} (no naming collision)`);
    return;
  }

  // Replace import dynamic from 'next/dynamic' with import dynamicImport from 'next/dynamic'
  content = content.replace(
    /import dynamic from ['"]next\/dynamic['"]/g,
    "import dynamicImport from 'next/dynamic'"
  );

  // Replace all dynamic(...) calls with dynamicImport(...)
  // But be careful not to replace 'export const dynamic'
  content = content.replace(
    /const\s+(\w+)\s*=\s*dynamic\(/g,
    'const $1 = dynamicImport('
  );

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`FIXED: ${filePath}`);
  fixedCount++;
});

console.log(`\nTotal files fixed: ${fixedCount}`);
