interface LastFormData {
  payment_method: string;
  bank_name?: string;
  account_number?: string;
  [key: string]: any;
}

export const formStorage = {
  // 마지막 입력값 저장
  saveLastInput: (formType: 'collection' | 'payment', data: LastFormData) => {
    const key = `lastForm_${formType}`;
    localStorage.setItem(key, JSON.stringify({
      ...data,
      savedAt: new Date().toISOString()
    }));
  },

  // 마지막 입력값 불러오기
  loadLastInput: (formType: 'collection' | 'payment'): LastFormData | null => {
    const key = `lastForm_${formType}`;
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    
    try {
      const data = JSON.parse(saved);
      const savedDate = new Date(data.savedAt);
      const daysDiff = (Date.now() - savedDate.getTime()) / (1000 * 60 * 60 * 24);
      
      // 7일 이상 지난 데이터는 삭제
      if (daysDiff > 7) {
        localStorage.removeItem(key);
        return null;
      }
      
      return data;
    } catch {
      return null;
    }
  },

  // 거래처별 입력 이력 저장
  saveCompanyDefaults: (companyId: number, data: LastFormData) => {
    const key = `companyDefaults_${companyId}`;
    localStorage.setItem(key, JSON.stringify(data));
  },

  // 거래처별 기본값 불러오기
  loadCompanyDefaults: (companyId: number): LastFormData | null => {
    const key = `companyDefaults_${companyId}`;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  }
};
