/**
 * Deployment Validation Script
 *
 * 4개 병렬 에이전트 구현 완료 후 데이터베이스 및 스토리지 상태 검증
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface ValidationResult {
  category: string;
  item: string;
  status: 'EXISTS' | 'MISSING' | 'ERROR';
  details?: string;
}

const results: ValidationResult[] = [];

async function validateTables() {
  console.log('\n🔍 Validating Database Tables...\n');

  const tablesToCheck = [
    'item_images',
    'portal_users',
    'portal_sessions',
    'portal_access_logs',
    'contracts',
    'contract_documents'
  ];

  for (const tableName of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from('information_schema.tables' as any)
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', tableName)
        .single();

      if (error && error.code !== 'PGRST116') {
        results.push({
          category: 'Tables',
          item: tableName,
          status: 'ERROR',
          details: error.message
        });
      } else if (data) {
        results.push({
          category: 'Tables',
          item: tableName,
          status: 'EXISTS'
        });
      } else {
        results.push({
          category: 'Tables',
          item: tableName,
          status: 'MISSING'
        });
      }
    } catch (err: any) {
      results.push({
        category: 'Tables',
        item: tableName,
        status: 'ERROR',
        details: err.message
      });
    }
  }
}

async function validateStorageBuckets() {
  console.log('\n📦 Validating Storage Buckets...\n');

  const bucketsToCheck = ['item-images', 'contract-documents'];

  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      bucketsToCheck.forEach(bucketName => {
        results.push({
          category: 'Storage Buckets',
          item: bucketName,
          status: 'ERROR',
          details: error.message
        });
      });
      return;
    }

    const bucketNames = buckets.map(b => b.name);

    bucketsToCheck.forEach(bucketName => {
      if (bucketNames.includes(bucketName)) {
        const bucket = buckets.find(b => b.name === bucketName)!;
        results.push({
          category: 'Storage Buckets',
          item: bucketName,
          status: 'EXISTS',
          details: `Public: ${bucket.public}, File size limit: ${bucket.file_size_limit ? bucket.file_size_limit / 1024 / 1024 + 'MB' : 'unlimited'}`
        });
      } else {
        results.push({
          category: 'Storage Buckets',
          item: bucketName,
          status: 'MISSING'
        });
      }
    });
  } catch (err: any) {
    bucketsToCheck.forEach(bucketName => {
      results.push({
        category: 'Storage Buckets',
        item: bucketName,
        status: 'ERROR',
        details: err.message
      });
    });
  }
}

async function validateAPIEndpoints() {
  console.log('\n🌐 Validating API Endpoints...\n');

  const baseUrl = 'http://localhost:5000';

  const endpointsToCheck = [
    // Agent 1: Item Images
    { method: 'GET', path: '/api/items', agent: 'Agent 1' },

    // Agent 2: Financial Statements
    { method: 'GET', path: '/api/reports/balance-sheet', agent: 'Agent 2' },
    { method: 'GET', path: '/api/reports/cash-flow', agent: 'Agent 2' },

    // Agent 3: Portal
    { method: 'GET', path: '/api/portal/auth/login', agent: 'Agent 3' },

    // Agent 4: Contracts
    { method: 'GET', path: '/api/contracts', agent: 'Agent 4' }
  ];

  for (const endpoint of endpointsToCheck) {
    try {
      const response = await fetch(`${baseUrl}${endpoint.path}`, {
        method: endpoint.method
      });

      if (response.ok || response.status === 405) { // 405 = Method Not Allowed is OK for GET on POST-only endpoints
        results.push({
          category: 'API Endpoints',
          item: `${endpoint.method} ${endpoint.path}`,
          status: 'EXISTS',
          details: `${endpoint.agent} - Status: ${response.status}`
        });
      } else if (response.status === 404) {
        results.push({
          category: 'API Endpoints',
          item: `${endpoint.method} ${endpoint.path}`,
          status: 'MISSING',
          details: `${endpoint.agent} - 404 Not Found`
        });
      } else {
        results.push({
          category: 'API Endpoints',
          item: `${endpoint.method} ${endpoint.path}`,
          status: 'ERROR',
          details: `${endpoint.agent} - Status: ${response.status}`
        });
      }
    } catch (err: any) {
      results.push({
        category: 'API Endpoints',
        item: `${endpoint.method} ${endpoint.path}`,
        status: 'ERROR',
        details: `${endpoint.agent} - ${err.message}`
      });
    }
  }
}

async function printResults() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 DEPLOYMENT VALIDATION RESULTS');
  console.log('='.repeat(80) + '\n');

  const categories = [...new Set(results.map(r => r.category))];

  categories.forEach(category => {
    console.log(`\n📁 ${category}:`);
    console.log('-'.repeat(80));

    const categoryResults = results.filter(r => r.category === category);

    categoryResults.forEach(result => {
      const icon = result.status === 'EXISTS' ? '✅' : result.status === 'MISSING' ? '❌' : '⚠️';
      console.log(`${icon} ${result.item.padEnd(50)} [${result.status}]`);
      if (result.details) {
        console.log(`   ${result.details}`);
      }
    });
  });

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📈 SUMMARY:');
  console.log('='.repeat(80));

  const totalItems = results.length;
  const existingItems = results.filter(r => r.status === 'EXISTS').length;
  const missingItems = results.filter(r => r.status === 'MISSING').length;
  const errorItems = results.filter(r => r.status === 'ERROR').length;

  console.log(`Total Items Checked: ${totalItems}`);
  console.log(`✅ Existing: ${existingItems} (${Math.round(existingItems / totalItems * 100)}%)`);
  console.log(`❌ Missing: ${missingItems} (${Math.round(missingItems / totalItems * 100)}%)`);
  console.log(`⚠️  Errors: ${errorItems} (${Math.round(errorItems / totalItems * 100)}%)`);

  console.log('\n' + '='.repeat(80));

  if (missingItems > 0) {
    console.log('\n⚠️  DEPLOYMENT INCOMPLETE - Missing components need to be deployed');
    console.log('\nRefer to deployment guides:');
    console.log('  - DEPLOYMENT_GUIDE_ITEM_IMAGES.md (Agent 1)');
    console.log('  - Portal E2E tests setup (Agent 3)');
    console.log('  - Contract management setup (Agent 4)');
  } else if (errorItems > 0) {
    console.log('\n⚠️  DEPLOYMENT HAS ERRORS - Check error details above');
  } else {
    console.log('\n✅ DEPLOYMENT COMPLETE - All components verified!');
  }

  console.log('\n');
}

async function main() {
  console.log('🚀 Starting Deployment Validation...');
  console.log('Project: 태창 ERP System');
  console.log('Implementation Plan: IMPLEMENTATION_PLAN_2025-01-22.md');
  console.log('Agents: 4 parallel agents (Item Images, Financial Statements, Portal, Contracts)');

  try {
    await validateTables();
    await validateStorageBuckets();
    await validateAPIEndpoints();
    await printResults();
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

main();
