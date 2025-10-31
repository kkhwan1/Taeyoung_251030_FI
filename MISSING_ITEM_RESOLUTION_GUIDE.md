# Invalid P/NO 해결 가이드

생성일시: 2025-01-30
목적: 37건의 Invalid P/NO 레코드 복구

## 📋 문제 요약

### 현재 상태
- **건너뛴 레코드**: 37건 (Invalid P/NO)
- **복구 가능**: 31건 (83.8%) - 숫자 전용 품목 코드
- **복구 불가**: 6건 (16.2%) - null 값

### 원인 분석
1. **품목 코드 형식 불일치**: 시스템은 하이픈 포함(69116-DO000), 일부 데이터는 숫자만(50011800)
2. **품목 마스터 누락**: 27개 고유 품목 코드가 items 테이블에 없음
3. **데이터 품질 문제**: 6건은 P/NO 자체가 null

## 🚀 빠른 실행 (3단계)

```bash
# Step 1: 품목 추가
npm run tsx scripts/migration/add-missing-items.ts

# Step 2: 입고 거래 재임포트
npm run tsx scripts/migration/reimport-numeric-pno.ts

# Step 3: 검증
npm run tsx scripts/verification/verify-invalid-pno-recovery.ts
```

## 📊 예상 효과

| 지표 | 이전 | 예상 | 개선 |
|------|------|------|------|
| 입고 레코드 | 81건 | 112건 | +31건 (+38.3%) |
| 임포트율 | 35.1% | 48.5% | +13.4%p |
| 품목 수 | 현재 | +27개 | - |

## 🎯 실행 체크리스트

- [ ] Step 1: 27개 품목 추가 완료
- [ ] Step 2: 31건 입고 거래 복구 완료
- [ ] Step 3: 검증 PASS
- [ ] 프론트엔드 테스트 완료
- [ ] INBOUND_IMPORT_FINAL_SUMMARY.md 업데이트

## 📁 생성된 파일

### 실행 스크립트
1. `scripts/migration/add-missing-items.ts` - 품목 추가
2. `scripts/migration/reimport-numeric-pno.ts` - 재임포트
3. `scripts/verification/verify-invalid-pno-recovery.ts` - 검증

### 분석 및 보고서
1. `scripts/analysis/invalid-pno-analysis.json` - 분석 데이터
2. `INVALID_PNO_ANALYSIS_REPORT.md` - 상세 분석 보고서
3. `MISSING_ITEM_RESOLUTION_GUIDE.md` - 실행 가이드 (본 문서)

---

**전체 문서**: `INVALID_PNO_ANALYSIS_REPORT.md` 참조
**작성자**: Database Optimization Expert
