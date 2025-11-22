import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 테스트 설정
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // 테스트 디렉토리
  testDir: './tests/e2e',

  // 병렬 실행 설정
  fullyParallel: true,

  // CI에서 재시도 금지
  forbidOnly: !!process.env.CI,

  // 실패 시 재시도 횟수
  retries: process.env.CI ? 2 : 0,

  // 병렬 워커 수
  workers: process.env.CI ? 1 : undefined,

  // 리포터 설정
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],

  // 공통 설정
  use: {
    // 기본 URL
    baseURL: 'http://localhost:5000',

    // 추적 설정 (실패 시에만)
    trace: 'on-first-retry',

    // 스크린샷 설정
    screenshot: 'only-on-failure',

    // 비디오 설정
    video: 'on-first-retry',

    // 타임아웃
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  // 프로젝트 설정 (브라우저별)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // 개발 서버 설정 (테스트 전 자동 시작)
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
