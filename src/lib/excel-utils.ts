import * as XLSX from 'xlsx';

// Excel 파일 파싱 유틸리티
export function parseExcelFile(filePath: string): any[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  return data;
}

// 이메일 유효성 검증
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 사업자번호 유효성 검증 (기본적인 형식 확인)
export function isValidBusinessNumber(businessNumber: string): boolean {
  // 사업자번호는 숫자 10자리 또는 하이픈 포함 형식
  const businessRegex = /^\d{3}-?\d{2}-?\d{5}$/;
  return businessRegex.test(businessNumber.replace(/[^0-9-]/g, ''));
}

// 전화번호 유효성 검증
export function isValidPhoneNumber(phone: string): boolean {
  // 한국 전화번호 형식: 02-1234-5678, 010-1234-5678, 031-123-4567 등
  const phoneRegex = /^(02|0[3-9][0-9]?)-?[0-9]{3,4}-?[0-9]{4}$|^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

// 숫자 유효성 검증
export function isValidNumber(value: unknown): boolean {
  return !isNaN(Number(value)) && isFinite(Number(value));
}

// 필수 필드 검증
export function validateRequiredField(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined || String(value).trim() === '') {
    return `${fieldName}은(는) 필수입니다`;
  }
  return null;
}

// 문자열 정리 (trim 및 null 처리)
export function cleanString(value: unknown): string | undefined {
  if (value === null || value === undefined || String(value).trim() === '') {
    return undefined;
  }
  return String(value).trim();
}

// 숫자 변환 및 정리
export function cleanNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const num = Number(value);
  if (isNaN(num)) {
    return undefined;
  }
  return num;
}