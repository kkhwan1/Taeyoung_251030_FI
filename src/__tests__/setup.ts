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
