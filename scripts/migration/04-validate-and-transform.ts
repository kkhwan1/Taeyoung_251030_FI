#!/usr/bin/env tsx

/**
 * Phase 4: Validate and Transform Parsed JSON Data
 * Prepares data for Supabase import
 */

import * as fs from 'fs';
import * as path from 'path';

interface ValidatedCompany {
  company_code: string;
  company_name: string;
  company_type: '공급사' | '고객사' | '협력사';
  business_registration_number?: string;
  is_active: boolean;
}

interface ValidatedItem {
  item_code: string;
  item_name: string;
  spec?: string;
  category?: string;
  unit?: string;
  unit_price?: number;
  supplier_id?: string;
  is_active: boolean;
}

interface ValidatedBOM {
  parent_item_code: string;
  child_item_code: string;
  quantity: number;
  unit_price: number;
  notes?: string;
}

/**
 * Main validation and transformation
 */
async function main() {
  console.log('🔍 Phase 4: 데이터 검증 및 변환 시작...\n');

  const parsedDir = path.join(process.cwd(), 'scripts', 'migration', 'parsed');
  const outputDir = path.join(process.cwd(), 'scripts', 'migration', 'validated');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Load parsed BOM data
  const bomPath = path.join(parsedDir, 'parsed-bom.json');
  const bomData = JSON.parse(fs.readFileSync(bomPath, 'utf-8'));

  console.log(`📊 BOM 데이터 로드:`);
  console.log(`   - 총 BOM 항목: ${bomData.총BOM수}개`);
  console.log(`   - 샘플 데이터: ${bomData.BOM목록.length}개\n`);

  // Extract unique companies
  const companiesMap = new Map<string, ValidatedCompany>();
  const itemsMap = new Map<string, ValidatedItem>();
  const bomRecords: ValidatedBOM[] = [];

  // Process BOM data
  for (const bom of bomData.BOM목록) {
    // Add customer company
    const customerCode = `CUS_${bom.납품처.replace(/\s+/g, '_')}`;
    if (!companiesMap.has(customerCode)) {
      companiesMap.set(customerCode, {
        company_code: customerCode,
        company_name: bom.납품처,
        company_type: '고객사',
        is_active: true
      });
    }

    // Add parent item
    if (bom.품번 && !itemsMap.has(bom.품번)) {
      itemsMap.set(bom.품번, {
        item_code: bom.품번,
        item_name: bom.품명 || '',
        spec: bom.차종 || undefined,
        unit_price: bom.단가 || undefined,
        is_active: true
      });
    }

    // Process components
    for (const comp of bom.부품목록) {
      // Add supplier company
      if (comp.공급사명) {
        const supplierCode = `SUP_${comp.공급사명.replace(/\s+/g, '_')}`;
        if (!companiesMap.has(supplierCode)) {
          companiesMap.set(supplierCode, {
            company_code: supplierCode,
            company_name: comp.공급사명,
            company_type: '공급사',
            is_active: true
          });
        }
      }

      // Add component item
      if (comp.품번 && !itemsMap.has(comp.품번)) {
        itemsMap.set(comp.품번, {
          item_code: comp.품번,
          item_name: comp.품명 || '',
          spec: comp.차종 || undefined,
          unit_price: comp.단가 || undefined,
          category: comp.사급구분 || undefined,
          is_active: true
        });
      }

      // Add BOM relationship
      if (bom.품번 && comp.품번) {
        bomRecords.push({
          parent_item_code: bom.품번,
          child_item_code: comp.품번,
          quantity: comp.소요량 || 1,
          unit_price: comp.단가 || 0,
          notes: comp.사급구분 ? `${comp.사급구분} - ${comp.공급사명}` : undefined
        });
      }
    }
  }

  // Process inventory data samples
  if (bomData.원자재수불_샘플) {
    for (const inv of bomData.원자재수불_샘플) {
      // Add supplier company
      if (inv.공급사) {
        const supplierCode = `SUP_${inv.공급사.replace(/\s+/g, '_')}`;
        if (!companiesMap.has(supplierCode)) {
          companiesMap.set(supplierCode, {
            company_code: supplierCode,
            company_name: inv.공급사,
            company_type: '공급사',
            is_active: true
          });
        }
      }

      // Add item
      if (inv.품번 && !itemsMap.has(inv.품번)) {
        itemsMap.set(inv.품번, {
          item_code: inv.품번,
          item_name: inv.품명 || '',
          spec: inv.차종 || undefined,
          is_active: true
        });
      }
    }
  }

  // Convert to arrays
  const companies = Array.from(companiesMap.values());
  const items = Array.from(itemsMap.values());

  console.log(`✅ 데이터 변환 완료:`);
  console.log(`   - 거래처: ${companies.length}개`);
  console.log(`   - 품목: ${items.length}개`);
  console.log(`   - BOM 관계: ${bomRecords.length}개\n`);

  // Save validated data
  const validatedData = {
    파일생성일시: new Date().toISOString(),
    원본파일: bomData.파일명,
    통계: {
      거래처수: companies.length,
      품목수: items.length,
      BOM관계수: bomRecords.length
    },
    companies,
    items,
    bom_records: bomRecords
  };

  const outputPath = path.join(outputDir, 'validated-master-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(validatedData, null, 2), 'utf-8');
  console.log(`💾 검증 데이터 저장: ${outputPath}\n`);

  console.log('📊 거래처 타입 분포:');
  const typeCount = companies.reduce((acc, c) => {
    acc[c.company_type] = (acc[c.company_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  Object.entries(typeCount).forEach(([type, count]) => {
    console.log(`   - ${type}: ${count}개`);
  });

  console.log('\n📊 품목 카테고리 분포:');
  const categoryCount = items.reduce((acc, i) => {
    const cat = i.category || '기타';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  Object.entries(categoryCount).forEach(([cat, count]) => {
    console.log(`   - ${cat}: ${count}개`);
  });

  console.log('\n✅ Phase 4 완료!');
}

main().catch(console.error);
