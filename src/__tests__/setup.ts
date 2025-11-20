/**
 * Jest Test Setup
 *
 * Global setup and configuration for all test files
 */

// Load environment variables from .env file
import { config } from 'dotenv';
config();

// Set test environment variables
// NODE_ENV is readonly at runtime but can be overridden in test setup
(process.env as { NODE_ENV: string }).NODE_ENV = 'test';
process.env.NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Set longer timeout for integration tests
jest.setTimeout(10000);

// Mock console methods to reduce noise in test output (optional)
// Uncomment if you want to suppress console output during tests
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Add custom matchers or global test utilities here if needed

/**
 * Server Health Check
 * Verifies that the Next.js development server is running before executing tests
 */
async function checkServerHealth(): Promise<boolean> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  try {
    // Try to fetch the home page or any known endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(apiUrl, {
      method: 'HEAD',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    return response.ok || response.status === 404; // 404 is fine, means server is running
  } catch (error) {
    return false;
  }
}

// Global setup: Check server before running tests
beforeAll(async () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const isServerRunning = await checkServerHealth();

  if (!isServerRunning) {
    throw new Error(
      `\n\n` +
      `┌─────────────────────────────────────────────────────────────┐\n` +
      `│ [ERROR] 테스트 서버가 실행되지 않았습니다                   │\n` +
      `├─────────────────────────────────────────────────────────────┤\n` +
      `│                                                             │\n` +
      `│ 다음 명령어로 개발 서버를 먼저 시작하세요:                  │\n` +
      `│                                                             │\n` +
      `│   npm run dev:safe                                          │\n` +
      `│                                                             │\n` +
      `│ 또는:                                                       │\n` +
      `│                                                             │\n` +
      `│   npm run restart                                           │\n` +
      `│                                                             │\n` +
      `│ 서버 주소: ${apiUrl.padEnd(44)}│\n` +
      `│                                                             │\n` +
      `│ 서버가 실행 중인데도 이 메시지가 표시되면:                  │\n` +
      `│ - 포트가 올바른지 확인하세요 (기본: 5000)                   │\n` +
      `│ - 방화벽 설정을 확인하세요                                  │\n` +
      `│ - .env.test 파일의 NEXT_PUBLIC_API_URL을 확인하세요         │\n` +
      `│                                                             │\n` +
      `└─────────────────────────────────────────────────────────────┘\n`
    );
  }

  console.log(`[INFO] 서버 연결 확인: ${apiUrl}`);
});
