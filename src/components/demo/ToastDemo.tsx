'use client';

import React from 'react';
import {
  Bell,
  CheckCircle,
  XCircle,
  Info,
  Trash2,
  Upload,
  Save,
  RotateCcw
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useToastNotification } from '@/hooks/useToast';

export default function ToastDemo() {
  const toast = useToast();
  const koreanToast = useToastNotification();

  const handleBasicToasts = () => {
    toast.success('성공!', '작업이 성공적으로 완료되었습니다.');

    setTimeout(() => {
      toast.info('정보', '이것은 정보 메시지입니다.');
    }, 500);

    setTimeout(() => {
      toast.warning('경고', '주의가 필요한 상황입니다.');
    }, 1000);

    setTimeout(() => {
      toast.error('오류', '문제가 발생했습니다.');
    }, 1500);
  };

  const handleKoreanToasts = () => {
    koreanToast.저장완료('품목이 저장되었습니다.');

    setTimeout(() => {
      koreanToast.업로드완료('Excel 파일이 업로드되었습니다.');
    }, 500);

    setTimeout(() => {
      koreanToast.경고('중복된 데이터가 있습니다.');
    }, 1000);

    setTimeout(() => {
      koreanToast.연결오류('서버 연결에 실패했습니다.');
    }, 1500);
  };

  const handleActionToasts = () => {
    // Undo delete example
    const deletedItem = '품목 A-001';

    const undoDelete = () => {
      toast.success('실행 취소', `${deletedItem}이(가) 복원되었습니다.`);
    };

    koreanToast.삭제완료_실행취소(
      `${deletedItem}이(가) 삭제되었습니다.`,
      undoDelete
    );

    // View details example
    setTimeout(() => {
      const viewDetails = () => {
        toast.info('상세 정보', '상세 페이지로 이동합니다.');
      };

      koreanToast.저장완료_상세보기(
        '새 품목이 등록되었습니다.',
        viewDetails
      );
    }, 2000);

    // Retry example
    setTimeout(() => {
      const retryUpload = () => {
        toast.info('재시도 중', '파일을 다시 업로드합니다...');
      };

      koreanToast.오류발생_재시도(
        '네트워크 연결이 불안정합니다.',
        retryUpload
      );
    }, 4000);
  };

  const handlePersistentToasts = () => {
    const handleCriticalAction = () => {
      toast.success('처리 완료', '중요한 작업이 완료되었습니다.');
    };

    const dismissAction = () => {
      toast.info('알림 해제', '알림을 확인했습니다.');
    };

    koreanToast.중요알림(
      '시스템 점검이 예정되어 있습니다. 작업을 저장해 주세요.',
      [
        { label: '확인', onClick: handleCriticalAction, style: 'primary' },
        { label: '나중에', onClick: dismissAction, style: 'secondary' }
      ]
    );
  };

  const handleCustomDuration = () => {
    toast.success('짧은 알림', '1초 후 사라집니다.', 1000);

    setTimeout(() => {
      toast.info('긴 알림', '10초 후 사라집니다.', 10000);
    }, 200);
  };

  const handleStressTest = () => {
    // Test maximum toast limit (5)
    for (let i = 1; i <= 8; i++) {
      setTimeout(() => {
        toast.info(`토스트 ${i}`, `${i}번째 토스트 메시지입니다.`);
      }, i * 200);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-900 rounded-lg shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="w-8 h-8 text-gray-500" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Toast 알림 시스템 데모
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            향상된 토스트 알림 기능을 테스트해보세요
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Basic Toasts */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            기본 알림
          </h3>
          <button
            onClick={handleBasicToasts}
            className="w-full flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <CheckCircle className="w-5 h-5" />
            기본 알림 테스트
          </button>
        </div>

        {/* Korean Methods */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            한국어 편의 메서드
          </h3>
          <button
            onClick={handleKoreanToasts}
            className="w-full flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <Save className="w-5 h-5" />
            한국어 알림 테스트
          </button>
        </div>

        {/* Action Toasts */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            액션 버튼 알림
          </h3>
          <button
            onClick={handleActionToasts}
            className="w-full flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            액션 알림 테스트
          </button>
        </div>

        {/* Persistent Toasts */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            지속 알림
          </h3>
          <button
            onClick={handlePersistentToasts}
            className="w-full flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            
            중요 알림 테스트
          </button>
        </div>

        {/* Custom Duration */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            진행률 표시
          </h3>
          <button
            onClick={handleCustomDuration}
            className="w-full flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <Upload className="w-5 h-5" />
            진행률 알림 테스트
          </button>
        </div>

        {/* Stacked Toasts */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            스택형 알림
          </h3>
          <button
            onClick={handleStressTest}
            className="w-full flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <XCircle className="w-5 h-5" />
            다중 알림 테스트
          </button>
        </div>
      </div>

      {/* Individual Toast Tests */}
      <div className="space-y-3 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          개별 토스트 테스트
        </h3>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => toast.success('성공', '작업 완료!')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            성공
          </button>
          <button
            onClick={() => toast.error('오류', '문제 발생!')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <XCircle className="w-4 h-4" />
            오류
          </button>
          <button
            onClick={() => toast.warning('경고', '주의 필요!')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            
            경고
          </button>
          <button
            onClick={() => toast.info('정보', '알림 메시지!')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <Info className="w-4 h-4" />
            정보
          </button>
          <button
            onClick={() => toast.clearToasts()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            모두 지우기
          </button>
        </div>
      </div>

      {/* Feature Information */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          새로운 기능들
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 dark:text-white">향상된 기능</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>진행률 바 표시 (호버 시 일시정지)</li>
              <li>액션 버튼 지원 (실행취소, 상세보기, 재시도)</li>
              <li>지속 알림 (수동 닫기 필요)</li>
              <li>개선된 스택 애니메이션</li>
              <li>한국어 편의 메서드 확장</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 dark:text-white">디자인 개선</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>좌측 컬러 보더로 타입 구분</li>
              <li>호버 시 스택 확장 효과</li>
              <li>백드롭 블러 효과</li>
              <li>다크 모드 최적화</li>
              <li>접근성 향상 (ARIA 라벨)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Usage Examples */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          사용 예제 코드
        </h3>
        <pre className="text-sm text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap">
{`// 기본 사용법
toast.success('성공', '작업이 완료되었습니다.');
toast.error('오류', '문제가 발생했습니다.');

// 한국어 편의 메서드
toast.저장완료('데이터가 저장되었습니다.');
toast.삭제완료('항목이 삭제되었습니다.');

// 액션 버튼과 함께
toast.삭제완료_실행취소(
  '품목이 삭제되었습니다.',
  () => console.log('실행 취소!')
);

// 지속 알림
toast.중요알림('시스템 점검 예정', [
  { label: '확인', onClick: handleOk, style: 'primary' }
]);`}
        </pre>
      </div>
    </div>
  );
}