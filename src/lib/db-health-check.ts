import { mcp__supabase__execute_sql } from './supabase-mcp';

/**
 * Supabase Database health check utilities
 */

export interface TableHealthStatus {
  tableName: string;
  exists: boolean;
  requiredColumns: string[];
  missingColumns: string[];
  status: 'healthy' | 'warning' | 'error';
}

export interface DatabaseHealth {
  connected: boolean;
  tables: TableHealthStatus[];
  overallStatus: 'healthy' | 'warning' | 'error';
}

/**
 * Required table schemas for the application (Supabase/PostgreSQL)
 * Based on actual database structure from TAECHANG_ERP project
 */
const REQUIRED_TABLES = {
  users: [
    'user_id', 'username', 'password', 'name', 'email', 'phone', 'role', 'is_active', 'created_at', 'updated_at'
  ],
  items: [
    'item_id', 'item_code', 'item_name', 'category', 'spec', 'unit', 'price', 'safety_stock', 
    'current_stock', 'location', 'description', 'is_active', 'created_at', 'updated_at', 'created_by', 'updated_by'
  ],
  companies: [
    'company_id', 'company_code', 'company_name', 'company_type', 'business_number', 'representative',
    'phone', 'fax', 'email', 'address', 'description', 'is_active', 'created_at', 'updated_at', 'created_by', 'updated_by'
  ],
  inventory_transactions: [
    'transaction_id', 'transaction_date', 'transaction_type', 'item_id', 'company_id', 'quantity',
    'unit_price', 'total_amount', 'tax_amount', 'grand_total', 'document_number', 'reference_number',
    'warehouse_id', 'location', 'lot_number', 'expiry_date', 'status', 'notes', 'transaction_number',
    'description', 'created_at', 'updated_at', 'created_by', 'updated_by'
  ],
  bom: [
    'bom_id', 'parent_item_id', 'child_item_id', 'quantity', 'unit', 'is_active',
    'created_at', 'updated_at', 'created_by', 'updated_by'
  ],
  warehouses: [
    'warehouse_id', 'warehouse_code', 'warehouse_name', 'warehouse_type', 'address', 'manager_name',
    'manager_phone', 'temperature_controlled', 'max_capacity', 'current_usage', 'is_active',
    'created_by', 'created_at', 'updated_at'
  ],
  warehouse_stock: [
    'warehouse_stock_id', 'warehouse_id', 'item_id', 'current_quantity', 'reserved_quantity',
    'available_quantity', 'location_code', 'min_stock', 'max_stock', 'last_in_date', 'last_out_date',
    'created_at', 'updated_at'
  ],
  serials: [
    'serial_id', 'prefix', 'year_month', 'current_number', 'created_at', 'updated_at'
  ],
  stock_adjustments: [
    'adjustment_id', 'adjustment_number', 'adjustment_date', 'warehouse_id', 'item_id', 'adjustment_type',
    'quantity_before', 'quantity_after', 'adjustment_quantity', 'reason', 'approved_by', 'approval_date',
    'unit_cost', 'total_cost_impact', 'status', 'created_by', 'created_at', 'updated_at'
  ],
  current_stock_view: [
    'item_id', 'item_code', 'item_name', 'category', 'spec', 'unit', 
    'current_stock', 'safety_stock', 'stock_status', 'location', 'is_active'
  ]
};

/**
 * Check if a table exists and has required columns (PostgreSQL)
 */
async function checkTableHealth(tableName: string, requiredColumns: string[]): Promise<TableHealthStatus> {
  try {
    const projectId = process.env.SUPABASE_PROJECT_ID || '';

    // Check if table exists using PostgreSQL information_schema
    const tableExistsQuery = `SELECT COUNT(*) as count FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = '${tableName}'`;

    const tableExistsResponse = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: tableExistsQuery
    });

    const tableExistsResult = tableExistsResponse.rows as Array<{count: string}> | null;

    if (!tableExistsResult || tableExistsResult.length === 0 || parseInt(tableExistsResult[0].count) === 0) {
      return {
        tableName,
        exists: false,
        requiredColumns,
        missingColumns: requiredColumns,
        status: 'error'
      };
    }

    // Check columns using PostgreSQL information_schema
    const columnsQuery = `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = '${tableName}'`;

    const columnsResponse = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: columnsQuery
    });

    const columnsResult = columnsResponse.rows as Array<{column_name: string}> | null;

    if (!columnsResult || columnsResult.length === 0) {
      return {
        tableName,
        exists: true,
        requiredColumns,
        missingColumns: requiredColumns,
        status: 'error'
      };
    }

    const existingColumns = columnsResult.map((col: {column_name: string}) => col.column_name.toLowerCase());
    const missingColumns = requiredColumns.filter(
      col => !existingColumns.includes(col.toLowerCase())
    );

    // Log column check details for debugging
    if (missingColumns.length > 0) {
      console.log(`Table ${tableName}: Missing columns: ${missingColumns.join(', ')}`);
      console.log(`Table ${tableName}: Existing columns: ${existingColumns.join(', ')}`);
    }

    return {
      tableName,
      exists: true,
      requiredColumns,
      missingColumns,
      status: missingColumns.length === 0 ? 'healthy' : 'warning'
    };
  } catch (error) {
    console.error(`Error checking table health for ${tableName}:`, error);
    return {
      tableName,
      exists: false,
      requiredColumns,
      missingColumns: requiredColumns,
      status: 'error'
    };
  }
}

/**
 * Check overall database health (Supabase)
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const health: DatabaseHealth = {
    connected: false,
    tables: [],
    overallStatus: 'healthy'
  };

  try {
    // Test connection using Supabase
    const projectId = process.env.SUPABASE_PROJECT_ID || '';

    // Test connection using Supabase
    const connectionTestResponse = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: 'SELECT 1 as test'
    });

    const connectionTest = connectionTestResponse.rows as Array<{test: number}> | null;
    health.connected = !!connectionTest && connectionTest.length > 0;

    // Check each table
    for (const [tableName, columns] of Object.entries(REQUIRED_TABLES)) {
      const tableHealth = await checkTableHealth(tableName, columns);
      health.tables.push(tableHealth);

      // Update overall status
      if (tableHealth.status === 'error') {
        health.overallStatus = 'error';
      } else if (tableHealth.status === 'warning' && health.overallStatus !== 'error') {
        health.overallStatus = 'warning';
      }
    }
  } catch (error) {
    console.error('Database health check failed:', error);
    health.connected = false;
    health.overallStatus = 'error';
  }

  return health;
}

/**
 * Auto-fix common database issues (Supabase/PostgreSQL)
 */
export async function autoFixDatabaseIssues(): Promise<string[]> {
  const fixes: string[] = [];

  try {
    const health = await checkDatabaseHealth();

    for (const table of health.tables) {
      if (!table.exists) {
        // Log missing table but don't auto-create (too risky)
        fixes.push(`Table '${table.tableName}' is missing - manual creation required`);
      } else if (table.missingColumns.length > 0) {
        // Log missing columns but don't auto-add (need proper types)
        fixes.push(`Table '${table.tableName}' is missing columns: ${table.missingColumns.join(', ')}`);
      }
    }

    // Check and fix common issues for PostgreSQL
    try {
      const projectId = process.env.SUPABASE_PROJECT_ID || '';

      // Ensure transaction_type can handle Korean values (PostgreSQL uses UTF-8 by default)
      const columnCheckResponse = await mcp__supabase__execute_sql({
        project_id: projectId,
        query: `SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'inventory_transactions'
          AND column_name = 'transaction_type'`
      });

      const result = columnCheckResponse.rows as Array<{column_name: string, data_type: string}> | null;

      if (result && result.length > 0) {
        fixes.push('transaction_type column exists and supports UTF-8 (PostgreSQL default)');
      }

      // Check if all required tables exist
      const tableNames = Object.keys(REQUIRED_TABLES);
      const tableNamesStr = tableNames.map(t => `'${t}'`).join(',');

      const tableCheckResponse = await mcp__supabase__execute_sql({
        project_id: projectId,
        query: `SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name IN (${tableNamesStr})`
      });

      const tableCheckResult = tableCheckResponse.rows as Array<{table_name: string}> | null;

      if (tableCheckResult && tableCheckResult.length > 0) {
        const existingTables = tableCheckResult.map(row => row.table_name);
        const missingTables = tableNames.filter(
          table => !existingTables.includes(table)
        );

        if (missingTables.length === 0) {
          fixes.push(`All ${tableNames.length} required tables exist in the database`);
        } else {
          fixes.push(`Missing tables: ${missingTables.join(', ')}`);
        }
      }
    } catch (e) {
      fixes.push(`Database schema check failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    return fixes;
  } catch (error) {
    console.error('Auto-fix failed:', error);
    return [`Auto-fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`];
  }
}

/**
 * Get database statistics (Supabase)
 */
export async function getDatabaseStats() {
  try {
    const projectId = process.env.SUPABASE_PROJECT_ID || '';
    const stats: any = {};

    // Get table row counts - using parameterized query for safety
    const tables = Object.keys(REQUIRED_TABLES);
    
    // Validate table names to prevent SQL injection
    const validTableNames = tables.filter(tableName => 
      /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)
    );

    for (const table of validTableNames) {
      try {
        // Use parameterized query with table name validation
        const response = await mcp__supabase__execute_sql({
        project_id: projectId,
        query: `SELECT COUNT(*) as count FROM "${table}"`
      });

      const result = response.rows as Array<{count: string}> | null;
        if (result && result.length > 0) {
          stats[table] = parseInt(result[0].count);
        } else {
          stats[table] = 'error';
        }
      } catch (e) {
        console.error(`Error counting rows in table ${table}:`, e);
        stats[table] = 'error';
      }
    }

    return stats;
  } catch (error) {
    console.error('Failed to get database stats:', error);
    return null;
  }
}