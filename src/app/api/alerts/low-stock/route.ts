import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-unified';

interface LowStockAlert {
  item_id: number;
  item_code: string;
  item_name: string;
  spec: string;
  unit: string;
  item_type: string;
  current_stock: number;
  safety_stock: number;
  reorder_point: number;
  severity: string;
  days_until_zero: number | null;
}

interface SummaryStats {
  total_alerts: number;
  critical_count: number;
  warning_count: number;
  critical_alerts: number;
  warning_alerts: number;
  avg_stock_ratio: number;
}

/**
 * GET /api/alerts/low-stock
 * Get low stock alerts
 * Query parameters:
 * - limit: Number of records to return (default: 50)
 * - offset: Pagination offset (default: 0)
 * - severity: Filter by severity (critical/warning)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const severity = searchParams.get('severity');

    let sql = `
      SELECT
        i.item_id,
        i.item_code,
        i.item_name,
        i.spec,
        i.unit,
        i.item_type,
        COALESCE(
          (
            SELECT SUM(
              CASE
                WHEN it.transaction_type = '입고' THEN it.quantity
                WHEN it.transaction_type = '출고' THEN -it.quantity
                WHEN it.transaction_type = '조정' THEN it.quantity
                ELSE 0
              END
            )
            FROM inventory_transactions it
            WHERE it.item_id = i.item_id
          ), 0
        ) as current_stock,
        COALESCE(i.safety_stock, 0) as safety_stock,
        i.unit_price,
        CASE
          WHEN COALESCE(
            (
              SELECT SUM(
                CASE
                  WHEN it.transaction_type = '입고' THEN it.quantity
                  WHEN it.transaction_type = '출고' THEN -it.quantity
                  WHEN it.transaction_type = '조정' THEN it.quantity
                  ELSE 0
                END
              )
              FROM inventory_transactions it
              WHERE it.item_id = i.item_id
            ), 0
          ) = 0 THEN 'critical'
          WHEN COALESCE(
            (
              SELECT SUM(
                CASE
                  WHEN it.transaction_type = '입고' THEN it.quantity
                  WHEN it.transaction_type = '출고' THEN -it.quantity
                  WHEN it.transaction_type = '조정' THEN it.quantity
                  ELSE 0
                END
              )
              FROM inventory_transactions it
              WHERE it.item_id = i.item_id
            ), 0
          ) <= (COALESCE(i.safety_stock, 0) * 0.5) THEN 'critical'
          ELSE 'warning'
        END as severity,
        CASE
          WHEN COALESCE(
            (
              SELECT SUM(
                CASE
                  WHEN it.transaction_type = '입고' THEN it.quantity
                  WHEN it.transaction_type = '출고' THEN -it.quantity
                  WHEN it.transaction_type = '조정' THEN it.quantity
                  ELSE 0
                END
              )
              FROM inventory_transactions it
              WHERE it.item_id = i.item_id
            ), 0
          ) = 0 THEN '재고 없음'
          WHEN COALESCE(
            (
              SELECT SUM(
                CASE
                  WHEN it.transaction_type = '입고' THEN it.quantity
                  WHEN it.transaction_type = '출고' THEN -it.quantity
                  WHEN it.transaction_type = '조정' THEN it.quantity
                  ELSE 0
                END
              )
              FROM inventory_transactions it
              WHERE it.item_id = i.item_id
            ), 0
          ) <= (COALESCE(i.safety_stock, 0) * 0.5) THEN '재고 부족 (Critical)'
          ELSE '재고 부족 (Warning)'
        END as alert_message,
        (
          SELECT MAX(it.transaction_date)
          FROM inventory_transactions it
          WHERE it.item_id = i.item_id
        ) as last_transaction_date
      FROM items i
      WHERE i.is_active = 1
      AND COALESCE(
        (
          SELECT SUM(
            CASE
              WHEN it.transaction_type = '입고' THEN it.quantity
              WHEN it.transaction_type = '출고' THEN -it.quantity
              WHEN it.transaction_type = '조정' THEN it.quantity
              ELSE 0
            END
          )
          FROM inventory_transactions it
          WHERE it.item_id = i.item_id
        ), 0
      ) <= COALESCE(i.safety_stock, 0)
    `;

    const params: unknown[] = [];

    if (severity) {
      if (severity === 'critical') {
        sql += ` AND (
          COALESCE(
            (
              SELECT SUM(
                CASE
                  WHEN it.transaction_type = '입고' THEN it.quantity
                  WHEN it.transaction_type = '출고' THEN -it.quantity
                  WHEN it.transaction_type = '조정' THEN it.quantity
                  ELSE 0
                END
              )
              FROM inventory_transactions it
              WHERE it.item_id = i.item_id
            ), 0
          ) = 0
          OR
          COALESCE(
            (
              SELECT SUM(
                CASE
                  WHEN it.transaction_type = '입고' THEN it.quantity
                  WHEN it.transaction_type = '출고' THEN -it.quantity
                  WHEN it.transaction_type = '조정' THEN it.quantity
                  ELSE 0
                END
              )
              FROM inventory_transactions it
              WHERE it.item_id = i.item_id
            ), 0
          ) <= (COALESCE(i.safety_stock, 0) * 0.5)
        )`;
      } else if (severity === 'warning') {
        sql += ` AND COALESCE(
          (
            SELECT SUM(
              CASE
                WHEN it.transaction_type = '입고' THEN it.quantity
                WHEN it.transaction_type = '출고' THEN -it.quantity
                WHEN it.transaction_type = '조정' THEN it.quantity
                ELSE 0
              END
            )
            FROM inventory_transactions it
            WHERE it.item_id = i.item_id
          ), 0
        ) > (COALESCE(i.safety_stock, 0) * 0.5)
        AND COALESCE(
          (
            SELECT SUM(
              CASE
                WHEN it.transaction_type = '입고' THEN it.quantity
                WHEN it.transaction_type = '출고' THEN -it.quantity
                WHEN it.transaction_type = '조정' THEN it.quantity
                ELSE 0
              END
            )
            FROM inventory_transactions it
            WHERE it.item_id = i.item_id
          ), 0
        ) > 0`;
      }
    }

    sql += ' ORDER BY severity DESC, current_stock ASC, i.item_code';
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    const alerts = await query<LowStockAlert[]>(sql, params);

    // Get summary statistics
    const summaryQuery = `
      SELECT
        COUNT(*) as total_alerts,
        SUM(
          CASE
            WHEN COALESCE(
              (
                SELECT SUM(
                  CASE
                    WHEN it.transaction_type = '입고' THEN it.quantity
                    WHEN it.transaction_type = '출고' THEN -it.quantity
                    WHEN it.transaction_type = '조정' THEN it.quantity
                    ELSE 0
                  END
                )
                FROM inventory_transactions it
                WHERE it.item_id = i.item_id
              ), 0
            ) = 0 THEN 1
            WHEN COALESCE(
              (
                SELECT SUM(
                  CASE
                    WHEN it.transaction_type = '입고' THEN it.quantity
                    WHEN it.transaction_type = '출고' THEN -it.quantity
                    WHEN it.transaction_type = '조정' THEN it.quantity
                    ELSE 0
                  END
                )
                FROM inventory_transactions it
                WHERE it.item_id = i.item_id
              ), 0
            ) <= (COALESCE(i.safety_stock, 0) * 0.5) THEN 1
            ELSE 0
          END
        ) as critical_alerts,
        SUM(
          CASE
            WHEN COALESCE(
              (
                SELECT SUM(
                  CASE
                    WHEN it.transaction_type = '입고' THEN it.quantity
                    WHEN it.transaction_type = '출고' THEN -it.quantity
                    WHEN it.transaction_type = '조정' THEN it.quantity
                    ELSE 0
                  END
                )
                FROM inventory_transactions it
                WHERE it.item_id = i.item_id
              ), 0
            ) > (COALESCE(i.safety_stock, 0) * 0.5)
            AND COALESCE(
              (
                SELECT SUM(
                  CASE
                    WHEN it.transaction_type = '입고' THEN it.quantity
                    WHEN it.transaction_type = '출고' THEN -it.quantity
                    WHEN it.transaction_type = '조정' THEN it.quantity
                    ELSE 0
                  END
                )
                FROM inventory_transactions it
                WHERE it.item_id = i.item_id
              ), 0
            ) <= COALESCE(i.safety_stock, 0)
            AND COALESCE(
              (
                SELECT SUM(
                  CASE
                    WHEN it.transaction_type = '입고' THEN it.quantity
                    WHEN it.transaction_type = '출고' THEN -it.quantity
                    WHEN it.transaction_type = '조정' THEN it.quantity
                    ELSE 0
                  END
                )
                FROM inventory_transactions it
                WHERE it.item_id = i.item_id
              ), 0
            ) > 0 THEN 1
            ELSE 0
          END
        ) as warning_alerts
      FROM items i
      WHERE i.is_active = 1
      AND COALESCE(
        (
          SELECT SUM(
            CASE
              WHEN it.transaction_type = '입고' THEN it.quantity
              WHEN it.transaction_type = '출고' THEN -it.quantity
              WHEN it.transaction_type = '조정' THEN it.quantity
              ELSE 0
            END
          )
          FROM inventory_transactions it
          WHERE it.item_id = i.item_id
        ), 0
      ) <= COALESCE(i.safety_stock, 0)
    `;

    const summaryResult = await query<SummaryStats>(summaryQuery);
    const summary = summaryResult[0] || { total_alerts: 0, critical_alerts: 0, warning_alerts: 0, critical_count: 0, warning_count: 0, avg_stock_ratio: 0 };

    // Get total count for pagination
    let countSql = `
      SELECT COUNT(*) as total
      FROM items i
      WHERE i.is_active = 1
      AND COALESCE(
        (
          SELECT SUM(
            CASE
              WHEN it.transaction_type = '입고' THEN it.quantity
              WHEN it.transaction_type = '출고' THEN -it.quantity
              WHEN it.transaction_type = '조정' THEN it.quantity
              ELSE 0
            END
          )
          FROM inventory_transactions it
          WHERE it.item_id = i.item_id
        ), 0
      ) <= COALESCE(i.safety_stock, 0)
    `;
    const countParams: (string | number)[] = [];

    if (severity) {
      if (severity === 'critical') {
        countSql += ` AND (
          COALESCE(
            (
              SELECT SUM(
                CASE
                  WHEN it.transaction_type = '입고' THEN it.quantity
                  WHEN it.transaction_type = '출고' THEN -it.quantity
                  WHEN it.transaction_type = '조정' THEN it.quantity
                  ELSE 0
                END
              )
              FROM inventory_transactions it
              WHERE it.item_id = i.item_id
            ), 0
          ) = 0
          OR
          COALESCE(
            (
              SELECT SUM(
                CASE
                  WHEN it.transaction_type = '입고' THEN it.quantity
                  WHEN it.transaction_type = '출고' THEN -it.quantity
                  WHEN it.transaction_type = '조정' THEN it.quantity
                  ELSE 0
                END
              )
              FROM inventory_transactions it
              WHERE it.item_id = i.item_id
            ), 0
          ) <= (COALESCE(i.safety_stock, 0) * 0.5)
        )`;
      }
    }

    const countQueryResult = await query<{ total: number }>(countSql, countParams);
    const countResult = countQueryResult[0] || { total: 0 };

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        summary: {
          total_alerts: summary.total_alerts || 0,
          critical_alerts: summary.critical_alerts || 0,
          warning_alerts: summary.warning_alerts || 0
        },
        pagination: {
          total: countResult.total,
          limit,
          offset,
          hasMore: offset + limit < countResult.total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching low stock alerts:', error);
    return NextResponse.json(
      {
        success: false,
        error: '재고 부족 알림 조회 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}