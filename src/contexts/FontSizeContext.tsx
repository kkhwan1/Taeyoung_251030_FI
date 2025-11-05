'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface FontSizeContextType {
  fontSize: number;
  setFontSize: (size: number) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
  getFontSizeClasses: (element: 'text' | 'table') => string;
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

/**
 * 글꼴 크기 관리 컨텍스트 프로바이더
 *
 * 기능:
 * - CSS 변수 기반 글꼴 크기 조절 (12px ~ 24px)
 * - localStorage에 사용자 설정 저장
 * - 전체 앱에서 일관된 글꼴 크기 적용
 *
 * 사용:
 * - app/layout.tsx에서 루트 레벨에 적용
 * - useFontSize() 훅으로 컴포넌트에서 접근
 */
export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<number>(() => {
    // SSR 호환: 클라이언트에서만 localStorage 접근
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('erp-font-size');
      console.log('[FontSize] Lazy initializer: localStorage value:', saved);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) {
          // 범위 밖 값을 클램핑 처리 (무시하지 않음)
          const clamped = Math.max(12, Math.min(24, parsed));
          // 클램핑된 값을 즉시 저장하여 다음 로드에서 올바른 값 사용
          if (clamped !== parsed) {
            console.log('[FontSize] Lazy initializer: Clamping', parsed, 'to', clamped);
            localStorage.setItem('erp-font-size', clamped.toString());
          }
          console.log('[FontSize] Lazy initializer: Returning', clamped);
          return clamped;
        } else {
          // NaN인 경우 (손상된 값): localStorage를 기본값으로 복구
          console.log('[FontSize] Lazy initializer: Invalid value (NaN), resetting to 16');
          localStorage.setItem('erp-font-size', '16');
          return 16;
        }
      }
      console.log('[FontSize] Lazy initializer: No saved value, using default 16');
    }
    return 16; // 기본값 16px
  });

  // 마운트 시 localStorage와 상태 동기화 확인
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('erp-font-size');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) {
          const clamped = Math.max(12, Math.min(24, parsed));
          // localStorage 값과 현재 상태가 다르면 동기화
          if (clamped !== fontSize) {
            console.log('[FontSize] useEffect sync: localStorage has', clamped, 'but state is', fontSize, '- syncing state');
            setFontSizeState(clamped);
            if (clamped !== parsed) {
              localStorage.setItem('erp-font-size', clamped.toString());
            }
          }
        } else {
          // NaN인 경우 localStorage 복구
          console.log('[FontSize] useEffect sync: Invalid localStorage value, resetting');
          localStorage.setItem('erp-font-size', '16');
          if (fontSize !== 16) {
            setFontSizeState(16);
          }
        }
      }
    }
  }, []); // 마운트 시 한 번만 실행

  // CSS 변수만 업데이트 (localStorage는 setFontSize에서 동기 처리)
  useEffect(() => {
    const currentLocalStorage = typeof window !== 'undefined' ? localStorage.getItem('erp-font-size') : null;
    console.log('[FontSize] useEffect: fontSize state:', fontSize, 'localStorage:', currentLocalStorage);
    document.documentElement.style.setProperty('--base-font-size', `${fontSize}px`);
    const cssValue = getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim();
    console.log('[FontSize] useEffect: CSS variable set to:', cssValue);
  }, [fontSize]);

  const setFontSize = (size: number) => {
    // NaN 검증 및 범위 제한: 12px ~ 24px
    if (isNaN(size)) {
      console.warn('[FontSizeContext] Invalid size (NaN), resetting to default 16px');
      const defaultSize = 16;
      const beforeValue = typeof window !== 'undefined' ? localStorage.getItem('erp-font-size') : null;
      console.log('[FontSize] setFontSize(NaN): localStorage before:', beforeValue);
      setFontSizeState(defaultSize);
      localStorage.setItem('erp-font-size', defaultSize.toString()); // 동기 저장 추가
      console.log('[FontSize] setFontSize(NaN): localStorage after:', localStorage.getItem('erp-font-size'));
      return;
    }
    const clampedSize = Math.max(12, Math.min(24, size));
    const beforeValue = typeof window !== 'undefined' ? localStorage.getItem('erp-font-size') : null;
    console.log('[FontSize] setFontSize(', size, '): localStorage before:', beforeValue, '→ clamped:', clampedSize);
    setFontSizeState(clampedSize);
    localStorage.setItem('erp-font-size', clampedSize.toString()); // 동기 저장 추가
    console.log('[FontSize] setFontSize(', size, '): localStorage after:', localStorage.getItem('erp-font-size'));
  };

  const increaseFontSize = () => {
    setFontSize(fontSize + 2);
  };

  const decreaseFontSize = () => {
    setFontSize(fontSize - 2);
  };

  const resetFontSize = () => {
    const defaultSize = 16;
    const beforeValue = typeof window !== 'undefined' ? localStorage.getItem('erp-font-size') : null;
    console.log('[FontSize] resetFontSize(): localStorage before:', beforeValue);
    setFontSizeState(defaultSize);
    localStorage.setItem('erp-font-size', defaultSize.toString()); // 동기 저장 추가
    console.log('[FontSize] resetFontSize(): localStorage after:', localStorage.getItem('erp-font-size'));
  };

  const getFontSizeClasses = (element: 'text' | 'table' = 'text'): string => {
    // fontSize 값을 Tailwind 클래스로 변환
    if (fontSize <= 13) {
      return element === 'table' ? 'text-xs' : 'text-xs';
    }
    if (fontSize <= 15) {
      return element === 'table' ? 'text-sm' : 'text-sm';
    }
    if (fontSize <= 17) {
      return element === 'table' ? 'text-sm' : 'text-base';
    }
    if (fontSize <= 19) {
      return element === 'table' ? 'text-base' : 'text-lg';
    }
    // fontSize >= 20
    return element === 'table' ? 'text-lg' : 'text-xl';
  };

  return (
    <FontSizeContext.Provider
      value={{
        fontSize,
        setFontSize,
        increaseFontSize,
        decreaseFontSize,
        resetFontSize,
        getFontSizeClasses
      }}
    >
      {children}
    </FontSizeContext.Provider>
  );
}

/**
 * 글꼴 크기 컨텍스트 사용 훅
 *
 * @returns {FontSizeContextType} 글꼴 크기 상태 및 제어 함수
 * @throws {Error} FontSizeProvider 외부에서 사용 시
 *
 * 사용 예시:
 * ```tsx
 * const { fontSize, setFontSize, resetFontSize } = useFontSize();
 * ```
 */
export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (!context) {
    throw new Error('useFontSize must be used within FontSizeProvider');
  }
  return context;
}
