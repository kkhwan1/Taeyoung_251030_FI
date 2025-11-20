import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-unified';
import { Database } from '@/types/supabase';
import { protectRoute } from '@/lib/middleware';
import { parseKoreanRequest } from '@/lib/parse-korean-request';

// Type alias for Company from Supabase generated types
type Company = Database['public']['Tables']['companies']['Row'];
import { withErrorHandler } from '@/middleware/error-handler';
import { createRateLimit, RATE_LIMIT_CONFIGS } from '@/middleware/rate-limit';
import { ERPError, ErrorCode, createSuccessResponse } from '@/lib/error-format';
import { buildPaginatedResponse, getPaginationFromSearchParams, parsePagination, buildPaginatedSQL } from '@/lib/pagination';

// Rate limiter for companies API
const companiesRateLimit = createRateLimit(RATE_LIMIT_CONFIGS.api);

export const GET = withErrorHandler(
  protectRoute(
    async (request: NextRequest) => {
      // Apply rate limiting
      const rateLimitResponse = await companiesRateLimit(request);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      const searchParams = request.nextUrl.searchParams;
      const type = searchParams.get('type');
      const search = searchParams.get('search');

      // Get pagination parameters
      const paginationInput = getPaginationFromSearchParams(searchParams);
      const paginationParams = parsePagination(paginationInput, {
        page: 1,
        limit: 20,
        maxLimit: 100
      });

      let baseSql = `
        SELECT * FROM companies
        WHERE is_active = 1
      `;

      let countSql = `
        SELECT COUNT(*) as total FROM companies
        WHERE is_active = 1
      `;

      const params: unknown[] = [];

      if (type) {
        baseSql += ' AND company_type = ?';
        countSql += ' AND company_type = ?';
        params.push(type);
      }

      if (search) {
        baseSql += ' AND (company_name LIKE ? OR business_number LIKE ? OR representative LIKE ? OR phone LIKE ? OR email LIKE ?)';
        countSql += ' AND (company_name LIKE ? OR business_number LIKE ? OR representative LIKE ? OR phone LIKE ? OR email LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      }

      // Default order by company_name if no orderBy specified
      if (!paginationParams.orderBy) {
        paginationParams.orderBy = 'company_name ASC';
      }

      // Build paginated SQL
      const { dataSql } = buildPaginatedSQL(baseSql, countSql, paginationParams);

      // Execute both queries
      const [companies, countResult] = await Promise.all([
        query<Company[]>(dataSql, params),
        query<{ total: number }>(countSql, params)
      ]);

      const totalCount = countResult[0]?.total || 0;

      // Build paginated response
      const response = buildPaginatedResponse(companies, totalCount, {
        page: Math.max(1, Number(paginationInput.page) || 1),
        limit: paginationParams.limit
      });

      return NextResponse.json(
        createSuccessResponse(response, '회사 목록을 성공적으로 조회했습니다'),
        {
          headers: {
            'Content-Type': 'application/json; charset=utf-8'
          }
        }
      );
    },
    { resource: 'companies', action: 'read' }
  )
);

export const POST = withErrorHandler(
  protectRoute(
    async (request: NextRequest) => {
      // Apply rate limiting
      const rateLimitResponse = await companiesRateLimit(request);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      // UTF-8 인코딩 처리를 위한 text 파싱 후 JSON 변환
      const text = await request.text();
      const body = JSON.parse(text);
      const {
        company_name,
        company_type,
        business_number,
        representative,
        phone,
        mobile,
        email,
        address,
        payment_terms,
        contact_info,
        notes
      } = body;

      // 필수 필드 검증
      if (!company_name || !company_type) {
        throw ERPError.validation(
          '회사명과 회사유형은 필수 입력 항목입니다',
          !company_name ? 'company_name' : 'company_type',
          {
            field: !company_name ? 'company_name' : 'company_type',
            constraints: {
              required: true
            }
          }
        );
      }

      // company_type 유효성 검증 및 변환
      const typeMapping: { [key: string]: string } = {
        '고객사': '고객사',
        '공급사': '공급사',
        '협력사': '협력사',
        '기타': '기타',
        'CUSTOMER': '고객사',
        'SUPPLIER': '공급사',
        'PARTNER': '협력사',
        'OTHER': '기타'
      };

      const normalizedType = typeMapping[company_type];
      if (!normalizedType) {
        throw ERPError.validation(
          '회사유형은 고객사, 공급사, 협력사, 기타 또는 CUSTOMER, SUPPLIER, PARTNER, OTHER 중 하나여야 합니다',
          'company_type',
          {
            field: 'company_type',
            value: company_type,
            allowedValues: Object.keys(typeMapping)
          }
        );
      }

      // 중복 회사명 검증
      const existingCompany = await query<{ company_id: number }>(
        'SELECT company_id FROM companies WHERE company_name = ? AND is_active = 1',
        [company_name]
      );

      if (existingCompany.length > 0) {
        throw ERPError.duplicate('회사', 'company_name', company_name);
      }

      const sql = `
        INSERT INTO companies (
          company_name, company_type, business_number,
          representative, phone, mobile, email, address,
          payment_terms, contact_info, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const result = await query(sql, [
        company_name,
        normalizedType,
        business_number || null,
        representative || null,
        phone || null,
        mobile || null,
        email || null,
        address || null,
        payment_terms || null,
        contact_info || null,
        notes || null
      ]);

      return NextResponse.json(
        createSuccessResponse(result, '회사가 성공적으로 생성되었습니다'),
        {
          headers: {
            'Content-Type': 'application/json; charset=utf-8'
          }
        }
      );
    },
    { resource: 'companies', action: 'create' }
  )
);

export const PUT = withErrorHandler(
  protectRoute(
    async (request: NextRequest) => {
      // Apply rate limiting
      const rateLimitResponse = await companiesRateLimit(request);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      const body = await parseKoreanRequest<{ id: number; [key: string]: any }>(request);
      const { id, ...updateData } = body;

      if (!id) {
        throw ERPError.validation('회사 ID가 필요합니다', 'id');
      }

      // 회사 존재 여부 확인
      const existingCompany = await query<{ company_id: number }>(
        'SELECT company_id FROM companies WHERE company_id = ? AND is_active = 1',
        [id]
      );

      if (existingCompany.length === 0) {
        throw ERPError.notFound('회사', id, 'update');
      }

      // company_type 유효성 검증 및 변환 (포함된 경우에만)
      if (updateData.company_type) {
        const typeMapping: { [key: string]: string } = {
          '고객사': '고객사',
          '공급사': '공급사',
          '협력사': '협력사',
          '기타': '기타',
          'CUSTOMER': '고객사',
          'SUPPLIER': '공급사',
          'PARTNER': '협력사',
          'OTHER': '기타'
        };

        const normalizedType = typeMapping[updateData.company_type];
        if (!normalizedType) {
          throw ERPError.validation(
            '회사유형은 고객사, 공급사, 협력사, 기타 또는 CUSTOMER, SUPPLIER, PARTNER, OTHER 중 하나여야 합니다',
            'company_type',
            {
              field: 'company_type',
              value: updateData.company_type,
              allowedValues: Object.keys(typeMapping)
            }
          );
        }

        // 정규화된 타입으로 교체
        updateData.company_type = normalizedType;
      }

      // 회사명 중복 검증 (변경하는 경우)
      if (updateData.company_name) {
        const duplicateCompany = await query<{ company_id: number }>(
          'SELECT company_id FROM companies WHERE company_name = ? AND company_id != ? AND is_active = 1',
          [updateData.company_name, id]
        );

        if (duplicateCompany.length > 0) {
          throw ERPError.duplicate('회사', 'company_name', updateData.company_name);
        }
      }

      const updateFields = Object.keys(updateData)
        .map(key => `${key} = ?`)
        .join(', ');

      const sql = `UPDATE companies SET ${updateFields} WHERE company_id = ?`;
      const values = [...Object.values(updateData), id];

      const result = await query(sql, values);

      return NextResponse.json(
        createSuccessResponse(result, '회사가 성공적으로 수정되었습니다')
      );
    },
    { resource: 'companies', action: 'update' }
  )
);

export const DELETE = withErrorHandler(
  protectRoute(
    async (request: NextRequest) => {
      // Apply rate limiting
      const rateLimitResponse = await companiesRateLimit(request);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      const searchParams = request.nextUrl.searchParams;
      const id = searchParams.get('id');

      if (!id) {
        throw ERPError.validation('회사 ID가 필요합니다', 'id');
      }

      // 회사 존재 여부 확인
      const existingCompany = await query<{ company_id: number }>(
        'SELECT company_id FROM companies WHERE company_id = ? AND is_active = 1',
        [id]
      );

      if (existingCompany.length === 0) {
        throw ERPError.notFound('회사', id, 'delete');
      }

      // 재고 거래 이력이 있는지 확인
      const hasTransactions = await query<{ count: number }>(
        'SELECT COUNT(*) as count FROM inventory_transactions WHERE company_id = ?',
        [id]
      );

      if (hasTransactions[0]?.count > 0) {
        throw ERPError.businessRule(
          '거래 이력이 있는 회사는 삭제할 수 없습니다',
          {
            rule: 'cannot_delete_company_with_transactions',
            entity: 'company',
            entityId: id,
            conflictingData: { transaction_count: hasTransactions[0].count }
          }
        );
      }

      // Soft delete
      const sql = `UPDATE companies SET is_active = 0 WHERE company_id = ?`;
      const result = await query(sql, [id]);

      return NextResponse.json(
        createSuccessResponse(result, '회사가 성공적으로 삭제되었습니다')
      );
    },
    { resource: 'companies', action: 'delete' }
  )
);