const fs = require('fs');
const path = require('path');

// List of files that need the fix
const filesToFix = [
  './src/app/404/page.tsx',
  './src/app/500/page.tsx',
  './src/app/accounting/summary/page.tsx',
  './src/app/admin/users/page.tsx',
  './src/app/batch-registration/page.tsx',
  './src/app/collections/page.tsx',
  './src/app/contracts/page.tsx',
  './src/app/inventory/page.tsx',
  './src/app/inventory/receiving/page.tsx',
  './src/app/invoices/page.tsx',
  './src/app/login/page.tsx',
  './src/app/master/bom/page.tsx',
  './src/app/master/items/page.tsx',
  './src/app/master/items/[id]/page.tsx',
  './src/app/monitoring/health/page.tsx',
  './src/app/page.tsx',
  './src/app/payments/page.tsx',
  './src/app/portal/dashboard/page.tsx',
  './src/app/portal/items/page.tsx',
  './src/app/portal/login/page.tsx',
  './src/app/portal/transactions/page.tsx',
  './src/app/price-management/page.tsx',
  './src/app/process/page.tsx',
  './src/app/production/page.tsx',
  './src/app/purchases/page.tsx',
  './src/app/reports/financial-statements/page.tsx',
  './src/app/reports/page.tsx',
  './src/app/sales/page.tsx',
  './src/app/stock/current/page.tsx',
  './src/app/stock/history/page.tsx',
  './src/app/stock/page.tsx',
  './src/app/stock/reports/page.tsx',
  './src/app/toast-demo/page.tsx'
];

let fixedCount = 0;

filesToFix.forEach(filePath => {
  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP: ${filePath} (file not found)`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');

  // Check if already has the export
  if (content.includes('export const dynamic')) {
    console.log(`SKIP: ${filePath} (already has dynamic export)`);
    return;
  }

  // Check if it has 'use client'
  if (!content.includes("'use client'")) {
    console.log(`SKIP: ${filePath} (no 'use client' directive)`);
    return;
  }

  // Add the export after 'use client'
  const lines = content.split('\n');
  const newLines = [];
  let inserted = false;

  for (let i = 0; i < lines.length; i++) {
    newLines.push(lines[i]);

    if (!inserted && lines[i].includes("'use client'")) {
      newLines.push('');
      newLines.push('// Force dynamic rendering to avoid Static Generation errors with React hooks');
      newLines.push("export const dynamic = 'force-dynamic';");
      inserted = true;
    }
  }

  if (inserted) {
    fs.writeFileSync(fullPath, newLines.join('\n'), 'utf8');
    console.log(`FIXED: ${filePath}`);
    fixedCount++;
  } else {
    console.log(`ERROR: ${filePath} (could not find 'use client')`);
  }
});

console.log(`\nTotal files fixed: ${fixedCount}`);
