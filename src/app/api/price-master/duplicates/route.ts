import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import type {
  DuplicatesDetectionResponse,
  DuplicateGroup,
  DuplicateItem
} from '@/types/api/price-master';

/**
 * GET /api/price-master/duplicates
 * Detect duplicate price entries
 * (Same item_code + effective_date with multiple prices)
 *
 * Returns:
 * - Duplicate groups
 * - Summary statistics
 * - Recommended cleanup actions
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = getSupabaseClient();

    // Find duplicates: same item_id + effective_date with multiple prices
    const { data: duplicates, error } = await supabase
      .from('price_master')
      .select(`
        price_id,
        item_id,
        unit_price,
        effective_date,
        created_at,
        items!inner (
          item_id,
          item_code,
          item_name
        )
      `)
      .order('effective_date', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`중복 조회 실패: ${error.message}`);
    }

    if (!duplicates || duplicates.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          total_duplicates: 0,
          duplicate_groups: [],
          summary: {
            by_item: 0,
            by_date: 0,
            total_records: 0
          }
        }
      });
    }

    // Group by item_id + effective_date
    const groupMap = new Map<string, DuplicateItem[]>();

    for (const record of duplicates) {
      const key = `${record.item_id}_${record.effective_date}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }

      const item = record.items as unknown as { item_id: number; item_code: string; item_name: string };

      groupMap.get(key)!.push({
        item_id: record.item_id.toString(),
        item_code: item.item_code,
        item_name: item.item_name,
        effective_date: record.effective_date,
        unit_price: record.unit_price,
        created_at: record.created_at,
        duplicate_count: 0 // Will be set below
      });
    }

    // Filter groups with duplicates (count > 1)
    const duplicateGroups: DuplicateGroup[] = [];
    let totalRecords = 0;

    for (const [key, items] of groupMap.entries()) {
      if (items.length > 1) {
        // Sort by created_at (oldest first)
        items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        // Update duplicate_count
        items.forEach(item => {
          item.duplicate_count = items.length;
        });

        // Determine recommended action
        let recommended_action: 'keep_latest' | 'keep_oldest' | 'manual_review' = 'keep_latest';

        // Check if prices are same or different
        const uniquePrices = new Set(items.map(i => i.unit_price));
        if (uniquePrices.size > 1) {
          // Different prices - manual review needed
          recommended_action = 'manual_review';
        } else {
          // Same price - keep latest
          recommended_action = 'keep_latest';
        }

        duplicateGroups.push({
          item_code: items[0].item_code,
          item_name: items[0].item_name,
          effective_date: items[0].effective_date,
          duplicates: items,
          recommended_action
        });

        totalRecords += items.length;
      }
    }

    // Calculate summary
    const byItem = new Set(duplicateGroups.map(g => g.item_code)).size;
    const byDate = new Set(duplicateGroups.map(g => g.effective_date)).size;

    const response: DuplicatesDetectionResponse = {
      success: true,
      data: {
        total_duplicates: duplicateGroups.length,
        duplicate_groups: duplicateGroups,
        summary: {
          by_item: byItem,
          by_date: byDate,
          total_records: totalRecords
        }
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error detecting duplicates:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '중복 감지에 실패했습니다.'
    }, { status: 500 });
  }
}
