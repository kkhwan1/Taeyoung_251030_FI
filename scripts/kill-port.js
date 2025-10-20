#!/usr/bin/env node

/**
 * 특정 포트를 사용하는 프로세스 종료
 * Claude Code 세션은 보호됨
 */

const { execSync } = require('child_process');

const port = process.argv[2] || 5000;

console.log(`🔍 포트 ${port}을(를) 사용하는 프로세스를 찾는 중...\n`);

try {
  // netstat으로 포트 사용 프로세스 찾기
  let output;
  try {
    output = execSync(`netstat -ano | findstr ":${port}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) {
    console.log(`✅ 포트 ${port}을(를) 사용하는 프로세스가 없습니다.\n`);
    process.exit(0);
  }

  // PID 추출
  const lines = output.split('\n').filter(line => line.trim());
  const pids = new Set();

  for (const line of lines) {
    // 맨 마지막 숫자가 PID
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];

    if (pid && /^\d+$/.test(pid)) {
      pids.add(pid);
    }
  }

  if (pids.size === 0) {
    console.log(`✅ 포트 ${port}을(를) 사용하는 프로세스가 없습니다.\n`);
    process.exit(0);
  }

  console.log(`🎯 발견된 프로세스: ${pids.size}개\n`);

  // 각 PID의 명령줄 확인 및 종료
  let killedCount = 0;
  for (const pid of pids) {
    try {
      // 프로세스의 명령줄 확인
      let cmdLine = '';
      try {
        cmdLine = execSync(`wmic process where processid=${pid} get commandline /format:list`, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
      } catch (err) {
        // 프로세스가 이미 종료되었을 수 있음
        continue;
      }

      const cmdLineLower = cmdLine.toLowerCase();

      // Claude Code 관련 프로세스는 보호
      if (cmdLineLower.includes('claude') ||
          cmdLineLower.includes('claudecode') ||
          cmdLineLower.includes('@anthropic')) {
        console.log(`   ⚠️  Claude Code 프로세스 감지 - 보호됨 (PID: ${pid})`);
        continue;
      }

      // 프로세스 종료
      console.log(`   종료 중: PID ${pid}`);
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
      killedCount++;

    } catch (error) {
      console.log(`   ⚠️  PID ${pid} 종료 실패 (이미 종료되었을 수 있음)`);
    }
  }

  if (killedCount === 0) {
    console.log(`\n⚠️  포트 ${port}의 모든 프로세스가 보호되었거나 이미 종료되었습니다.\n`);
  } else {
    console.log(`\n✅ ${killedCount}개의 프로세스를 종료했습니다.`);
    console.log(`✅ 포트 ${port}이(가) 해제되었습니다.`);
    console.log('✅ Claude Code 세션은 안전하게 유지되었습니다.\n');
  }

} catch (error) {
  console.error('❌ 오류 발생:', error.message);
  process.exit(1);
}
