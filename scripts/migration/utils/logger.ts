/**
 * Migration Logger Utility
 *
 * Provides consistent logging with color-coded messages and progress tracking
 */

import { performance } from 'perf_hooks';

export class MigrationLogger {
  private startTime: number = 0;
  private phaseStartTime: number = 0;
  private currentPhase: string = '';

  constructor(private scriptName: string) {}

  /**
   * Start timing the entire migration
   */
  startMigration(): void {
    this.startTime = performance.now();
    this.log('\n' + '='.repeat(80));
    this.log(`🚀 ${this.scriptName} 시작`, 'info');
    this.log('='.repeat(80) + '\n');
  }

  /**
   * Start timing a specific phase
   */
  startPhase(phaseName: string): void {
    this.currentPhase = phaseName;
    this.phaseStartTime = performance.now();
    this.log(`\n📌 Phase: ${phaseName}`, 'phase');
  }

  /**
   * End current phase with timing
   */
  endPhase(): void {
    const elapsed = performance.now() - this.phaseStartTime;
    this.log(`✅ ${this.currentPhase} 완료 (${this.formatTime(elapsed)})`, 'success');
    this.currentPhase = '';
  }

  /**
   * End migration with total timing
   */
  endMigration(success: boolean = true): void {
    const elapsed = performance.now() - this.startTime;
    this.log('\n' + '='.repeat(80));
    if (success) {
      this.log(`✅ ${this.scriptName} 성공 (총 소요시간: ${this.formatTime(elapsed)})`, 'success');
    } else {
      this.log(`❌ ${this.scriptName} 실패 (소요시간: ${this.formatTime(elapsed)})`, 'error');
    }
    this.log('='.repeat(80) + '\n');
  }

  /**
   * Log with different severity levels
   */
  log(message: string, level: 'info' | 'success' | 'warn' | 'error' | 'phase' | 'progress' = 'info'): void {
    const timestamp = new Date().toLocaleTimeString('ko-KR');

    switch (level) {
      case 'success':
        console.log(`[${timestamp}] ✅ ${message}`);
        break;
      case 'error':
        console.error(`[${timestamp}] ❌ ${message}`);
        break;
      case 'warn':
        console.warn(`[${timestamp}] ⚠️  ${message}`);
        break;
      case 'phase':
        console.log(`[${timestamp}] 🔷 ${message}`);
        break;
      case 'progress':
        console.log(`[${timestamp}] ⏳ ${message}`);
        break;
      default:
        console.log(`[${timestamp}] ℹ️  ${message}`);
    }
  }

  /**
   * Log progress with percentage
   */
  progress(current: number, total: number, item: string = ''): void {
    const percent = Math.round((current / total) * 100);
    const message = item
      ? `진행 중: ${current}/${total} (${percent}%) - ${item}`
      : `진행 중: ${current}/${total} (${percent}%)`;
    this.log(message, 'progress');
  }

  /**
   * Log table with counts
   */
  table(data: Record<string, number | string>): void {
    console.table(data);
  }

  /**
   * Format milliseconds to human-readable time
   */
  private formatTime(ms: number): string {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}초`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.round((ms % 60000) / 1000);
      return `${minutes}분 ${seconds}초`;
    }
  }

  /**
   * Create a section divider
   */
  divider(char: string = '-'): void {
    console.log(char.repeat(80));
  }
}

/**
 * Create logger instance with script name
 */
export function createLogger(scriptName: string): MigrationLogger {
  return new MigrationLogger(scriptName);
}
