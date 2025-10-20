import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import type {
  DuplicatesCleanupRequest,
  DuplicatesCleanupResponse
} from '@/types/api/price-master';

/**
 * POST /api/price-master/duplicates/cleanup
 * Clean up duplicate price entries
 *
 * Body: {
 *   strategy: 'keep_latest' | 'keep_oldest' | 'custom',
 *   custom_keep_ids?: string[] (required if strategy='custom'),
 *   dry_run?: boolean (default: true)
 * }
 *
 * Returns:
 * - Deleted count
 * - Kept count
 * - Preview of cleanup actions
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const text = await request.text();
    const requestData: DuplicatesCleanupRequest = JSON.parse(text);

    const {
      strategy,
      custom_keep_ids = [],
      dry_run = true
    } = requestData;

    // Validation
    if (!strategy || !['keep_latest', 'keep_oldest', 'custom'].includes(strategy)) {
      return NextResponse.json({
        success: false,
        error: 'strategy는 keep_latest, keep_oldest, custom 중 하나여야 합니다.'
      }, { status: 400 });
    }

    if (strategy === 'custom' && (!custom_keep_ids || custom_keep_ids.length === 0)) {
      return NextResponse.json({
        success: false,
        error: 'custom strategy 사용 시 custom_keep_ids는 필수입니다.'
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Get all price records grouped by item_id + effective_date
    const { data: allPrices, error: fetchError } = await supabase
      .from('price_master')
      .select(`
        price_id,
        item_id,
        unit_price,
        effective_date,
        created_at,
        items!inner (
          item_code,
          item_name
        )
      `)
      .order('effective_date', { ascending: false })
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw new Error(`가격 조회 실패: ${fetchError.message}`);
    }

    if (!allPrices || allPrices.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          deleted_count: 0,
          kept_count: 0,
          preview: []
        }
      });
    }

    // Group by item_id + effective_date
    interface PriceRecord {
      price_id: number;
      item_id: number;
      unit_price: number;
      effective_date: string;
      created_at: string;
      items: { item_code: string; item_name: string };
    }

    const groupMap = new Map<string, PriceRecord[]>();

    for (const record of allPrices as PriceRecord[]) {
      const key = `${record.item_id}_${record.effective_date}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }

      groupMap.get(key)!.push(record);
    }

    // Determine which records to keep/delete
    const toDelete: number[] = [];
    const toKeep: number[] = [];
    const preview: Array<{
      item_code: string;
      effective_date: string;
      deleted_prices: number[];
      kept_price: number;
    }> = [];

    for (const [key, records] of groupMap.entries()) {
      // Skip if no duplicates
      if (records.length <= 1) {
        toKeep.push(records[0].price_id);
        continue;
      }

      // Sort by created_at
      records.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      let keepId: number;

      if (strategy === 'keep_latest') {
        // Keep the last one (latest created_at)
        keepId = records[records.length - 1].price_id;
      } else if (strategy === 'keep_oldest') {
        // Keep the first one (oldest created_at)
        keepId = records[0].price_id;
      } else {
        // custom strategy
        // Find first record whose price_id is in custom_keep_ids
        const customKeep = records.find(r =>
          custom_keep_ids.includes(r.price_id.toString())
        );

        if (!customKeep) {
          // None of the duplicates are in keep list - skip this group
          // Keep all for safety
          records.forEach(r => toKeep.push(r.price_id));
          continue;
        }

        keepId = customKeep.price_id;
      }

      // Add to keep/delete lists
      toKeep.push(keepId);

      const deletedPrices: number[] = [];
      for (const record of records) {
        if (record.price_id !== keepId) {
          toDelete.push(record.price_id);
          deletedPrices.push(record.unit_price);
        }
      }

      // Add to preview
      const keptRecord = records.find(r => r.price_id === keepId)!;
      preview.push({
        item_code: (keptRecord.items as any).item_code,
        effective_date: keptRecord.effective_date,
        deleted_prices: deletedPrices,
        kept_price: keptRecord.unit_price
      });
    }

    // If dry_run, just return preview
    if (dry_run) {
      return NextResponse.json({
        success: true,
        data: {
          deleted_count: toDelete.length,
          kept_count: toKeep.length,
          preview: preview.slice(0, 20) // Limit preview to 20
        }
      });
    }

    // Actual deletion
    let deletedCount = 0;

    if (toDelete.length > 0) {
      // Delete in batches (1000 at a time)
      const batchSize = 1000;

      for (let i = 0; i < toDelete.length; i += batchSize) {
        const batch = toDelete.slice(i, i + batchSize);

        const { error: deleteError, count } = await supabase
          .from('price_master')
          .delete({ count: 'exact' })
          .in('price_id', batch);

        if (deleteError) {
          throw new Error(`중복 삭제 실패: ${deleteError.message}`);
        }

        deletedCount += count || batch.length;
      }
    }

    const response: DuplicatesCleanupResponse = {
      success: true,
      data: {
        deleted_count: deletedCount,
        kept_count: toKeep.length,
        preview: preview.slice(0, 20)
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '중복 정리에 실패했습니다.'
    }, { status: 500 });
  }
}
