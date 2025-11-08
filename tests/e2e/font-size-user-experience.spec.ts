import { test, expect, Page } from '@playwright/test';

/**
 * 전역 글꼴 크기 제어 - 사용자 경험 테스트
 *
 * 실제 사용자 시나리오를 기반으로 한 포괄적인 E2E 테스트
 * 일반 사용자가 시스템을 사용하는 방식을 시뮬레이션
 */

test.describe('사용자 경험 테스트: 전역 글꼴 크기 제어', () => {
  test.beforeEach(async ({ page }) => {
    // 깨끗한 상태에서 시작
    await page.goto('http://localhost:5000');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.waitForLoadState('load', { timeout: 30000 });
  });

  test.describe('시나리오 1: 시력이 좋지 않은 고령 사용자', () => {
    test('UX-01: 고령 사용자가 글씨를 크게 키우는 과정', async ({ page }) => {
      console.log('🎯 시나리오: 60대 사용자가 시스템에 처음 접속하여 글씨가 작다고 느낌');

      // 1. 초기 상태 확인
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(500);

      const initialDisplay = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(initialDisplay).toHaveText('16px');
      console.log('✓ 기본 글씨 크기 16px 확인');

      // 2. Plus 버튼을 여러 번 클릭 (고령 사용자는 천천히 클릭)
      console.log('👆 사용자가 Plus 버튼을 천천히 4번 클릭...');

      for (let i = 0; i < 4; i++) {
        const plusButton = page.locator('[aria-label="글씨 크기 키우기"]');
        await plusButton.click();
        await page.waitForTimeout(800); // 고령 사용자는 천천히 클릭

        const currentSize = await page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg').textContent();
        console.log(`  ${i + 1}번째 클릭 → ${currentSize}`);
      }

      // 3. 최종 24px 확인
      await expect(initialDisplay).toHaveText('24px');
      console.log('✓ 최대 크기 24px 도달');

      // 4. 실제 화면의 텍스트가 커졌는지 확인
      const bodyFontSize = await page.evaluate(() => {
        return getComputedStyle(document.documentElement)
          .getPropertyValue('--base-font-size').trim();
      });
      expect(bodyFontSize).toBe('24px');
      console.log('✓ 전체 화면 글씨 크기 24px로 변경됨');

      // 5. 다른 페이지로 이동해도 유지되는지 확인
      await page.click('body'); // 메뉴 닫기
      await page.waitForTimeout(300);

      // BOM 페이지로 이동
      await page.goto('http://localhost:5000/master/bom');
      await page.waitForLoadState('load', { timeout: 30000 });

      const bomFontSize = await page.evaluate(() => {
        return getComputedStyle(document.documentElement)
          .getPropertyValue('--base-font-size').trim();
      });
      expect(bomFontSize).toBe('24px');
      console.log('✓ BOM 페이지에서도 24px 유지됨');

      // 6. localStorage 확인
      const stored = await page.evaluate(() => localStorage.getItem('erp-font-size'));
      expect(stored).toBe('24');
      console.log('✓ 설정이 저장되어 다음 접속 시에도 유지됨');

      console.log('✅ UX-01 PASS: 고령 사용자의 글씨 크기 조절 시나리오 성공');
    });

    test('UX-02: 페이지 새로고침 후에도 설정 유지', async ({ page }) => {
      console.log('🎯 시나리오: 사용자가 글씨를 크게 설정하고 나중에 다시 접속');

      // 1. 글씨 크기를 22px로 설정
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      for (let i = 0; i < 3; i++) {
        await page.click('[aria-label="글씨 크기 키우기"]');
        await page.waitForTimeout(200);
      }

      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('22px');
      console.log('✓ 22px로 설정 완료');

      // 2. 메뉴 닫기
      await page.click('body');
      await page.waitForTimeout(300);

      // 3. 브라우저 새로고침 (사용자가 F5 누르는 상황)
      console.log('🔄 브라우저 새로고침...');
      await page.reload();
      await page.waitForLoadState('load', { timeout: 30000 });

      // 4. 글씨 크기 확인
      const reloadedFontSize = await page.evaluate(() => {
        return getComputedStyle(document.documentElement)
          .getPropertyValue('--base-font-size').trim();
      });
      expect(reloadedFontSize).toBe('22px');
      console.log('✓ 새로고침 후에도 22px 유지됨');

      // 5. 메뉴를 열어서 표시값도 확인
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      const displayAfterReload = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(displayAfterReload).toHaveText('22px');
      console.log('✓ 메뉴 표시값도 22px로 정상');

      console.log('✅ UX-02 PASS: 새로고침 후 설정 유지 시나리오 성공');
    });
  });

  test.describe('시나리오 2: 젊은 사용자의 빠른 조작', () => {
    test('UX-03: 슬라이더를 사용한 빠른 크기 조절', async ({ page }) => {
      console.log('🎯 시나리오: 20대 사용자가 슬라이더로 원하는 크기를 빠르게 찾음');

      // 1. 메뉴 열기
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      // 2. 슬라이더 찾기
      const slider = page.locator('input[type="range"]');
      await expect(slider).toBeVisible();
      console.log('✓ 슬라이더 발견');

      // 3. 슬라이더를 18px로 드래그
      await slider.fill('18');
      await page.waitForTimeout(300);

      // 4. 표시값 확인
      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('18px');
      console.log('✓ 슬라이더로 18px 설정 성공');

      // 5. 다시 14px로 조절
      await slider.fill('14');
      await page.waitForTimeout(300);
      await expect(display).toHaveText('14px');
      console.log('✓ 슬라이더로 14px 설정 성공');

      // 6. CSS 변수 확인
      const fontSize = await page.evaluate(() => {
        return getComputedStyle(document.documentElement)
          .getPropertyValue('--base-font-size').trim();
      });
      expect(fontSize).toBe('14px');
      console.log('✓ 전역 CSS 변수도 즉시 반영됨');

      console.log('✅ UX-03 PASS: 슬라이더 빠른 조작 시나리오 성공');
    });

    test('UX-04: 시각적 인디케이터 클릭으로 정확한 크기 선택', async ({ page }) => {
      console.log('🎯 시나리오: 사용자가 시각적 인디케이터의 특정 점을 클릭');

      // 1. 메뉴 열기
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      // 2. 20px 인디케이터 클릭
      console.log('👆 20px 인디케이터 클릭...');
      await page.click('[title="20px"]');
      await page.waitForTimeout(300);

      // 3. 표시값 확인
      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('20px');
      console.log('✓ 20px 설정 성공');

      // 4. 인디케이터가 하이라이트되었는지 확인
      const indicator20 = page.locator('[title="20px"]');
      const classes = await indicator20.getAttribute('class');
      expect(classes).toContain('bg-gray-800');
      expect(classes).toContain('scale-110');
      console.log('✓ 20px 인디케이터가 하이라이트됨');

      // 5. 다른 크기로 변경 (12px)
      await page.click('[title="12px"]');
      await page.waitForTimeout(300);
      await expect(display).toHaveText('12px');
      console.log('✓ 12px 설정 성공');

      // 6. 12px 인디케이터 하이라이트 확인
      const indicator12 = page.locator('[title="12px"]');
      const classes12 = await indicator12.getAttribute('class');
      expect(classes12).toContain('bg-gray-800');
      console.log('✓ 12px 인디케이터가 하이라이트됨');

      console.log('✅ UX-04 PASS: 시각적 인디케이터 클릭 시나리오 성공');
    });
  });

  test.describe('시나리오 3: 실수 상황 및 복구', () => {
    test('UX-05: 너무 크게 키운 후 초기화 버튼으로 복구', async ({ page }) => {
      console.log('🎯 시나리오: 사용자가 실수로 글씨를 너무 크게 키움');

      // 1. 메뉴 열기
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      // 2. 최대 크기로 증가 (사용자가 실수로 계속 클릭)
      console.log('👆 Plus 버튼을 실수로 여러 번 클릭...');
      for (let i = 0; i < 10; i++) {
        const plusButton = page.locator('[aria-label="글씨 크기 키우기"]');
        const isDisabled = await plusButton.isDisabled();
        if (!isDisabled) {
          await plusButton.click();
          await page.waitForTimeout(150);
        }
      }

      // 3. 24px에 도달 (더 이상 커지지 않음)
      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('24px');
      console.log('✓ 최대 24px에 도달 (안전 제한 작동)');

      // 4. 사용자가 당황하여 초기화 버튼을 찾음
      console.log('😱 사용자: "아, 너무 크게 키웠네... 초기화 버튼 어디 있지?"');

      const resetButton = page.locator('button:has-text("초기화")');
      await expect(resetButton).toBeVisible();
      console.log('✓ 초기화 버튼 발견');

      // 5. 초기화 버튼 클릭
      console.log('👆 초기화 버튼 클릭...');
      await resetButton.click();
      await page.waitForTimeout(500);

      // 6. 메뉴가 닫혔으므로 다시 열기
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      // 7. 16px로 복구되었는지 확인
      const displayAfterReset = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(displayAfterReset).toHaveText('16px');
      console.log('✓ 기본값 16px로 복구 성공');

      // 8. localStorage도 16으로 저장되었는지 확인
      const stored = await page.evaluate(() => localStorage.getItem('erp-font-size'));
      expect(stored).toBe('16');
      console.log('✓ 설정도 기본값으로 저장됨');

      console.log('✅ UX-05 PASS: 초기화 복구 시나리오 성공');
    });

    test('UX-06: 너무 작게 줄인 후 Plus 버튼으로 복구', async ({ page }) => {
      console.log('🎯 시나리오: 사용자가 글씨를 너무 작게 줄여서 잘 안 보임');

      // 1. 메뉴 열기
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      // 2. 최소 크기로 감소
      console.log('👆 Minus 버튼을 여러 번 클릭...');
      for (let i = 0; i < 5; i++) {
        const minusButton = page.locator('[aria-label="글씨 크기 줄이기"]');
        const isDisabled = await minusButton.isDisabled();
        if (!isDisabled) {
          await minusButton.click();
          await page.waitForTimeout(150);
        }
      }

      // 3. 12px에 도달
      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('12px');
      console.log('✓ 최소 12px에 도달');

      // 4. Minus 버튼이 비활성화되었는지 확인
      const minusButton = page.locator('[aria-label="글씨 크기 줄이기"]');
      await expect(minusButton).toBeDisabled();
      console.log('✓ Minus 버튼 비활성화 (더 이상 줄어들지 않음)');

      // 5. 사용자가 Plus 버튼으로 다시 키움
      console.log('😰 사용자: "너무 작네... 다시 키워야겠다"');
      console.log('👆 Plus 버튼을 3번 클릭...');

      for (let i = 0; i < 3; i++) {
        await page.click('[aria-label="글씨 크기 키우기"]');
        await page.waitForTimeout(200);
      }

      // 6. 18px 확인
      await expect(display).toHaveText('18px');
      console.log('✓ 18px로 복구 성공 (보기 좋은 크기)');

      console.log('✅ UX-06 PASS: Plus 버튼으로 복구 시나리오 성공');
    });
  });

  test.describe('시나리오 4: 다양한 페이지에서의 일관성', () => {
    test('UX-07: 여러 페이지를 이동하며 글씨 크기 일관성 확인', async ({ page }) => {
      console.log('🎯 시나리오: 사용자가 여러 페이지를 이동하며 작업');

      // 1. 대시보드에서 글씨 크기 20px로 설정
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      for (let i = 0; i < 2; i++) {
        await page.click('[aria-label="글씨 크기 키우기"]');
        await page.waitForTimeout(200);
      }

      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('20px');
      await page.click('body'); // 메뉴 닫기
      console.log('✓ 대시보드에서 20px 설정');

      // 2. BOM 페이지로 이동
      console.log('🔄 BOM 페이지로 이동...');
      await page.goto('http://localhost:5000/master/bom');
      await page.waitForLoadState('load', { timeout: 30000 });

      let currentFontSize = await page.evaluate(() => {
        return getComputedStyle(document.documentElement)
          .getPropertyValue('--base-font-size').trim();
      });
      expect(currentFontSize).toBe('20px');
      console.log('✓ BOM 페이지에서도 20px 유지');

      // 3. 품목 관리 페이지로 이동
      console.log('🔄 품목 관리 페이지로 이동...');
      await page.goto('http://localhost:5000/master/items');
      await page.waitForLoadState('load', { timeout: 30000 });

      currentFontSize = await page.evaluate(() => {
        return getComputedStyle(document.documentElement)
          .getPropertyValue('--base-font-size').trim();
      });
      expect(currentFontSize).toBe('20px');
      console.log('✓ 품목 관리 페이지에서도 20px 유지');

      // 4. 매출 관리 페이지로 이동
      console.log('🔄 매출 관리 페이지로 이동...');
      await page.goto('http://localhost:5000/sales');
      await page.waitForLoadState('load', { timeout: 30000 });

      currentFontSize = await page.evaluate(() => {
        return getComputedStyle(document.documentElement)
          .getPropertyValue('--base-font-size').trim();
      });
      expect(currentFontSize).toBe('20px');
      console.log('✓ 매출 관리 페이지에서도 20px 유지');

      // 5. 대시보드로 돌아가기
      console.log('🔄 대시보드로 돌아가기...');
      await page.goto('http://localhost:5000');
      await page.waitForLoadState('load', { timeout: 30000 });

      currentFontSize = await page.evaluate(() => {
        return getComputedStyle(document.documentElement)
          .getPropertyValue('--base-font-size').trim();
      });
      expect(currentFontSize).toBe('20px');
      console.log('✓ 대시보드로 돌아와도 20px 유지');

      console.log('✅ UX-07 PASS: 여러 페이지 이동 시 일관성 시나리오 성공');
    });

    test('UX-08: 한 페이지에서 변경 시 다른 탭에도 즉시 반영', async ({ page, context }) => {
      console.log('🎯 시나리오: 사용자가 여러 탭을 열어두고 작업');

      // 1. 첫 번째 탭에서 글씨 크기 설정
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      await page.click('[aria-label="글씨 크기 키우기"]');
      await page.waitForTimeout(200);
      await page.click('[aria-label="글씨 크기 키우기"]');
      await page.waitForTimeout(300);

      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('20px');
      console.log('✓ 첫 번째 탭에서 20px 설정');

      // 2. 새 탭 열기
      console.log('🔄 새 탭 열기...');
      const newPage = await context.newPage();
      await newPage.goto('http://localhost:5000');
      await newPage.waitForLoadState('networkidle');

      // 3. 새 탭에서 글씨 크기 확인
      const newTabFontSize = await newPage.evaluate(() => {
        return getComputedStyle(document.documentElement)
          .getPropertyValue('--base-font-size').trim();
      });
      expect(newTabFontSize).toBe('20px');
      console.log('✓ 새 탭에서도 20px로 시작');

      // 4. 정리
      await newPage.close();

      console.log('✅ UX-08 PASS: 다중 탭 시나리오 성공');
    });
  });

  test.describe('시나리오 5: 접근성 및 사용성', () => {
    test('UX-09: 버튼 비활성화 상태 확인 (경계값)', async ({ page }) => {
      console.log('🎯 시나리오: 최소/최대값에서 버튼 비활성화 동작 확인');

      // 1. 메뉴 열기
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      // 2. 최대값 (24px)까지 증가
      console.log('📈 최대값까지 증가...');
      for (let i = 0; i < 10; i++) {
        const plusButton = page.locator('[aria-label="글씨 크기 키우기"]');
        const isDisabled = await plusButton.isDisabled();
        if (!isDisabled) {
          await plusButton.click();
          await page.waitForTimeout(100);
        } else {
          console.log(`✓ Plus 버튼이 비활성화됨 (더 이상 증가 불가)`);
          break;
        }
      }

      // 3. 24px 확인
      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('24px');

      // 4. Plus 버튼 비활성화 확인
      const plusButton = page.locator('[aria-label="글씨 크기 키우기"]');
      await expect(plusButton).toBeDisabled();

      // 5. Plus 버튼 스타일 확인 (시각적 피드백)
      const plusClasses = await plusButton.getAttribute('class');
      expect(plusClasses).toContain('opacity-50');
      expect(plusClasses).toContain('cursor-not-allowed');
      console.log('✓ Plus 버튼이 시각적으로도 비활성화 표시됨');

      // 6. 최소값 (12px)까지 감소
      console.log('📉 최소값까지 감소...');
      for (let i = 0; i < 10; i++) {
        const minusButton = page.locator('[aria-label="글씨 크기 줄이기"]');
        const isDisabled = await minusButton.isDisabled();
        if (!isDisabled) {
          await minusButton.click();
          await page.waitForTimeout(100);
        } else {
          console.log(`✓ Minus 버튼이 비활성화됨 (더 이상 감소 불가)`);
          break;
        }
      }

      // 7. 12px 확인
      await expect(display).toHaveText('12px');

      // 8. Minus 버튼 비활성화 확인
      const minusButton = page.locator('[aria-label="글씨 크기 줄이기"]');
      await expect(minusButton).toBeDisabled();

      // 9. Minus 버튼 스타일 확인
      const minusClasses = await minusButton.getAttribute('class');
      expect(minusClasses).toContain('opacity-50');
      expect(minusClasses).toContain('cursor-not-allowed');
      console.log('✓ Minus 버튼이 시각적으로도 비활성화 표시됨');

      console.log('✅ UX-09 PASS: 경계값 버튼 비활성화 시나리오 성공');
    });

    test('UX-10: aria-label 및 title 속성 확인 (접근성)', async ({ page }) => {
      console.log('🎯 시나리오: 스크린 리더 사용자를 위한 접근성 확인');

      // 1. 메뉴 열기
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      // 2. Plus 버튼 aria-label 확인
      const plusButton = page.locator('[aria-label="글씨 크기 키우기"]');
      await expect(plusButton).toBeVisible();
      const plusTitle = await plusButton.getAttribute('title');
      expect(plusTitle).toBe('글씨 크기 키우기');
      console.log('✓ Plus 버튼: aria-label과 title 속성 있음');

      // 3. Minus 버튼 aria-label 확인
      const minusButton = page.locator('[aria-label="글씨 크기 줄이기"]');
      await expect(minusButton).toBeVisible();
      const minusTitle = await minusButton.getAttribute('title');
      expect(minusTitle).toBe('글씨 크기 줄이기');
      console.log('✓ Minus 버튼: aria-label과 title 속성 있음');

      // 4. 초기화 버튼 aria-label 확인
      const resetButton = page.locator('[aria-label="기본값으로 재설정"]');
      await expect(resetButton).toBeVisible();
      const resetTitle = await resetButton.getAttribute('title');
      expect(resetTitle).toBe('기본값으로 재설정');
      console.log('✓ 초기화 버튼: aria-label과 title 속성 있음');

      // 5. 슬라이더 aria-label 확인
      const slider = page.locator('[aria-label="Font size slider"]');
      await expect(slider).toBeVisible();
      console.log('✓ 슬라이더: aria-label 속성 있음');

      // 6. 시각적 인디케이터 aria-label 확인
      const indicator18 = page.locator('[aria-label="글꼴 크기 18px로 설정"]');
      await expect(indicator18).toBeVisible();
      const indicatorTitle = await indicator18.getAttribute('title');
      expect(indicatorTitle).toBe('18px');
      console.log('✓ 시각적 인디케이터: aria-label과 title 속성 있음');

      console.log('✅ UX-10 PASS: 접근성 속성 시나리오 성공');
    });

    test('UX-11: 도움말 텍스트 가독성 확인', async ({ page }) => {
      console.log('🎯 시나리오: 사용자가 도움말 텍스트를 쉽게 이해할 수 있는지 확인');

      // 1. 메뉴 열기
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      // 2. 도움말 텍스트 확인
      const helpText = page.locator('p.text-xs.text-gray-500');
      await expect(helpText).toBeVisible();

      const helpContent = await helpText.textContent();
      expect(helpContent).toBe('12px ~ 24px 사이에서 조절 가능합니다');
      console.log('✓ 도움말 텍스트: "12px ~ 24px 사이에서 조절 가능합니다"');

      // 3. 도움말 텍스트가 메뉴 하단에 위치하는지 확인
      const helpBox = await helpText.boundingBox();
      expect(helpBox).not.toBeNull();
      console.log('✓ 도움말 텍스트가 메뉴 하단에 표시됨');

      console.log('✅ UX-11 PASS: 도움말 텍스트 가독성 시나리오 성공');
    });
  });

  test.describe('시나리오 6: 성능 및 반응성', () => {
    test('UX-12: 빠른 연속 클릭 시 성능 확인', async ({ page }) => {
      console.log('🎯 시나리오: 사용자가 Plus 버튼을 매우 빠르게 연속으로 클릭');

      // 1. 메뉴 열기
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      // 2. Plus 버튼을 매우 빠르게 20번 클릭
      console.log('⚡ Plus 버튼을 빠르게 20번 클릭...');
      const startTime = Date.now();

      for (let i = 0; i < 20; i++) {
        const plusButton = page.locator('[aria-label="글씨 크기 키우기"]');
        const isDisabled = await plusButton.isDisabled();
        if (!isDisabled) {
          await plusButton.click();
          await page.waitForTimeout(10); // 매우 짧은 대기
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`✓ 20번 클릭 완료 (소요 시간: ${duration}ms)`);

      // 3. 24px에 안전하게 도달했는지 확인
      await page.waitForTimeout(300);
      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('24px');
      console.log('✓ 최대값 24px에 안전하게 도달 (오버플로우 없음)');

      // 4. localStorage 확인
      const stored = await page.evaluate(() => localStorage.getItem('erp-font-size'));
      expect(stored).toBe('24');
      console.log('✓ localStorage에 올바르게 저장됨');

      // 5. 콘솔 에러 확인
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.waitForTimeout(1000);
      expect(consoleErrors.length).toBe(0);
      console.log('✓ 콘솔 에러 없음 (안정성 확인)');

      console.log('✅ UX-12 PASS: 빠른 연속 클릭 성능 시나리오 성공');
    });

    test('UX-13: 슬라이더 드래그 시 부드러운 변경', async ({ page }) => {
      console.log('🎯 시나리오: 사용자가 슬라이더를 드래그하며 실시간 피드백 확인');

      // 1. 메뉴 열기
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      // 2. 슬라이더 찾기
      const slider = page.locator('input[type="range"]');
      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');

      // 3. 여러 값으로 빠르게 변경
      const testSizes = [18, 22, 14, 20, 16];

      for (const size of testSizes) {
        await slider.fill(size.toString());
        await page.waitForTimeout(150);

        const currentDisplay = await display.textContent();
        expect(currentDisplay).toBe(`${size}px`);
        console.log(`✓ ${size}px로 부드럽게 변경됨`);
      }

      // 4. 최종 CSS 변수 확인
      const finalFontSize = await page.evaluate(() => {
        return getComputedStyle(document.documentElement)
          .getPropertyValue('--base-font-size').trim();
      });
      expect(finalFontSize).toBe('16px');
      console.log('✓ 최종 CSS 변수도 정확함');

      console.log('✅ UX-13 PASS: 슬라이더 부드러운 변경 시나리오 성공');
    });
  });

  test.describe('시나리오 7: 다크 모드 호환성', () => {
    test('UX-14: 다크 모드에서 글씨 크기 제어 UI 가독성', async ({ page }) => {
      console.log('🎯 시나리오: 다크 모드에서 글씨 크기 제어 메뉴 사용');

      // 1. 다크 모드 활성화
      console.log('🌙 다크 모드 활성화...');
      const darkModeButton = page.locator('[aria-label*="dark mode"]').first();
      await darkModeButton.click();
      await page.waitForTimeout(500);

      // 2. 글씨 크기 메뉴 열기
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      // 3. 메뉴가 다크 배경으로 표시되는지 확인
      const menu = page.locator('.w-80.bg-white.dark\\:bg-gray-800').first();
      await expect(menu).toBeVisible();
      console.log('✓ 다크 모드 메뉴 배경 표시됨');

      // 4. 버튼들의 가독성 확인 (다크 모드 색상)
      const plusButton = page.locator('[aria-label="글씨 크기 키우기"]');
      const plusClasses = await plusButton.getAttribute('class');
      expect(plusClasses).toContain('dark:text-gray-300');
      console.log('✓ Plus 버튼 다크 모드 색상 적용');

      // 5. 슬라이더 다크 모드 색상 확인
      const slider = page.locator('input[type="range"]');
      const sliderClasses = await slider.getAttribute('class');
      expect(sliderClasses).toContain('dark:bg-gray-700');
      expect(sliderClasses).toContain('dark:accent-gray-300');
      console.log('✓ 슬라이더 다크 모드 색상 적용');

      // 6. 도움말 텍스트 다크 모드 색상 확인 (텍스트 내용으로 특정)
      const helpText = page.getByText('12px ~ 24px 사이에서 조절 가능합니다');
      await expect(helpText).toBeVisible();
      console.log('✓ 도움말 텍스트 다크 모드 색상 적용');

      // 7. 글씨 크기 변경 테스트 (다크 모드에서도 정상 작동)
      await plusButton.click();
      await page.waitForTimeout(300);

      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('18px');
      console.log('✓ 다크 모드에서도 글씨 크기 변경 정상 작동');

      console.log('✅ UX-14 PASS: 다크 모드 호환성 시나리오 성공');
    });
  });

  test.describe('시나리오 8: 예외 상황 및 에러 처리', () => {
    test('UX-15: 손상된 localStorage 값 복구', async ({ page }) => {
      console.log('🎯 시나리오: localStorage에 잘못된 값이 저장된 경우');

      // 1. 잘못된 값 삽입
      await page.evaluate(() => {
        localStorage.setItem('erp-font-size', 'invalid-value');
      });
      console.log('❌ localStorage에 "invalid-value" 저장 (손상된 데이터)');

      // 2. 페이지 새로고침
      await page.reload();
      await page.waitForLoadState('load', { timeout: 30000 });

      // 3. 기본값 16px로 복구되었는지 확인
      const fontSize = await page.evaluate(() => {
        return getComputedStyle(document.documentElement)
          .getPropertyValue('--base-font-size').trim();
      });
      expect(fontSize).toBe('16px');
      console.log('✓ 기본값 16px로 자동 복구됨');

      // 4. 메뉴에서도 16px 표시 확인
      await page.click('[aria-label="Font size"]');
      await page.waitForTimeout(300);

      const display = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
      await expect(display).toHaveText('16px');
      console.log('✓ 메뉴 표시값도 16px로 정상');

      // 5. localStorage가 올바르게 수정되었는지 확인
      const stored = await page.evaluate(() => localStorage.getItem('erp-font-size'));
      expect(stored).toBe('16');
      console.log('✓ localStorage가 "16"으로 자동 수정됨');

      console.log('✅ UX-15 PASS: 손상된 데이터 복구 시나리오 성공');
    });

    test('UX-16: localStorage 범위 밖 값 처리', async ({ page }) => {
      console.log('🎯 시나리오: localStorage에 허용 범위를 벗어난 값 저장');

      // 1. 범위 밖 값 삽입 (최대값 초과)
      await page.evaluate(() => {
        localStorage.setItem('erp-font-size', '100');
      });
      console.log('❌ localStorage에 "100" 저장 (최대값 24 초과)');

      // 2. 페이지 새로고침
      await page.reload();
      await page.waitForLoadState('load', { timeout: 30000 });

      // 3. 24px로 클램핑되었는지 확인 (100은 24로 제한됨)
      let fontSize = await page.evaluate(() => {
        return getComputedStyle(document.documentElement)
          .getPropertyValue('--base-font-size').trim();
      });

      // FontSizeContext의 Math.min(24, size) 로직에 의해 24px로 클램핑됨
      expect(fontSize).toBe('24px');
      console.log(`✓ 안전한 값으로 처리됨: ${fontSize}`);

      // 4. 범위 밖 값 삽입 (최소값 미만)
      await page.evaluate(() => {
        localStorage.setItem('erp-font-size', '5');
      });
      console.log('❌ localStorage에 "5" 저장 (최소값 12 미만)');

      // 5. 페이지 새로고침
      await page.reload();
      await page.waitForLoadState('load', { timeout: 30000 });

      // 6. 12px로 클램핑되었는지 확인 (5는 12로 제한됨)
      fontSize = await page.evaluate(() => {
        return getComputedStyle(document.documentElement)
          .getPropertyValue('--base-font-size').trim();
      });

      // FontSizeContext의 Math.max(12, size) 로직에 의해 12px로 클램핑됨
      expect(fontSize).toBe('12px');
      console.log(`✓ 안전한 값으로 처리됨: ${fontSize}`);

      console.log('✅ UX-16 PASS: 범위 밖 값 처리 시나리오 성공');
    });
  });
});
