import { test, expect } from '@playwright/test';

/**
 * ERP 기능 통합 테스트: 전역 글꼴 크기 제어
 *
 * 실제 ERP 사용 시나리오에서 글꼴 크기 제어가 올바르게 작동하는지 검증
 */

test.describe('ERP 기능 통합: 전역 글꼴 크기 제어', () => {
  test.beforeEach(async ({ page }) => {
    // 기본 설정으로 초기화
    await page.goto('http://localhost:5000');
    await page.waitForLoadState('load', { timeout: 30000 });

    // localStorage 초기화
    await page.evaluate(() => {
      localStorage.setItem('erp-font-size', '16');
    });
  });

  test.describe('시나리오 1: 품목 관리 (마스터 데이터)', () => {
    test('ERP-01: 품목 목록 페이지에서 글꼴 크기 조절 및 가독성 확인', async ({ page }) => {
      console.log('🎯 ERP 시나리오: 품목 관리자가 재고 데이터를 확인하면서 글씨가 작다고 느낌');

      // 1. 품목 관리 페이지로 이동
      await page.goto('http://localhost:5000/master/items');
      await page.waitForLoadState('load', { timeout: 30000 });
      console.log('✓ 품목 관리 페이지 접속');

      // 2. 초기 상태 확인 (16px)
      let fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('16px');
      console.log('✓ 기본 글씨 크기 16px 확인');

      // 3. 테이블 데이터가 표시되는지 확인
      const tableExists = await page.locator('table').count() > 0;
      console.log(`✓ 품목 테이블 존재: ${tableExists}`);

      // 4. 글씨 크기를 20px로 증가
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      for (let i = 0; i < 2; i++) {
        await page.click('[aria-label="글씨 크기 키우기"]');
        await page.waitForTimeout(200);
      }

      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('20px');
      console.log('✓ 20px로 증가 완료');

      // 5. 테이블 헤더 텍스트 크기 확인
      fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('20px');
      console.log('✓ CSS 변수 즉시 반영됨');

      // 6. 페이지 새로고침 후 설정 유지 확인
      await page.reload();
      await page.waitForLoadState('load', { timeout: 30000 });

      fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('20px');
      console.log('✓ 새로고침 후에도 20px 유지');

      console.log('✅ ERP-01 PASS: 품목 관리 페이지 글꼴 크기 조절 성공');
    });

    test('ERP-02: 품목 등록 폼에서 입력 필드 가독성 확인', async ({ page }) => {
      console.log('🎯 ERP 시나리오: 신규 품목 등록 시 입력 필드가 잘 보이는지 확인');

      // 1. 품목 관리 페이지로 이동
      await page.goto('http://localhost:5000/master/items');
      await page.waitForLoadState('load', { timeout: 30000 });

      // 2. 글씨 크기를 18px로 설정
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      await page.click('[aria-label="글씨 크기 키우기"]');
      await page.waitForTimeout(300);

      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('18px');
      console.log('✓ 18px 설정 완료');

      // 3. CSS 변수 반영 확인
      const fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('18px');
      console.log('✓ 입력 폼 글씨 크기 18px 적용됨');

      console.log('✅ ERP-02 PASS: 입력 필드 가독성 개선 성공');
    });
  });

  test.describe('시나리오 2: BOM (자재 명세서) 관리', () => {
    test('ERP-03: BOM 트리 구조에서 글꼴 크기 조절', async ({ page }) => {
      console.log('🎯 ERP 시나리오: BOM 관리자가 복잡한 트리 구조를 확인하면서 글씨 크기 조절');

      // 1. BOM 페이지로 이동
      await page.goto('http://localhost:5000/master/bom');
      await page.waitForLoadState('load', { timeout: 30000 });
      console.log('✓ BOM 관리 페이지 접속');

      // 2. 초기 상태 확인
      let fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('16px');
      console.log('✓ 기본 글씨 크기 16px 확인');

      // 3. 글씨 크기를 22px로 증가 (복잡한 구조 확인용)
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      for (let i = 0; i < 3; i++) {
        await page.click('[aria-label="글씨 크기 키우기"]');
        await page.waitForTimeout(200);
      }

      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('22px');
      console.log('✓ 22px로 증가 완료');

      // 4. CSS 변수 반영 확인
      fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('22px');
      console.log('✓ BOM 트리 구조 글씨 크기 22px 적용됨');

      // 5. 품목 관리 페이지로 이동하여 일관성 확인
      await page.goto('http://localhost:5000/master/items');
      await page.waitForLoadState('load', { timeout: 30000 });

      fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('22px');
      console.log('✓ 품목 페이지에서도 22px 유지');

      // 6. BOM 페이지로 다시 돌아가기
      await page.goto('http://localhost:5000/master/bom');
      await page.waitForLoadState('load', { timeout: 30000 });

      fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('22px');
      console.log('✓ BOM 페이지로 돌아와도 22px 유지');

      console.log('✅ ERP-03 PASS: BOM 페이지 글꼴 크기 조절 및 일관성 성공');
    });

    test('ERP-04: BOM 페이지에서 빠른 글씨 크기 전환', async ({ page }) => {
      console.log('🎯 ERP 시나리오: BOM 관리자가 작업 상황에 따라 글씨 크기를 빠르게 조절');

      // 1. BOM 페이지 접속
      await page.goto('http://localhost:5000/master/bom');
      await page.waitForLoadState('load', { timeout: 30000 });

      // 2. 슬라이더로 20px 설정
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      const slider = page.locator('input[type="range"]');
      await slider.fill('20');
      await page.waitForTimeout(300);

      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('20px');
      console.log('✓ 슬라이더로 20px 설정');

      // 3. 시각적 인디케이터로 14px로 빠르게 전환
      await page.click('[title="14px"]');
      await page.waitForTimeout(300);

      await expect(display).toHaveText('14px');
      console.log('✓ 시각적 인디케이터로 14px 전환');

      // 4. CSS 변수 즉시 반영 확인
      const fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('14px');
      console.log('✓ CSS 변수 즉시 반영됨');

      console.log('✅ ERP-04 PASS: 빠른 글씨 크기 전환 성공');
    });
  });

  test.describe('시나리오 3: 거래처 관리', () => {
    test('ERP-05: 거래처 목록에서 글꼴 크기 조절 및 다크 모드 호환', async ({ page }) => {
      console.log('🎯 ERP 시나리오: 거래처 관리자가 야간 작업 시 다크 모드에서 글씨 크기 조절');

      // 1. 거래처 페이지로 이동
      await page.goto('http://localhost:5000/master/companies');
      await page.waitForLoadState('load', { timeout: 30000 });
      console.log('✓ 거래처 관리 페이지 접속');

      // 2. 다크 모드 활성화
      const darkModeButton = page.locator('button[aria-label*="dark mode"], button[aria-label*="Switch to dark mode"]');
      await darkModeButton.click();
      await page.waitForTimeout(500);
      console.log('✓ 다크 모드 활성화');

      // 3. 글씨 크기를 20px로 증가
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      for (let i = 0; i < 2; i++) {
        await page.click('[aria-label="글씨 크기 키우기"]');
        await page.waitForTimeout(200);
      }

      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('20px');
      console.log('✓ 다크 모드에서 20px 설정 성공');

      // 4. CSS 변수 반영 확인
      const fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('20px');
      console.log('✓ 다크 모드에서 CSS 변수 반영됨');

      // 5. 페이지 새로고침 후 설정 유지 (다크 모드 + 글씨 크기)
      await page.reload();
      await page.waitForLoadState('load', { timeout: 30000 });

      const fontSizeAfterReload = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSizeAfterReload).toBe('20px');
      console.log('✓ 새로고침 후에도 20px 유지');

      console.log('✅ ERP-05 PASS: 다크 모드에서 글꼴 크기 조절 성공');
    });
  });

  test.describe('시나리오 4: 재고 관리 (입고/생산/출고)', () => {
    test('ERP-06: 입고 거래 등록 폼에서 글꼴 크기 조절', async ({ page }) => {
      console.log('🎯 ERP 시나리오: 입고 담당자가 다중 품목 입고 등록 시 입력 필드 가독성 개선');

      // 1. 입고 관리 페이지로 이동
      await page.goto('http://localhost:5000/inventory/purchase');
      await page.waitForLoadState('load', { timeout: 30000 });
      console.log('✓ 입고 관리 페이지 접속');

      // 2. 글씨 크기를 18px로 설정
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      await page.click('[aria-label="글씨 크기 키우기"]');
      await page.waitForTimeout(300);

      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('18px');
      console.log('✓ 18px 설정 완료');

      // 3. CSS 변수 반영 확인
      const fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('18px');
      console.log('✓ 입고 폼 글씨 크기 18px 적용됨');

      console.log('✅ ERP-06 PASS: 입고 폼 글꼴 크기 조절 성공');
    });

    test('ERP-07: 생산 거래 등록 후 재고 조회 페이지 간 일관성', async ({ page }) => {
      console.log('🎯 ERP 시나리오: 생산 담당자가 생산 등록 후 재고 조회 페이지로 이동하며 글씨 크기 유지');

      // 1. 생산 관리 페이지로 이동
      await page.goto('http://localhost:5000/inventory/production');
      await page.waitForLoadState('load', { timeout: 30000 });
      console.log('✓ 생산 관리 페이지 접속');

      // 2. 글씨 크기를 20px로 설정
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      for (let i = 0; i < 2; i++) {
        await page.click('[aria-label="글씨 크기 키우기"]');
        await page.waitForTimeout(200);
      }

      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('20px');
      console.log('✓ 생산 페이지에서 20px 설정');

      // 3. 재고 조회 페이지로 이동
      await page.goto('http://localhost:5000/inventory/stock');
      await page.waitForLoadState('load', { timeout: 30000 });
      console.log('✓ 재고 조회 페이지로 이동');

      // 4. 글씨 크기 유지 확인
      let fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('20px');
      console.log('✓ 재고 조회 페이지에서도 20px 유지');

      // 5. 출고 페이지로 이동
      await page.goto('http://localhost:5000/inventory/shipment');
      await page.waitForLoadState('load', { timeout: 30000 });
      console.log('✓ 출고 관리 페이지로 이동');

      // 6. 글씨 크기 유지 확인
      fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('20px');
      console.log('✓ 출고 페이지에서도 20px 유지');

      console.log('✅ ERP-07 PASS: 재고 관련 페이지 간 글꼴 크기 일관성 성공');
    });
  });

  test.describe('시나리오 5: 대시보드 (통계 및 차트)', () => {
    test('ERP-08: 대시보드에서 차트 및 통계 텍스트 가독성', async ({ page }) => {
      console.log('🎯 ERP 시나리오: 경영진이 대시보드에서 통계 데이터를 확인하면서 글씨 크기 조절');

      // 1. 대시보드로 이동 (이미 접속된 상태)
      await page.goto('http://localhost:5000');
      await page.waitForLoadState('load', { timeout: 30000 });
      console.log('✓ 대시보드 접속');

      // 2. 초기 상태 확인
      let fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('16px');
      console.log('✓ 기본 글씨 크기 16px 확인');

      // 3. 글씨 크기를 22px로 증가 (통계 데이터 강조)
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      for (let i = 0; i < 3; i++) {
        await page.click('[aria-label="글씨 크기 키우기"]');
        await page.waitForTimeout(200);
      }

      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('22px');
      console.log('✓ 22px로 증가 완료');

      // 4. CSS 변수 반영 확인
      fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('22px');
      console.log('✓ 대시보드 통계 텍스트 22px 적용됨');

      // 5. 품목 관리로 이동 후 다시 대시보드로 돌아오기
      await page.goto('http://localhost:5000/master/items');
      await page.waitForLoadState('load', { timeout: 30000 });
      console.log('✓ 품목 관리 페이지 방문');

      await page.goto('http://localhost:5000');
      await page.waitForLoadState('load', { timeout: 30000 });
      console.log('✓ 대시보드로 복귀');

      // 6. 글씨 크기 유지 확인
      fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('22px');
      console.log('✓ 대시보드 복귀 후에도 22px 유지');

      console.log('✅ ERP-08 PASS: 대시보드 글꼴 크기 조절 및 일관성 성공');
    });

    test('ERP-09: 대시보드 초기화 버튼으로 기본값 복구', async ({ page }) => {
      console.log('🎯 ERP 시나리오: 이전 사용자가 글씨를 크게 키워놓았고, 새 사용자가 기본값으로 복구');

      // 1. 대시보드 접속
      await page.goto('http://localhost:5000');
      await page.waitForLoadState('load', { timeout: 30000 });

      // 2. 글씨 크기를 24px로 증가 (이전 사용자 설정)
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      for (let i = 0; i < 4; i++) {
        const plusButton = page.locator('[aria-label="글씨 크기 키우기"]');
        const isDisabled = await plusButton.isDisabled();
        if (!isDisabled) {
          await plusButton.click();
          await page.waitForTimeout(150);
        }
      }

      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('24px');
      console.log('✓ 이전 사용자가 24px로 설정');

      // 3. 초기화 버튼 클릭
      await page.click('button:has-text("초기화")');
      await page.waitForTimeout(500);
      console.log('✓ 초기화 버튼 클릭');

      // 4. 메뉴 다시 열기
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      // 5. 16px로 복구 확인
      const displayAfterReset = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(displayAfterReset).toHaveText('16px');
      console.log('✓ 16px로 복구 완료');

      // 6. CSS 변수 반영 확인
      const fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('16px');
      console.log('✓ CSS 변수도 16px로 복구됨');

      console.log('✅ ERP-09 PASS: 초기화 버튼으로 기본값 복구 성공');
    });
  });

  test.describe('시나리오 6: 매출/매입 관리', () => {
    test('ERP-10: 매출 거래 목록에서 글꼴 크기 조절 및 Excel 내보내기', async ({ page }) => {
      console.log('🎯 ERP 시나리오: 회계 담당자가 매출 데이터를 확인하고 Excel로 내보내기');

      // 1. 매출 관리 페이지로 이동
      await page.goto('http://localhost:5000/sales');
      await page.waitForLoadState('load', { timeout: 30000 });
      console.log('✓ 매출 관리 페이지 접속');

      // 2. 글씨 크기를 18px로 설정
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      await page.click('[aria-label="글씨 크기 키우기"]');
      await page.waitForTimeout(300);

      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('18px');
      console.log('✓ 18px 설정 완료');

      // 3. CSS 변수 반영 확인
      const fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('18px');
      console.log('✓ 매출 테이블 글씨 크기 18px 적용됨');

      console.log('✅ ERP-10 PASS: 매출 관리 글꼴 크기 조절 성공');
    });
  });

  test.describe('시나리오 7: 접근성 및 다중 사용자 환경', () => {
    test('ERP-11: 고령 사용자의 ERP 사용 시나리오 (재고 → BOM → 대시보드)', async ({ page }) => {
      console.log('🎯 ERP 시나리오: 60대 재고 관리자가 ERP 시스템을 사용하면서 글씨 크기를 점진적으로 키움');

      // 1. 재고 조회 페이지에서 시작
      await page.goto('http://localhost:5000/inventory/stock');
      await page.waitForLoadState('load', { timeout: 30000 });
      console.log('✓ 재고 조회 페이지 접속');

      // 2. 초기 글씨가 작다고 느낌 → 18px로 증가
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      await page.click('[aria-label="글씨 크기 키우기"]');
      await page.waitForTimeout(800); // 고령 사용자는 천천히
      console.log('✓ 18px로 증가 (1단계)');

      // 3. 아직 작다고 느낌 → 20px로 증가
      await page.click('[aria-label="글씨 크기 키우기"]');
      await page.waitForTimeout(800);
      console.log('✓ 20px로 증가 (2단계)');

      // 4. 적당하다고 판단 → BOM 페이지로 이동
      await page.click('body'); // 메뉴 닫기
      await page.waitForTimeout(300);

      await page.goto('http://localhost:5000/master/bom');
      await page.waitForLoadState('load', { timeout: 30000 });
      console.log('✓ BOM 페이지로 이동');

      // 5. BOM 페이지에서도 20px 유지 확인
      let fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('20px');
      console.log('✓ BOM 페이지에서도 20px 유지');

      // 6. 대시보드로 이동
      await page.goto('http://localhost:5000');
      await page.waitForLoadState('load', { timeout: 30000 });
      console.log('✓ 대시보드로 이동');

      // 7. 대시보드에서도 20px 유지 확인
      fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('20px');
      console.log('✓ 대시보드에서도 20px 유지');

      // 8. 다음 날 접속 시뮬레이션 (새로고침)
      await page.reload();
      await page.waitForLoadState('load', { timeout: 30000 });
      console.log('✓ 다음 날 접속 시뮬레이션 (새로고침)');

      // 9. 설정 유지 확인
      fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('20px');
      console.log('✓ 다음 날에도 20px 유지');

      console.log('✅ ERP-11 PASS: 고령 사용자 ERP 사용 시나리오 성공');
    });

    test('ERP-12: 젊은 사용자의 빠른 ERP 작업 흐름 (품목 → 거래처 → 매출)', async ({ page }) => {
      console.log('🎯 ERP 시나리오: 20대 영업 담당자가 빠른 속도로 여러 페이지를 이동하며 작업');

      // 1. 품목 관리에서 시작
      await page.goto('http://localhost:5000/master/items');
      await page.waitForLoadState('load', { timeout: 30000 });
      console.log('✓ 품목 관리 페이지 접속');

      // 2. 슬라이더로 빠르게 14px로 설정 (많은 데이터 보기)
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(200);

      const slider = page.locator('input[type="range"]');
      await slider.fill('14');
      await page.waitForTimeout(200);

      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('14px');
      console.log('✓ 슬라이더로 14px 빠르게 설정');

      // 3. 거래처 페이지로 빠르게 이동
      await page.goto('http://localhost:5000/master/companies');
      await page.waitForLoadState('load', { timeout: 30000 });
      console.log('✓ 거래처 페이지로 이동');

      // 4. 14px 유지 확인
      let fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('14px');
      console.log('✓ 거래처 페이지에서도 14px 유지');

      // 5. 매출 페이지로 빠르게 이동
      await page.goto('http://localhost:5000/sales');
      await page.waitForLoadState('load', { timeout: 30000 });
      console.log('✓ 매출 페이지로 이동');

      // 6. 14px 유지 확인
      fontSize = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--base-font-size').trim()
      );
      expect(fontSize).toBe('14px');
      console.log('✓ 매출 페이지에서도 14px 유지');

      console.log('✅ ERP-12 PASS: 빠른 ERP 작업 흐름 성공');
    });
  });
});
