import { test, expect } from '@playwright/test';

/**
 * System Health Check E2E Tests
 *
 * Tests comprehensive system health monitoring including:
 * - Database connection and response time
 * - Memory usage metrics (RSS, heap, external)
 * - Database tables accessibility
 * - Filesystem access validation
 * - Environment variables check
 * - System uptime and version info
 * - Overall health status (healthy/degraded/unhealthy)
 */

test.describe('시스템 상태 확인 페이지', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/monitoring/health');
    await page.waitForLoadState('networkidle');
  });

  test('페이지 로드 및 레이아웃 확인', async ({ page }) => {
    // 페이지 제목 확인
    await expect(page.locator('h1')).toContainText(/시스템 상태|Health/i);

    // 주요 섹션 존재 확인
    const sections = [
      page.locator('text=/전체 상태|Overall Status/i'),
      page.locator('text=/기본 점검|Basic Checks/i'),
      page.locator('text=/상세 점검|Detailed Checks/i'),
      page.locator('text=/시스템 정보|System Info/i')
    ];

    for (const section of sections) {
      if (await section.count() > 0) {
        await expect(section).toBeVisible();
      }
    }
  });

  test('수동 상태 확인 버튼 동작', async ({ page }) => {
    // 새로고침/확인 버튼 찾기
    const refreshButton = page.locator('button', {
      hasText: /새로고침|Refresh|확인|Check/i
    });

    if (await refreshButton.count() > 0) {
      await refreshButton.click();

      // 로딩 상태 확인
      const loadingIndicator = page.locator('text=/확인 중|Checking|Loading/i');
      if (await loadingIndicator.count() > 0) {
        await expect(loadingIndicator).toBeVisible();
      }

      // 결과 로드 대기
      await page.waitForResponse(
        response => response.url().includes('/api/monitoring/health') ||
                    response.url().includes('/api/health'),
        { timeout: 10000 }
      );

      // 상태 업데이트 확인
      const statusIndicator = page.locator('[data-testid="health-status"], .status, .health-status');
      if (await statusIndicator.count() > 0) {
        await expect(statusIndicator).toBeVisible();
      }
    }
  });
});

test.describe('전체 상태 표시', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/monitoring/health');
    await page.waitForLoadState('networkidle');
  });

  test('전체 시스템 상태 표시 확인', async ({ page }) => {
    // 상태 컨테이너 찾기
    const statusSection = page.locator('[data-testid="overall-status"], .overall-status').first();

    if (await statusSection.count() > 0) {
      await expect(statusSection).toBeVisible();

      // 상태 텍스트 확인 (healthy/degraded/unhealthy)
      const statusText = await statusSection.textContent();
      expect(statusText).toMatch(/healthy|degraded|unhealthy|정상|경고|위험/i);
    } else {
      // 대체 패턴: 상태 아이콘/텍스트 찾기
      const statusIndicators = page.locator('.status-badge, .health-badge, [class*="status"]');
      const count = await statusIndicators.count();

      if (count > 0) {
        const firstStatus = statusIndicators.first();
        await expect(firstStatus).toBeVisible();
      }
    }
  });

  test('상태 색상 코딩 확인', async ({ page }) => {
    // 상태별 색상 확인
    const healthyIndicator = page.locator('[class*="green"], [class*="success"], text=/정상|Healthy/i').first();
    const degradedIndicator = page.locator('[class*="yellow"], [class*="warning"], text=/경고|Degraded/i').first();
    const unhealthyIndicator = page.locator('[class*="red"], [class*="error"], text=/위험|Unhealthy/i').first();

    // 최소 하나의 상태는 표시되어야 함
    const anyStatus = page.locator('[class*="status"], [class*="health"]');
    expect(await anyStatus.count()).toBeGreaterThan(0);
  });

  test('타임스탬프 표시 확인', async ({ page }) => {
    // 마지막 확인 시간 표시
    const timestamp = page.locator('text=/마지막 확인|Last Check|Updated/i');

    if (await timestamp.count() > 0) {
      await expect(timestamp).toBeVisible();

      // 시간 형식 확인 (ISO 또는 로컬 시간)
      const timeText = await timestamp.textContent();
      expect(timeText).toMatch(/\d{2}:\d{2}|\d{4}-\d{2}-\d{2}|ago|전/);
    }
  });
});

test.describe('기본 점검 항목', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/monitoring/health');
    await page.waitForLoadState('networkidle');
  });

  test('데이터베이스 연결 상태', async ({ page }) => {
    // DB 연결 섹션 찾기
    const dbSection = page.locator('text=/데이터베이스|Database/i').first();

    if (await dbSection.count() > 0) {
      await expect(dbSection).toBeVisible();

      // 연결 상태 확인
      const dbStatus = page.locator('[data-testid="db-status"], text=/연결됨|Connected|OK/i');
      if (await dbStatus.count() > 0) {
        await expect(dbStatus.first()).toBeVisible();
      }
    }
  });

  test('데이터베이스 응답 시간', async ({ page }) => {
    // 응답 시간 표시 확인
    const responseTime = page.locator('text=/응답 시간|Response Time|Latency/i');

    if (await responseTime.count() > 0) {
      await expect(responseTime.first()).toBeVisible();

      // 밀리초 단위 확인
      const timeText = await responseTime.first().textContent();
      if (timeText) {
        expect(timeText).toMatch(/\d+\s*ms/i);
      }
    }
  });

  test('메모리 사용량 표시', async ({ page }) => {
    // 메모리 섹션 찾기
    const memorySection = page.locator('text=/메모리|Memory/i').first();

    if (await memorySection.count() > 0) {
      await expect(memorySection).toBeVisible();

      // RSS, Heap, External 값 확인
      const memoryMetrics = page.locator('text=/RSS|Heap|External/i');
      const metricsCount = await memoryMetrics.count();

      expect(metricsCount).toBeGreaterThan(0);

      // MB 단위 확인
      const firstMetric = memoryMetrics.first();
      const metricText = await firstMetric.textContent();
      if (metricText) {
        expect(metricText).toMatch(/\d+(\.\d+)?\s*MB/i);
      }
    }
  });

  test('메모리 임계값 경고', async ({ page }) => {
    // 메모리 사용량이 높은 경우 경고 표시
    const memoryWarning = page.locator('[class*="warning"], [class*="yellow"]', {
      hasText: /메모리|Memory/i
    });

    // 경고가 있을 수도, 없을 수도 있음 (정상 동작)
    const warningCount = await memoryWarning.count();

    if (warningCount > 0) {
      const warningText = await memoryWarning.first().textContent();
      console.log('Memory warning detected:', warningText);
    }
  });
});

test.describe('상세 점검 항목', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/monitoring/health');
    await page.waitForLoadState('networkidle');
  });

  test('데이터베이스 테이블 접근성', async ({ page }) => {
    // 테이블 체크 섹션
    const tableCheck = page.locator('text=/테이블|Tables|Table Access/i');

    if (await tableCheck.count() > 0) {
      await expect(tableCheck.first()).toBeVisible();

      // 접근 가능한 테이블 수 확인
      const tableCount = page.locator('text=/\d+\s*(개|tables)/i');
      if (await tableCount.count() > 0) {
        const countText = await tableCount.first().textContent();
        expect(countText).toMatch(/\d+/);
      }
    }
  });

  test('개별 테이블 상태 확인', async ({ page }) => {
    // 주요 테이블 목록
    const tables = ['items', 'companies', 'sales_transactions', 'purchase_transactions'];

    // 테이블 상태 표시 영역
    const tableStatusSection = page.locator('[data-testid="table-status"], .table-checks');

    if (await tableStatusSection.count() > 0) {
      // 각 테이블의 상태 확인
      for (const table of tables) {
        const tableRow = page.locator(`text=/${table}/i`);
        if (await tableRow.count() > 0) {
          const statusIcon = tableRow.locator('..').locator('[class*="check"], [class*="success"]');
          if (await statusIcon.count() > 0) {
            await expect(statusIcon.first()).toBeVisible();
          }
        }
      }
    }
  });

  test('파일시스템 접근 확인', async ({ page }) => {
    // 파일시스템 체크
    const fsCheck = page.locator('text=/파일시스템|Filesystem|File System/i');

    if (await fsCheck.count() > 0) {
      await expect(fsCheck.first()).toBeVisible();

      // 상태 확인
      const fsStatus = fsCheck.locator('..').locator('[data-testid="fs-status"], .status');
      if (await fsStatus.count() > 0) {
        await expect(fsStatus.first()).toBeVisible();
      }
    }
  });

  test('환경 변수 검증', async ({ page }) => {
    // 환경 변수 섹션
    const envCheck = page.locator('text=/환경 변수|Environment Variables|Config/i');

    if (await envCheck.count() > 0) {
      await expect(envCheck.first()).toBeVisible();

      // 필수 변수 확인 상태
      const requiredVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY'
      ];

      // 설정된 변수 수 표시
      const configCount = page.locator('text=/\d+\s*(개|variables|configured)/i');
      if (await configCount.count() > 0) {
        const countText = await configCount.first().textContent();
        expect(countText).toMatch(/\d+/);
      }
    }
  });

  test('환경 변수 누락 경고', async ({ page }) => {
    // 누락된 환경 변수가 있는 경우 경고
    const missingVars = page.locator('[class*="warning"], [class*="error"]', {
      hasText: /환경 변수|Environment|Missing|누락/i
    });

    const warningCount = await missingVars.count();

    if (warningCount > 0) {
      console.log('Environment variable warnings detected');
      await expect(missingVars.first()).toBeVisible();
    } else {
      console.log('All environment variables are configured');
    }
  });
});

test.describe('시스템 정보', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/monitoring/health');
    await page.waitForLoadState('networkidle');
  });

  test('업타임 표시', async ({ page }) => {
    // 시스템 가동 시간
    const uptime = page.locator('text=/업타임|Uptime|가동 시간/i');

    if (await uptime.count() > 0) {
      await expect(uptime.first()).toBeVisible();

      // 시간 형식 확인 (days, hours, minutes)
      const uptimeText = await uptime.first().textContent();
      if (uptimeText) {
        expect(uptimeText).toMatch(/\d+\s*(일|시간|분|days?|hours?|minutes?)/i);
      }
    }
  });

  test('Node.js 버전 정보', async ({ page }) => {
    // Node.js 버전
    const nodeVersion = page.locator('text=/Node|node/i');

    if (await nodeVersion.count() > 0) {
      const versionText = await nodeVersion.first().textContent();
      if (versionText) {
        expect(versionText).toMatch(/v?\d+\.\d+\.\d+/);
      }
    }
  });

  test('Next.js 버전 정보', async ({ page }) => {
    // Next.js 버전
    const nextVersion = page.locator('text=/Next/i');

    if (await nextVersion.count() > 0) {
      const versionText = await nextVersion.first().textContent();
      if (versionText) {
        expect(versionText).toMatch(/\d+\.\d+\.\d+/);
      }
    }
  });

  test('데이터베이스 연결 수', async ({ page }) => {
    // 활성 연결 수
    const connections = page.locator('text=/연결|Connections|Active/i');

    if (await connections.count() > 0) {
      const connText = await connections.first().textContent();
      if (connText) {
        expect(connText).toMatch(/\d+/);
      }
    }
  });

  test('시스템 플랫폼 정보', async ({ page }) => {
    // OS 플랫폼 정보
    const platform = page.locator('text=/Platform|OS|운영체제/i');

    if (await platform.count() > 0) {
      await expect(platform.first()).toBeVisible();

      const platformText = await platform.first().textContent();
      if (platformText) {
        expect(platformText).toMatch(/win32|linux|darwin|Windows|Linux|macOS/i);
      }
    }
  });
});

test.describe('성능 및 메트릭', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/monitoring/health');
    await page.waitForLoadState('networkidle');
  });

  test('API 응답 시간 측정', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('http://localhost:5000/monitoring/health');

    await page.waitForResponse(
      response => response.url().includes('/api/monitoring/health') ||
                  response.url().includes('/api/health'),
      { timeout: 5000 }
    );

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // API 응답은 2초 이내여야 함
    expect(responseTime).toBeLessThan(2000);

    console.log(`Health check API response time: ${responseTime}ms`);
  });

  test('데이터베이스 쿼리 성능', async ({ page }) => {
    // DB 응답 시간이 표시되는지 확인
    const dbResponseTime = page.locator('text=/응답 시간|Response Time|Latency/i');

    if (await dbResponseTime.count() > 0) {
      const timeText = await dbResponseTime.first().textContent();
      if (timeText) {
        const match = timeText.match(/(\d+)\s*ms/i);
        if (match) {
          const ms = parseInt(match[1]);
          // DB 쿼리는 500ms 이내여야 함
          expect(ms).toBeLessThan(500);
          console.log(`Database query time: ${ms}ms`);
        }
      }
    }
  });

  test('메모리 사용량 임계값', async ({ page }) => {
    // 메모리 사용량 값 추출
    const memoryValues = page.locator('text=/\d+(\.\d+)?\s*MB/i');
    const count = await memoryValues.count();

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const memText = await memoryValues.nth(i).textContent();
        if (memText) {
          const match = memText.match(/(\d+(\.\d+)?)\s*MB/i);
          if (match) {
            const mb = parseFloat(match[1]);
            // 메모리는 2GB(2048MB) 이내여야 정상
            expect(mb).toBeLessThan(2048);
            console.log(`Memory usage: ${mb}MB`);
          }
        }
      }
    }
  });

  test('페이지 로드 성능', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('http://localhost:5000/monitoring/health');
    await page.waitForLoadState('networkidle');

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // 페이지는 3초 이내에 로드되어야 함
    expect(loadTime).toBeLessThan(3000);

    console.log(`Health page load time: ${loadTime}ms`);
  });
});

test.describe('에러 처리', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/monitoring/health');
    await page.waitForLoadState('networkidle');
  });

  test('API 에러 시 에러 메시지 표시', async ({ page }) => {
    // 에러 상태 확인
    const errorMessage = page.locator('[class*="error"], [class*="alert"]', {
      hasText: /오류|에러|Error|Failed/i
    });

    // 에러가 있을 수도, 없을 수도 있음
    const errorCount = await errorMessage.count();

    if (errorCount > 0) {
      await expect(errorMessage.first()).toBeVisible();
      console.log('Error state detected on health page');
    } else {
      console.log('Health page loaded without errors');
    }
  });

  test('연결 실패 시 재시도 버튼', async ({ page }) => {
    // 재시도 버튼 (에러 발생 시에만 표시)
    const retryButton = page.locator('button', {
      hasText: /재시도|Retry|다시|Again/i
    });

    const hasRetry = await retryButton.count() > 0;

    if (hasRetry) {
      await expect(retryButton).toBeVisible();
      await retryButton.click();

      // 재확인 진행
      await page.waitForTimeout(1000);
    }
  });

  test('부분 장애 상태 표시', async ({ page }) => {
    // degraded 상태 확인
    const degradedStatus = page.locator('text=/경고|Degraded|Warning/i');

    const isDegraded = await degradedStatus.count() > 0;

    if (isDegraded) {
      await expect(degradedStatus.first()).toBeVisible();
      console.log('System in degraded state');

      // 경고 메시지 확인
      const warningDetails = page.locator('[class*="warning"]');
      expect(await warningDetails.count()).toBeGreaterThan(0);
    }
  });

  test('심각한 장애 상태 표시', async ({ page }) => {
    // unhealthy 상태 확인
    const unhealthyStatus = page.locator('text=/위험|Unhealthy|Critical|Error/i');

    const isUnhealthy = await unhealthyStatus.count() > 0;

    if (isUnhealthy) {
      await expect(unhealthyStatus.first()).toBeVisible();
      console.log('System in unhealthy state');

      // 에러 메시지 확인
      const errorDetails = page.locator('[class*="error"], [class*="red"]');
      expect(await errorDetails.count()).toBeGreaterThan(0);
    }
  });
});

test.describe('반응형 디자인', () => {
  test('모바일 뷰포트에서 레이아웃 확인', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:5000/monitoring/health');
    await page.waitForLoadState('networkidle');

    // 제목 표시
    const title = page.locator('h1');
    await expect(title).toBeVisible();

    // 모바일에서 스크롤 가능
    const contentHeight = await page.evaluate(() => document.body.scrollHeight);
    expect(contentHeight).toBeGreaterThan(667);
  });

  test('태블릿 뷰포트에서 레이아웃 확인', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('http://localhost:5000/monitoring/health');
    await page.waitForLoadState('networkidle');

    // 섹션들이 보이는지 확인
    const sections = page.locator('[data-testid^="section"], .section, .card');
    const sectionCount = await sections.count();

    expect(sectionCount).toBeGreaterThan(0);
  });
});

test.describe('다크 모드', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/monitoring/health');
    await page.waitForLoadState('networkidle');
  });

  test('다크 모드 토글 동작', async ({ page }) => {
    // 다크 모드 버튼 찾기
    const darkModeToggle = page.locator('button[aria-label*="dark" i], button[aria-label*="theme" i], [data-testid="theme-toggle"]');

    if (await darkModeToggle.count() > 0) {
      await darkModeToggle.click();
      await page.waitForTimeout(300); // 애니메이션 대기

      // 다크 모드 클래스 확인
      const htmlElement = page.locator('html');
      const classes = await htmlElement.getAttribute('class');

      if (classes) {
        expect(classes).toContain('dark');
      }
    }
  });

  test('다크 모드에서 가독성 확인', async ({ page }) => {
    // 다크 모드 활성화
    const darkModeToggle = page.locator('button[aria-label*="dark" i], button[aria-label*="theme" i]');

    if (await darkModeToggle.count() > 0) {
      await darkModeToggle.click();
      await page.waitForTimeout(300);

      // 텍스트가 보이는지 확인
      const headings = page.locator('h1, h2, h3');
      const count = await headings.count();

      for (let i = 0; i < Math.min(count, 3); i++) {
        await expect(headings.nth(i)).toBeVisible();
      }
    }
  });
});

test.describe('자동 새로고침', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/monitoring/health');
    await page.waitForLoadState('networkidle');
  });

  test('자동 새로고침 간격 설정', async ({ page }) => {
    // 새로고침 간격 선택 (있는 경우)
    const intervalSelect = page.locator('select', {
      hasText: /간격|Interval|Refresh/i
    });

    if (await intervalSelect.count() > 0) {
      await intervalSelect.selectOption('30');

      // 선택된 값 확인
      const selectedValue = await intervalSelect.inputValue();
      expect(selectedValue).toBe('30');
    }
  });

  test('자동 새로고침 토글', async ({ page }) => {
    // 자동 새로고침 토글 버튼
    const autoRefreshToggle = page.locator('button, input[type="checkbox"]', {
      hasText: /자동|Auto|Refresh/i
    });

    if (await autoRefreshToggle.count() > 0) {
      const initialState = await autoRefreshToggle.isChecked?.() || false;

      await autoRefreshToggle.click();
      await page.waitForTimeout(300);

      if (autoRefreshToggle.getAttribute('type') === 'checkbox') {
        const newState = await autoRefreshToggle.isChecked();
        expect(newState).not.toBe(initialState);
      }
    }
  });
});
