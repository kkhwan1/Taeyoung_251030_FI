#!/usr/bin/env node

/**
 * Next.js 개발 서버 프로세스만 안전하게 종료
 * Claude Code 세션은 보호됨
 */

const { execSync } = require('child_process');

console.log('🔍 Next.js 프로세스를 찾는 중...\n');

try {
  // Windows에서 'next dev'를 실행 중인 프로세스 찾기
  const command = 'wmic process where "commandline like \'%next dev%\'" get processid,commandline /format:list';

  let output;
  try {
    output = execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) {
    // wmic 명령 실패 시 (프로세스가 없을 수 있음)
    console.log('✅ 실행 중인 Next.js 프로세스가 없습니다.');
    process.exit(0);
  }

  // CommandLine과 ProcessId 파싱
  const lines = output.split('\n').filter(line => line.trim());
  const processes = [];

  let currentProcess = {};
  for (const line of lines) {
    if (line.startsWith('CommandLine=')) {
      currentProcess.commandLine = line.substring('CommandLine='.length).trim();
    } else if (line.startsWith('ProcessId=')) {
      const pid = line.substring('ProcessId='.length).trim();
      if (pid && currentProcess.commandLine) {
        currentProcess.pid = pid;
        processes.push({ ...currentProcess });
        currentProcess = {};
      }
    }
  }

  // Claude Code 프로세스 필터링
  const nextJsProcesses = processes.filter(proc => {
    const cmdLine = proc.commandLine.toLowerCase();

    // Claude Code 관련 프로세스는 제외
    if (cmdLine.includes('claude') ||
        cmdLine.includes('claudecode') ||
        cmdLine.includes('@anthropic')) {
      console.log(`⚠️  Claude Code 프로세스 감지 - 보호됨 (PID: ${proc.pid})`);
      return false;
    }

    // Next.js 개발 서버 프로세스만 선택
    return cmdLine.includes('next dev');
  });

  if (nextJsProcesses.length === 0) {
    console.log('✅ 종료할 Next.js 프로세스가 없습니다.\n');
    process.exit(0);
  }

  console.log(`🎯 발견된 Next.js 프로세스: ${nextJsProcesses.length}개\n`);

  // 프로세스 종료
  let killedCount = 0;
  for (const proc of nextJsProcesses) {
    try {
      console.log(`   종료 중: PID ${proc.pid}`);
      execSync(`taskkill /F /PID ${proc.pid}`, { stdio: 'ignore' });
      killedCount++;
    } catch (error) {
      console.log(`   ⚠️  PID ${proc.pid} 종료 실패 (이미 종료되었을 수 있음)`);
    }
  }

  console.log(`\n✅ ${killedCount}개의 Next.js 프로세스를 종료했습니다.`);
  console.log('✅ Claude Code 세션은 안전하게 유지되었습니다.\n');

} catch (error) {
  console.error('❌ 오류 발생:', error.message);
  process.exit(1);
}
