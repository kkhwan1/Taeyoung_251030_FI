#!/usr/bin/env tsx

/**
 * Phase 3: Parse BOM Excel Data
 * Processes CSV data from pyhub MCP into structured JSON
 */

interface BOMItem {
  parent_company: string;
  car_model: string;
  part_number: string;
  part_name: string;
  unit_price?: number;
  quantity?: number;
  total_amount?: number;
  components: BOMComponent[];
}

interface BOMComponent {
  supplier_type: string; // 사급, 하드웨어, etc.
  supplier_name: string;
  car_model: string;
  part_number: string;
  part_name: string;
  quantity: number;
  unit_price: number;
  customer_price?: number;
  total_amount: number;
}

interface ParsedBOM {
  source_file: string;
  sheet_name: string;
  parsed_date: string;
  total_items: number;
  items: BOMItem[];
}

/**
 * Parse CSV line into fields, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Parse BOM CSV data into structured format
 */
function parseBOMData(csvData: string, sheetName: string): ParsedBOM {
  const lines = csvData.trim().split('\n');
  const items: BOMItem[] = [];
  let currentItem: BOMItem | null = null;

  for (const line of lines) {
    const fields = parseCSVLine(line);

    // Skip empty lines
    if (fields.every(f => !f)) continue;

    // Check if this is a parent row (has data in first column)
    if (fields[0]) {
      // Save previous item if exists
      if (currentItem) {
        items.push(currentItem);
      }

      // Create new parent item
      currentItem = {
        parent_company: fields[0] || '',
        car_model: fields[1] || '',
        part_number: fields[2] || '',
        part_name: fields[3] || '',
        unit_price: parseFloat(fields[4]) || undefined,
        quantity: parseFloat(fields[5]) || undefined,
        total_amount: parseFloat(fields[6]) || undefined,
        components: []
      };
    } else if (currentItem && fields[7]) {
      // This is a component row (empty first columns, has supplier info)
      const component: BOMComponent = {
        supplier_type: fields[7] || '',
        supplier_name: fields[8] || '',
        car_model: fields[9] || '',
        part_number: fields[10] || '',
        part_name: fields[11] || '',
        quantity: parseFloat(fields[12]) || 0,
        unit_price: parseFloat(fields[13]) || 0,
        customer_price: parseFloat(fields[14]) || undefined,
        total_amount: parseFloat(fields[15]) || 0
      };

      currentItem.components.push(component);
    }
  }

  // Save last item
  if (currentItem) {
    items.push(currentItem);
  }

  return {
    source_file: '태창금속 BOM.xlsx',
    sheet_name: sheetName,
    parsed_date: new Date().toISOString(),
    total_items: items.length,
    items
  };
}

// This will be executed with actual CSV data from pyhub MCP
export { parseBOMData, ParsedBOM, BOMItem, BOMComponent };
