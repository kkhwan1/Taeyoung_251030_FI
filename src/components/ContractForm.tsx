'use client';

import { useEffect, useState } from 'react';
import {
  Loader2,
  Save
} from 'lucide-react';
import { useToastNotification } from '@/hooks/useToast';
import { DocumentUploadZone } from './DocumentUploadZone';

interface ContractFormProps {
  contract?: Partial<ContractFormValues> | null;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

interface ContractFormValues {
  contract_id?: string;
  company_id: string;
  contract_no: string;
  contract_date: string;
  start_date: string;
  end_date: string;
  total_amount: string;
  status: ContractStatus;
  notes: string;
}

type ContractStatus = 'ACTIVE' | 'EXPIRED' | 'TERMINATED';

const CONTRACT_STATUS_OPTIONS: { value: ContractStatus; label: string }[] = [
  { value: 'ACTIVE', label: '활성' },
  { value: 'EXPIRED', label: '만료' },
  { value: 'TERMINATED', label: '해지' }
];

const DEFAULT_VALUES: ContractFormValues = {
  company_id: '',
  contract_no: '',
  contract_date: new Date().toISOString().split('T')[0],
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  total_amount: '',
  status: 'ACTIVE',
  notes: ''
};

export default function ContractForm({ contract, onSubmit, onCancel }: ContractFormProps) {
  const [formData, setFormData] = useState<ContractFormValues>(DEFAULT_VALUES);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [companies, setCompanies] = useState<Array<{ company_id: string; company_name: string }>>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const toast = useToastNotification();

  // Fetch companies for dropdown
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch('/api/companies?limit=1000');
        const result = await response.json();
        if (result.success) {
          setCompanies(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch companies:', error);
        toast.error('거래처 목록을 불러오는데 실패했습니다.');
      } finally {
        setLoadingCompanies(false);
      }
    };

    fetchCompanies();
  }, [toast]);

  // Initialize form data when contract prop changes
  useEffect(() => {
    if (!contract) {
      setFormData(DEFAULT_VALUES);
      setShowDocumentUpload(false);
      return;
    }

    const initialValues: ContractFormValues = {
      contract_id: contract.contract_id,
      company_id: contract.company_id ?? '',
      contract_no: contract.contract_no ?? '',
      contract_date: contract.contract_date ?? new Date().toISOString().split('T')[0],
      start_date: contract.start_date ?? new Date().toISOString().split('T')[0],
      end_date: contract.end_date ?? '',
      total_amount: contract.total_amount ? String(contract.total_amount) : '',
      status: (contract.status as ContractStatus) ?? 'ACTIVE',
      notes: contract.notes ?? ''
    };

    setFormData(initialValues);
    setShowDocumentUpload(Boolean(contract.contract_id));
  }, [contract]);

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const validation = validate(formData);
    setErrors(validation);

    if (Object.keys(validation).length > 0) {
      toast.입력오류('입력값을 확인해주세요.');
      return;
    }

    setLoading(true);
    try {
      const payload = buildSubmitPayload(formData);
      await onSubmit(payload);

      // If new contract was created, show document upload section
      if (!contract?.contract_id) {
        setShowDocumentUpload(true);
        toast.success('계약이 등록되었습니다. 계약서를 업로드해주세요.');
      } else {
        onCancel();
      }
    } catch (error) {
      console.error('Failed to submit contract form:', error);
      toast.error('계약 정보를 저장하는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUploadSuccess = () => {
    toast.success('문서가 업로드되었습니다.');
    // Optionally refresh document list or update UI
  };

  const handleDocumentUploadError = (error: string) => {
    toast.error(`문서 업로드 실패: ${error}`);
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-8">
        <section>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">계약 기본 정보</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              label="계약번호"
              name="contract_no"
              value={formData.contract_no}
              onChange={handleInputChange}
              error={errors.contract_no}
              placeholder="예: CTR-2024-001"
              required
            />
            <FormSelect
              label="거래처"
              name="company_id"
              value={formData.company_id}
              onChange={handleInputChange}
              options={companies.map(c => ({ value: c.company_id, label: c.company_name }))}
              placeholder={loadingCompanies ? '로딩 중...' : '거래처 선택'}
              error={errors.company_id}
              required
              disabled={loadingCompanies}
            />
            <FormDate
              label="계약일"
              name="contract_date"
              value={formData.contract_date}
              onChange={handleInputChange}
              error={errors.contract_date}
              required
            />
            <FormSelect
              label="계약 상태"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              options={CONTRACT_STATUS_OPTIONS}
              error={errors.status}
              required
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">계약 기간 및 금액</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormDate
              label="시작일"
              name="start_date"
              value={formData.start_date}
              onChange={handleInputChange}
              error={errors.start_date}
              required
            />
            <FormDate
              label="종료일"
              name="end_date"
              value={formData.end_date}
              onChange={handleInputChange}
              error={errors.end_date}
              required
            />
            <FormNumber
              label="계약금액"
              name="total_amount"
              value={formData.total_amount}
              onChange={handleInputChange}
              error={errors.total_amount}
              min={0}
              step="0.01"
              prefix="₩"
              required
              className="md:col-span-2"
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">추가 정보</h2>
          <FormTextArea
            label="비고"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            error={errors.notes}
            rows={4}
            placeholder="계약 관련 추가 메모를 입력하세요."
          />
        </section>

        <div className="flex justify-end gap-4 border-t border-gray-200 dark:border-gray-700 pt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                {contract ? '수정' : '등록'}
              </>
            )}
          </button>
        </div>
      </form>

      {/* Document upload section - shown after contract creation or when editing existing contract */}
      {showDocumentUpload && formData.contract_id && (
        <section className="border-t border-gray-200 dark:border-gray-700 pt-8">
          <div className="flex items-center gap-2 mb-4">
            
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">계약서 문서</h2>
          </div>
          <DocumentUploadZone
            contractId={formData.contract_id}
            onUploadSuccess={handleDocumentUploadSuccess}
            onUploadError={handleDocumentUploadError}
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            계약서를 업로드하면 자동으로 텍스트가 추출되어 검색 가능합니다.
          </p>
        </section>
      )}
    </div>
  );
}

function buildSubmitPayload(formData: ContractFormValues): Record<string, unknown> {
  return {
    contract_id: formData.contract_id,
    company_id: formData.company_id,
    contract_no: formData.contract_no.trim(),
    contract_date: formData.contract_date,
    start_date: formData.start_date,
    end_date: formData.end_date,
    total_amount: parseFloat(formData.total_amount),
    status: formData.status,
    notes: formData.notes.trim() || null
  };
}

function validate(formData: ContractFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!formData.contract_no.trim()) {
    errors.contract_no = '계약번호를 입력해주세요.';
  }

  if (!formData.company_id) {
    errors.company_id = '거래처를 선택해주세요.';
  }

  if (!formData.contract_date) {
    errors.contract_date = '계약일을 입력해주세요.';
  }

  if (!formData.start_date) {
    errors.start_date = '시작일을 입력해주세요.';
  }

  if (!formData.end_date) {
    errors.end_date = '종료일을 입력해주세요.';
  }

  // Date range validation
  if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
    errors.start_date = '시작일이 종료일보다 늦을 수 없습니다.';
  }

  if (!formData.total_amount || parseFloat(formData.total_amount) <= 0) {
    errors.total_amount = '계약금액을 입력해주세요.';
  }

  return errors;
}

// Form field components
type FormFieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
};

function FormField({ label, name, value, onChange, error, placeholder, required }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label} {required && <span className="text-gray-500">*</span>}
      </label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {error && <p className="mt-1 text-sm text-gray-500">{error}</p>}
    </div>
  );
}

type FormDateProps = FormFieldProps;

function FormDate({ label, name, value, onChange, error, required }: FormDateProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label} {required && <span className="text-gray-500">*</span>}
      </label>
      <input
        type="date"
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {error && <p className="mt-1 text-sm text-gray-500">{error}</p>}
    </div>
  );
}

type FormNumberProps = FormFieldProps & {
  min?: number;
  step?: string;
  prefix?: string;
  className?: string;
};

function FormNumber({ label, name, value, onChange, error, min, step, prefix, required, className }: FormNumberProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label} {required && <span className="text-gray-500">*</span>}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">{prefix}</span>
        )}
        <input
          type="number"
          name={name}
          value={value}
          onChange={onChange}
          min={min}
          step={step}
          required={required}
          className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${prefix ? 'pl-8' : ''}`}
        />
      </div>
      {error && <p className="mt-1 text-sm text-gray-500">{error}</p>}
    </div>
  );
}

type FormSelectProps = {
  label: string;
  name: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
};

function FormSelect({ label, name, value, onChange, options, placeholder, error, required, disabled }: FormSelectProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label} {required && <span className="text-gray-500">*</span>}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-gray-500">{error}</p>}
    </div>
  );
}

type FormTextAreaProps = {
  label: string;
  name: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string;
  placeholder?: string;
  rows?: number;
};

function FormTextArea({ label, name, value, onChange, error, placeholder, rows = 4 }: FormTextAreaProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {error && <p className="mt-1 text-sm text-gray-500">{error}</p>}
    </div>
  );
}
