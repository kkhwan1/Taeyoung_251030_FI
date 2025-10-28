/**
 * Portal Transactions API
 *
 * GET /api/portal/transactions
 * Returns transactions filtered by RLS policies:
 * - CUSTOMER role: View sales_transactions where customer_id matches company
 * - SUPPLIER role: View purchases where supplier_id matches company
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import {
  requirePortalAuth,
  logPortalApiAccess,
  createPortalResponse,
} from '@/lib/portal-middleware';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    // Require authentication
    const authResult = await requirePortalAuth();
    if (!('session' in authResult)) {
      // authResult is NextResponse (error response)
      return authResult;
    }
    const session = authResult.session;
    const supabase = getSupabaseClient();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let transactions: any[] = [];
    let totalCount = 0;

    // Fetch transactions based on role
    if (session.role === 'CUSTOMER') {
        // Get sales transactions for this customer
        let query = supabase
          .from('sales_transactions')
          .select(`
            transaction_id,
            transaction_no,
            transaction_date,
            due_date,
            item_id,
            items(item_name, unit),
            quantity,
            unit_price,
            total_amount,
            payment_status,
            collected_amount,
            notes,
            created_at
          `, { count: 'exact' })
          .eq('customer_id', session.companyId)
          .order('transaction_date', { ascending: false });

        // Apply filters
        if (startDate) {
          query = query.gte('transaction_date', startDate);
        }
        if (endDate) {
          query = query.lte('transaction_date', endDate);
        }

        // Apply pagination
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) {
          console.error('Failed to fetch sales transactions:', error);
          await logPortalApiAccess(request, session, 'GET_TRANSACTIONS', '/api/portal/transactions', false, error.message);
          return createPortalResponse(false, null, '거래 내역을 불러오는데 실패했습니다.', 500) as Response;
        }

        transactions = data || [];
        totalCount = count || 0;

      } else if (session.role === 'SUPPLIER') {
        // Get purchases for this supplier
        let query = supabase
          .from('purchase_transactions')
          .select(`
            purchase_id,
            purchase_no,
            order_date,
            delivery_date,
            item_id,
            items(item_name, unit),
            quantity,
            unit_price,
            total_amount,
            payment_status,
            paid_amount,
            notes,
            created_at
          `, { count: 'exact' })
          .eq('supplier_id', session.companyId)
          .order('order_date', { ascending: false });

        // Apply filters
        if (startDate) {
          query = query.gte('order_date', startDate);
        }
        if (endDate) {
          query = query.lte('order_date', endDate);
        }

        // Apply pagination
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) {
          console.error('Failed to fetch purchases:', error);
          await logPortalApiAccess(request, session, 'GET_TRANSACTIONS', '/api/portal/transactions', false, error.message);
          return createPortalResponse(false, null, '거래 내역을 불러오는데 실패했습니다.', 500) as Response;
        }

        transactions = data || [];
        totalCount = count || 0;

      } else {
        // ADMIN role - for now, return empty
        transactions = [];
        totalCount = 0;
      }

      // Log successful access
      await logPortalApiAccess(request, session, 'GET_TRANSACTIONS', '/api/portal/transactions', true);

      // Return paginated response
      return createPortalResponse(
        true,
        {
          transactions,
          pagination: {
            page,
            limit,
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
          },
          role: session.role,
          companyName: session.companyName,
        },
        undefined,
        200
      ) as Response;
  } catch (error) {
    console.error('Portal transactions error:', error);
    return createPortalResponse(
      false,
      null,
      '거래 내역을 불러오는데 실패했습니다.',
      500
    ) as Response;
  }
}
