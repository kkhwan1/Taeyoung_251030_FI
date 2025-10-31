const fs = require('fs');

// Read the SQL query
const sqlQuery = fs.readFileSync('scripts/compare-prices.sql', 'utf8');

console.log('=== Excel vs Database Price Comparison ===\n');
console.log('Executing comparison query via Supabase...\n');
console.log('Query contains 244 price records from Excel "최신단가" sheet\n');

// Output the query for MCP execution
console.log('SQL Query prepared for execution');
console.log('Length:', sqlQuery.length, 'characters');

// Save query in JSON format for MCP
const payload = {
  project_id: process.env.SUPABASE_PROJECT_ID || 'pybjnkbmtlyaftuiieyq',
  query: sqlQuery
};

fs.writeFileSync(
  'scripts/mcp-price-comparison.json',
  JSON.stringify(payload, null, 2)
);

console.log('\n✅ Query prepared for MCP execution');
console.log('   Saved to: scripts/mcp-price-comparison.json');
