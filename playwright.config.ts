import { defineConfig, devices } from '@playwright/test';

/**
 * 태창 ERP 시스템 Playwright E2E 테스트 설정
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',

  /* 병렬 실행 설정 */
  fullyParallel: true,
  workers: 5, // 5개 에이전트 동시 실행

  /* 실패 시 재시도 */
  retries: process.env.CI ? 2 : 1,

  /* 타임아웃 설정 */
  timeout: 60 * 1000, // 각 테스트 60초
  expect: {
    timeout: 10 * 1000, // 각 assertion 10초
  },

  /* 리포터 설정 */
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
  ],

  /* 공통 테스트 설정 */
  use: {
    /* 기본 URL */
    baseURL: 'http://localhost:5000',

    /* 스크린샷 및 비디오 */
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    /* 한글 지원 */
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',

    /* 네비게이션 타임아웃 */
    navigationTimeout: 30 * 1000,
    actionTimeout: 10 * 1000,
  },

  /* 브라우저 설정 */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },

    /* 모바일 반응형 테스트 */
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
    },
  ],

  /* 개발 서버 설정 */
  webServer: {
    command: 'npm run dev:safe',
    url: 'http://localhost:5000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
