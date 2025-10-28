import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { PortalSessionWithUser, PortalApiResponse } from '@/types/portal.types';

const supabase = getSupabaseClient();

/**
 * GET /api/portal/dashboard
 * Protected dashboard data (RLS enforced)
 */
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    // Verify session
    const { data: session, error: sessionError } = await supabase
      .from('portal_sessions')
      .select('portal_user_id, expires_at, portal_users!inner(company_id, role)')
      .eq('session_token', sessionToken)
      .single();

    if (sessionError || !session) {
      return NextResponse.json<PortalApiResponse>(
        { success: false, error: '유효하지 않은 세션입니다' },
        { status: 401 }
      );
    }

    const portalSession = session as any as PortalSessionWithUser;

    // Check expiration
    if (new Date(portalSession.expires_at) < new Date()) {
      return NextResponse.json<PortalApiResponse>(
        { success: false, error: '세션이 만료되었습니다' },
        { status: 401 }
      );
    }

    const companyId = portalSession.portal_users.company_id;
    const userRole = portalSession.portal_users.role;

    // Get dashboard data based on role
    let dashboardData: any = {};

    if (userRole === 'CUSTOMER') {
      // Customer dashboard: sales transactions and collections
      const [salesResult, collectionsResult] = await Promise.all([
        supabase
          .from('sales_transactions')
          .select('*')
          .eq('customer_id', companyId)
          .order('transaction_date', { ascending: false })
          .limit(10),
        supabase
          .from('collections')
          .select('*, sales_transaction:sales_transactions(transaction_no)')
          .order('collection_date', { ascending: false })
          .limit(10)
      ]);

      dashboardData = {
        recent_sales: salesResult.data || [],
        recent_collections: collectionsResult.data || [],
        sales_summary: {
          total_sales: (salesResult.data || []).reduce((sum: number, t: any) => sum + parseFloat(String(t.total_amount || 0)), 0),
          total_collected: (collectionsResult.data || []).reduce((sum: number, c: any) => sum + parseFloat(String(c.collected_amount || 0)), 0)
        }
      };
    } else if (userRole === 'SUPPLIER') {
      // Supplier dashboard: purchase transactions and payments
      const [purchasesResult, paymentsResult] = await Promise.all([
        supabase
          .from('purchase_transactions')
          .select('*')
          .eq('supplier_id', companyId)
          .order('transaction_date', { ascending: false })
          .limit(10),
        supabase
          .from('payments')
          .select('*, purchase_transaction:purchase_transactions(transaction_no)')
          .order('payment_date', { ascending: false })
          .limit(10)
      ]);

      dashboardData = {
        recent_purchases: purchasesResult.data || [],
        recent_payments: paymentsResult.data || [],
        purchase_summary: {
          total_purchases: (purchasesResult.data || []).reduce((sum: number, t: any) => sum + parseFloat(String(t.total_amount || 0)), 0),
          total_paid: (paymentsResult.data || []).reduce((sum: number, p: any) => sum + parseFloat(String(p.paid_amount || 0)), 0)
        }
      };
    } else if (userRole === 'ADMIN') {
      // Admin dashboard: comprehensive data
      const [salesResult, purchasesResult, collectionsResult, paymentsResult] = await Promise.all([
        supabase
          .from('sales_transactions')
          .select('*')
          .order('transaction_date', { ascending: false })
          .limit(5),
        supabase
          .from('purchase_transactions')
          .select('*')
          .order('transaction_date', { ascending: false })
          .limit(5),
        supabase
          .from('collections')
          .select('*')
          .order('collection_date', { ascending: false })
          .limit(5),
        supabase
          .from('payments')
          .select('*')
          .order('payment_date', { ascending: false })
          .limit(5)
      ]);

      dashboardData = {
        recent_sales: salesResult.data || [],
        recent_purchases: purchasesResult.data || [],
        recent_collections: collectionsResult.data || [],
        recent_payments: paymentsResult.data || [],
        summary: {
          total_sales: (salesResult.data || []).reduce((sum: number, t: any) => sum + parseFloat(String(t.total_amount || 0)), 0),
          total_purchases: (purchasesResult.data || []).reduce((sum: number, t: any) => sum + parseFloat(String(t.total_amount || 0)), 0),
          total_collected: (collectionsResult.data || []).reduce((sum: number, c: any) => sum + parseFloat(String(c.collected_amount || 0)), 0),
          total_paid: (paymentsResult.data || []).reduce((sum: number, p: any) => sum + parseFloat(String(p.paid_amount || 0)), 0)
        }
      };
    }

    return NextResponse.json<PortalApiResponse>({
      success: true,
      data: dashboardData
    });
  } catch (error: any) {
    console.error('Error in GET /api/portal/dashboard:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
