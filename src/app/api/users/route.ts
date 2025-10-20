import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-unified';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const role = searchParams.get('role');
    const is_active = searchParams.get('is_active');

    let sql = `
      SELECT
        user_id,
        username,
        full_name,
        email,
        role,
        is_active,
        created_at
      FROM users
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (role) {
      sql += ` AND role = $${paramIndex++}`;
      params.push(role);
    }

    if (is_active !== null) {
      sql += ` AND is_active = $${paramIndex++}`;
      params.push(is_active === 'true');
    }

    sql += ' ORDER BY username ASC';

    const users = await query<any[]>(sql, params);

    return NextResponse.json({
      success: true,
      data: Array.isArray(users) ? users : []
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch users'
      },
      { status: 500 }
    );
  }
}