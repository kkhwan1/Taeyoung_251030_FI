/**
 * Companies Handler
 * Handles CRUD operations for companies (거래처)
 */

import { CRUDHandler } from '../CRUDHandler';
import type { APIResponse, RequestContext } from '../types';
import { ERPError, ErrorType } from '@/lib/errorHandler';
import { isValidCompanyCategory } from '@/types/accounting.types';

// Company type mapping between Korean (DB) and English (API)
const companyTypeMap: Record<string, string> = {
  'CUSTOMER': '고객사',
  'SUPPLIER': '공급사',
  '고객사': '고객사',
  '공급사': '공급사'
};

export class CompaniesHandler extends CRUDHandler {
  constructor() {
    super({
      tableName: 'companies',
      idField: 'company_id',
      activeField: 'is_active',
      searchFields: ['company_name', 'company_code', 'business_number'],
      selectFields: '*'
    });
  }

  /**
   * Validation: Create company
   */
  protected async validateCreate(data: any): Promise<void> {
    // Required fields
    if (!data.company_name) {
      throw new ERPError(
        ErrorType.VALIDATION,
        'company_name은 필수 입력 항목입니다.'
      );
    }

    // Validate company_category
    if (data.company_category && !isValidCompanyCategory(data.company_category)) {
      throw new ERPError(
        ErrorType.VALIDATION,
        '유효하지 않은 업체 구분입니다.'
      );
    }

    // Validate business_info structure
    if (data.business_info) {
      this.validateBusinessInfo(data.business_info);
    }

    // Convert company_type (English → Korean)
    if (data.company_type) {
      data.company_type = companyTypeMap[data.company_type] || data.company_type;
    }

    // Auto-generate company_code if not provided
    if (!data.company_code && data.company_type) {
      data.company_code = await this.generateCompanyCode(data.company_type);
    }
  }

  /**
   * Validation: Update company
   */
  protected async validateUpdate(id: number | string, data: any): Promise<void> {
    // Validate company_category
    if (data.company_category && !isValidCompanyCategory(data.company_category)) {
      throw new ERPError(
        ErrorType.VALIDATION,
        '유효하지 않은 업체 구분입니다.'
      );
    }

    // Validate business_info structure
    if (data.business_info) {
      this.validateBusinessInfo(data.business_info);
    }

    // Convert company_type (English → Korean)
    if (data.company_type) {
      data.company_type = companyTypeMap[data.company_type] || data.company_type;
    }
  }

  /**
   * Validate business_info JSONB structure
   */
  private validateBusinessInfo(businessInfo: any): void {
    if (typeof businessInfo !== 'object' || businessInfo === null) {
      throw new ERPError(
        ErrorType.VALIDATION,
        '사업자 정보는 객체 형식이어야 합니다.'
      );
    }

    const allowedFields = ['business_type', 'business_item', 'main_products'];
    const extraFields = Object.keys(businessInfo).filter(key => !allowedFields.includes(key));

    if (extraFields.length > 0) {
      throw new ERPError(
        ErrorType.VALIDATION,
        `허용되지 않은 필드: ${extraFields.join(', ')}`
      );
    }

    // Validate field types
    for (const [key, value] of Object.entries(businessInfo)) {
      if (value !== undefined && value !== null && typeof value !== 'string') {
        throw new ERPError(
          ErrorType.VALIDATION,
          `${key}는 문자열이어야 합니다.`
        );
      }
    }
  }

  /**
   * Auto-generate company_code based on company_type
   */
  private async generateCompanyCode(companyType: string): Promise<string> {
    const prefixMap: Record<string, string> = {
      '고객사': 'CUS',
      '공급사': 'SUP',
      '협력사': 'PAR',
      '기타': 'OTH'
    };

    const prefix = prefixMap[companyType] || 'COM';

    // Get last company with this prefix
    const { data: lastCompany } = await this.supabase
      .from('companies')
      .select('company_code')
      .like('company_code', `${prefix}%`)
      .order('company_code', { ascending: false })
      .limit(1)
      .single();

    if (lastCompany && lastCompany.company_code) {
      const lastNumber = parseInt(lastCompany.company_code.slice(3));
      return `${prefix}${String(lastNumber + 1).padStart(3, '0')}`;
    }

    return `${prefix}001`;
  }
}
