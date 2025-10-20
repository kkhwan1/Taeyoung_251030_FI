import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/price-master/bulk
 * Bulk create or update price master entries
 * Body: {
 *   prices: [
 *     {
 *       item_id: number,
 *       unit_price: number,
 *       currency?: string,
 *       effective_date?: string,
 *       expiry_date?: string,
 *       supplier_id?: number,
 *       notes?: string
 *     },
 *     ...
 *   ],
 *   mode?: 'create' | 'upsert' (default: 'create')
 * }
 *
 * mode='create': Creates new entries only
 * mode='upsert': Updates existing active prices or creates new ones
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const text = await request.text();
    const data = JSON.parse(text);

    const { prices, mode = 'create' } = data;

    if (!prices || !Array.isArray(prices) || prices.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'prices 배열이 필요합니다.'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate all entries
    const validationErrors: string[] = [];
    const itemIds = new Set<number>();

    prices.forEach((price, index) => {
      if (!price.item_id || price.unit_price === undefined) {
        validationErrors.push(`Entry ${index + 1}: item_id와 unit_price는 필수입니다.`);
      }
      if (price.unit_price < 0) {
        validationErrors.push(`Entry ${index + 1}: 단가는 0 이상이어야 합니다.`);
      }
      if (price.effective_date && price.expiry_date &&
          new Date(price.effective_date) > new Date(price.expiry_date)) {
        validationErrors.push(`Entry ${index + 1}: 유효 시작일은 종료일보다 이전이어야 합니다.`);
      }
      itemIds.add(price.item_id);
    });

    if (validationErrors.length > 0) {
      return NextResponse.json({
        success: false,
        error: '입력 데이터 검증 실패',
        validation_errors: validationErrors
      }, { status: 400 });
    }

    // Verify all items exist
    const { data: existingItems, error: itemsError } = await supabase
      .from('items')
      .select('item_id')
      .in('item_id', Array.from(itemIds));

    if (itemsError) {
      throw new Error(`Failed to verify items: ${itemsError.message}`);
    }

    const existingItemIds = new Set(existingItems?.map(i => i.item_id) || []);
    const missingItemIds = Array.from(itemIds).filter(id => !existingItemIds.has(id));

    if (missingItemIds.length > 0) {
      return NextResponse.json({
        success: false,
        error: `다음 품목을 찾을 수 없습니다: ${missingItemIds.join(', ')}`
      }, { status: 404 });
    }

    let results;
    const today = new Date().toISOString().split('T')[0];

    if (mode === 'upsert') {
      // Upsert mode: Update existing active prices or create new ones
      const processedResults: any[] = [];

      for (const price of prices) {
        // Find existing active price for this item/supplier combination
        let query = supabase
          .from('price_master')
          .select('price_id')
          .eq('item_id', price.item_id)
          .eq('is_active', true)
          .lte('effective_date', today);

        if (price.supplier_id) {
          query = query.eq('supplier_id', price.supplier_id);
        } else {
          query = query.is('supplier_id', null);
        }

        query = query.or('expiry_date.is.null,expiry_date.gte.' + today);

        const { data: existing, error: existingError } = await query.single();

        if (existing && !existingError) {
          // Update existing price
          const { data: updated, error: updateError } = await supabase
            .from('price_master')
            .update({
              unit_price: price.unit_price,
              currency: price.currency || 'KRW',
              effective_date: price.effective_date || today,
              expiry_date: price.expiry_date || null,
              notes: price.notes || null
            })
            .eq('price_id', existing.price_id)
            .select(`
              *,
              item:items(item_id, item_code, item_name, spec, unit, item_type),
              supplier:companies!supplier_id(company_id, company_code, company_name)
            `)
            .single();

          if (updateError) {
            throw new Error(`Failed to update price for item ${price.item_id}: ${updateError.message}`);
          }
          processedResults.push({ ...updated, operation: 'updated' });
        } else {
          // Create new price
          const { data: created, error: createError } = await supabase
            .from('price_master')
            .insert({
              item_id: price.item_id,
              unit_price: price.unit_price,
              currency: price.currency || 'KRW',
              effective_date: price.effective_date || today,
              expiry_date: price.expiry_date || null,
              supplier_id: price.supplier_id || null,
              notes: price.notes || null,
              is_active: true
            })
            .select(`
              *,
              item:items(item_id, item_code, item_name, spec, unit, item_type),
              supplier:companies!supplier_id(company_id, company_code, company_name)
            `)
            .single();

          if (createError) {
            throw new Error(`Failed to create price for item ${price.item_id}: ${createError.message}`);
          }
          processedResults.push({ ...created, operation: 'created' });
        }
      }

      results = processedResults;
    } else {
      // Create mode: Insert all entries
      const insertData = prices.map(price => ({
        item_id: price.item_id,
        unit_price: price.unit_price,
        currency: price.currency || 'KRW',
        effective_date: price.effective_date || today,
        expiry_date: price.expiry_date || null,
        supplier_id: price.supplier_id || null,
        notes: price.notes || null,
        is_active: true
      }));

      const { data: created, error: createError } = await supabase
        .from('price_master')
        .insert(insertData)
        .select(`
          *,
          item:items(item_id, item_code, item_name, spec, unit, item_type),
          supplier:companies!supplier_id(company_id, company_code, company_name)
        `);

      if (createError) {
        throw new Error(`Bulk insert failed: ${createError.message}`);
      }

      results = created?.map(r => ({ ...r, operation: 'created' })) || [];
    }

    return NextResponse.json({
      success: true,
      message: `${results.length}개의 가격 마스터가 ${mode === 'upsert' ? '처리' : '등록'}되었습니다.`,
      data: {
        prices: results,
        summary: {
          total: results.length,
          created: results.filter((r: any) => r.operation === 'created').length,
          updated: results.filter((r: any) => r.operation === 'updated').length
        }
      }
    });
  } catch (error) {
    console.error('Error in bulk price master operation:', error);
    return NextResponse.json({
      success: false,
      error: '가격 마스터 일괄 처리에 실패했습니다.'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/price-master/bulk
 * Bulk soft delete price master entries
 * Body: {
 *   price_ids: number[]
 * }
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const text = await request.text();
    const data = JSON.parse(text);

    const { price_ids } = data;

    if (!price_ids || !Array.isArray(price_ids) || price_ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'price_ids 배열이 필요합니다.'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('price_master')
      .update({ is_active: false })
      .in('price_id', price_ids);

    if (error) {
      throw new Error(`Bulk delete failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `${price_ids.length}개의 가격 마스터가 삭제되었습니다.`,
      data: { deleted_ids: price_ids }
    });
  } catch (error) {
    console.error('Error in bulk delete:', error);
    return NextResponse.json({
      success: false,
      error: '가격 마스터 일괄 삭제에 실패했습니다.'
    }, { status: 500 });
  }
}
