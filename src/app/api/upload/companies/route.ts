import { NextRequest, NextResponse } from 'next/server';
import { parseExcelFile, isValidEmail, isValidBusinessNumber } from '@/lib/excel-utils';
import { mapExcelHeaders, companiesHeaderMapping } from '@/lib/excel-header-mapper';
import { ExcelCompanyData, ValidationError, UploadResult, VALID_COMPANY_TYPES } from '@/types/upload';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

// 데이터 유효성 검증
function validateCompanyData(data: any, rowIndex: number): {company: ExcelCompanyData | null, errors: ValidationError[]} {
  const errors: ValidationError[] = [];
  const row = rowIndex + 2; // Excel row number (header = 1, data starts from 2)

  // 필수 필드 검증
  if (!data.company_name || String(data.company_name).trim() === '') {
    errors.push({
      row,
      field: 'company_name',
      value: data.company_name,
      message: '회사명은 필수입니다'
    });
  }

  if (!data.company_type || String(data.company_type).trim() === '') {
    errors.push({
      row,
      field: 'company_type',
      value: data.company_type,
      message: '회사유형은 필수입니다'
    });
  } else {
    const companyType = String(data.company_type).trim();
    if (!VALID_COMPANY_TYPES.includes(companyType as any)) {
      errors.push({
        row,
        field: 'company_type',
        value: data.company_type,
        message: `회사유형은 다음 중 하나여야 합니다: ${VALID_COMPANY_TYPES.join(', ')}`
      });
    }
  }

  // 선택적 필드 검증
  if (data.email && String(data.email).trim() !== '') {
    if (!isValidEmail(String(data.email).trim())) {
      errors.push({
        row,
        field: 'email',
        value: data.email,
        message: '올바른 이메일 형식이 아닙니다'
      });
    }
  }

  if (data.business_number && String(data.business_number).trim() !== '') {
    if (!isValidBusinessNumber(String(data.business_number).trim())) {
      errors.push({
        row,
        field: 'business_number',
        value: data.business_number,
        message: '올바른 사업자번호 형식이 아닙니다 (예: 123-45-67890)'
      });
    }
  }

  if (errors.length > 0) {
    return { company: null, errors };
  }

  return {
    company: {
      company_name: String(data.company_name).trim(),
      company_type: String(data.company_type).trim(),
      business_number: data.business_number ? String(data.business_number).trim() : undefined,
      representative: data.representative ? String(data.representative).trim() : undefined,
      phone: data.phone ? String(data.phone).trim() : undefined,
      mobile: data.mobile ? String(data.mobile).trim() : undefined,
      email: data.email ? String(data.email).trim() : undefined,
      address: data.address ? String(data.address).trim() : undefined,
      payment_terms: data.payment_terms ? String(data.payment_terms).trim() : undefined,
      contact_info: data.contact_info ? String(data.contact_info).trim() : undefined,
      notes: data.notes ? String(data.notes).trim() : undefined,
    },
    errors: []
  };
}

// 중복 검사 (회사명과 사업자번호로 검사)
async function checkDuplicates(companies: ExcelCompanyData[]): Promise<string[]> {
  const duplicates: string[] = [];
  const { mcp__supabase__execute_sql } = await import('@/lib/supabase-mcp');

  for (const company of companies) {
    let sql = `SELECT company_name FROM companies WHERE is_active = true AND (company_name = '${company.company_name.replace(/'/g, "''")}'`;

    if (company.business_number) {
      sql += ` OR business_number = '${company.business_number.replace(/'/g, "''")}'`;
    }

    sql += ')';

    const existingCompanies = await mcp__supabase__execute_sql({
      project_id: process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID || 'pybjnkbmtlyaftuiieyq',
      query: sql
    });

    const existingCompaniesArray = Array.isArray(existingCompanies) ? existingCompanies : [];
    if (existingCompaniesArray.length > 0) {
      duplicates.push(company.company_name);
    }
  }

  return duplicates;
}

// 배치 삽입
async function batchInsertCompanies(companies: ExcelCompanyData[]): Promise<void> {
  // Supabase insert multiple rows at once
  const companiesToInsert = companies.map(company => ({
    company_name: company.company_name,
    company_type: company.company_type,
    business_number: company.business_number || null,
    representative: company.representative || null,
    phone: company.phone || null,
    mobile: company.mobile || null,
    email: company.email || null,
    address: company.address || null,
    payment_terms: company.payment_terms || null,
    contact_info: company.contact_info || null,
    notes: company.notes || null
  }));

  const { mcp__supabase__execute_sql } = await import('@/lib/supabase-mcp');

  await mcp__supabase__execute_sql({
    project_id: process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID || 'pybjnkbmtlyaftuiieyq',
    query: `INSERT INTO companies (
      company_name, company_type, business_number,
      representative, phone, mobile, email, address,
      payment_terms, contact_info, notes
    ) SELECT * FROM json_populate_recordset(NULL::companies, '${JSON.stringify(companiesToInsert).replace(/'/g, "''")}')`
  });
}

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    // multipart/form-data 파싱
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB
      keepExtensions: true,
    });

    const { files } = await new Promise<{files: formidable.Files}>((resolve, reject) => {
      form.parse(request as any, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ files });
      });
    });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: '파일이 업로드되지 않았습니다'
      }, { status: 400 });
    }

    // Excel 파일 확장자 검증
    const fileName = file.originalFilename || '';
    if (!fileName.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json({
        success: false,
        error: 'Excel 파일(.xlsx, .xls)만 업로드 가능합니다'
      }, { status: 400 });
    }

    tempFilePath = file.filepath;

    // Excel 파일 파싱
    const rawData = await parseExcelFile(tempFilePath);

    if (rawData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Excel 파일에 데이터가 없습니다'
      }, { status: 400 });
    }

    // 한글 헤더를 영문 필드명으로 매핑
    const mappedData = mapExcelHeaders(rawData, companiesHeaderMapping);

    // 데이터 유효성 검증
    const validCompanies: ExcelCompanyData[] = [];
    const allErrors: ValidationError[] = [];

    for (let i = 0; i < mappedData.length; i++) {
      const { company, errors } = validateCompanyData(mappedData[i], i);

      if (errors.length > 0) {
        allErrors.push(...errors);
      } else if (company) {
        validCompanies.push(company);
      }
    }

    // 중복 검사
    const duplicates = validCompanies.length > 0 ? await checkDuplicates(validCompanies) : [];
    const companiesToInsert = validCompanies.filter(company => !duplicates.includes(company.company_name));

    // 결과 생성
    const result: UploadResult = {
      success: allErrors.length === 0 && duplicates.length === 0,
      total_rows: mappedData.length,
      success_count: 0,
      error_count: allErrors.length + duplicates.length,
      errors: allErrors,
      duplicates
    };

    // 유효한 데이터가 있으면 삽입
    if (companiesToInsert.length > 0) {
      await batchInsertCompanies(companiesToInsert);
      result.success_count = companiesToInsert.length;
    }

    return NextResponse.json({
      success: true,
      message: '파일 업로드가 완료되었습니다',
      data: result
    });

  } catch (error) {
    console.error('Excel upload error:', error);
    return NextResponse.json({
      success: false,
      error: 'Excel 파일 업로드 중 오류가 발생했습니다'
    }, { status: 500 });

  } finally {
    // 임시 파일 정리
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.error('임시 파일 삭제 실패:', cleanupError);
      }
    }
  }
}