# 테스트 파일 아카이브

이 폴더는 개발 과정에서 사용된 테스트 파일들을 정리한 아카이브입니다.

## 📁 폴더 구조

### `/csv-data/` - CSV 테스트 데이터
- `test-bulk-upload.csv` - 대량 업로드 테스트 데이터
- `test-bulk-upload-real.csv` - 실제 대량 업로드 테스트 데이터
- `test-data.csv` - 일반 테스트 데이터

### `/validation-scripts/` - 검증 스크립트
- `validate-coating-status.js` - 도장 상태 검증 스크립트
- `validate-coating-status-correct.js` - 도장 상태 검증 (수정 버전)
- `validate-coating-status-full.js` - 도장 상태 전체 검증
- `validate-deployment.ts` - 배포 검증 스크립트

### `/reports/` - 코드 리뷰 및 테스트 리포트
- `CODE_REVIEW_REPORT_2025-10-07T16-58-02.txt` - 코드 리뷰 리포트 (2025-10-07)

## 🔍 현재 활성 테스트

활성 테스트 파일들은 다음 위치에 유지됩니다:
- `src/__tests__/` - Jest/Vitest 단위 테스트
- `tests/` - E2E 및 통합 테스트 (root 디렉토리)
- `test-results/` - 최신 테스트 결과 (root 디렉토리)

## 📝 정리 날짜

2025년 10월 23일 - TypeScript 오류 수정 완료 후 정리
