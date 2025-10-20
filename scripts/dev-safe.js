#!/usr/bin/env node

/**
 * Windows 최적화 Next.js 개발 서버 시작
 * - 기존 Next.js 프로세스 정리
 * - .next 디렉토리 정리
 * - 안전한 개발 서버 시작
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');

console.log('🚀 Windows 최적화 개발 서버 시작\n');
console.log('=' .repeat(50));

// 1단계: 기존 Next.js 프로세스 정리
console.log('\n📋 1단계: 기존 Next.js 프로세스 정리 중...');
try {
  execSync('node scripts/kill-nextjs-only.js', {
    cwd: projectRoot,
    stdio: 'inherit'
  });
} catch (error) {
  console.log('⚠️  프로세스 정리 중 오류 발생 (무시하고 계속 진행)');
}

// 2단계: .next 디렉토리 정리
console.log('\n📋 2단계: .next 디렉토리 정리 중...');
const nextDir = path.join(projectRoot, '.next');
if (fs.existsSync(nextDir)) {
  try {
    // Windows에서는 rmdir /s /q 사용
    execSync(`rmdir /s /q "${nextDir}"`, { stdio: 'inherit' });
    console.log('✅ .next 디렉토리 정리 완료');
  } catch (error) {
    console.log('⚠️  .next 디렉토리 정리 실패 (무시하고 계속 진행)');
  }
} else {
  console.log('✅ .next 디렉토리 없음 (스킵)');
}

// 3단계: 파일 시스템 동기화 대기
console.log('\n📋 3단계: 파일 시스템 동기화 대기 (3초)...');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
wait(3000).then(() => {
  console.log('✅ 대기 완료');

  // 4단계: 백그라운드 프로세스 확인 및 정리
  console.log('\n📋 4단계: 백그라운드 프로세스 확인 및 정리 중...');
  try {
    // 포트 5000을 사용하는 프로세스 확인
    let portProcesses = [];
    try {
      const netstatOutput = execSync('netstat -ano | findstr :5000', {
        encoding: 'utf-8',
        windowsHide: true
      });

      const lines = netstatOutput.split('\n');
      const pids = new Set();
      lines.forEach(line => {
        const match = line.match(/LISTENING\s+(\d+)/);
        if (match) pids.add(match[1]);
      });
      portProcesses = Array.from(pids);
    } catch (error) {
      // 포트 사용 프로세스 없음 (정상)
    }

    if (portProcesses.length > 0) {
      console.log(`   ⚠️  포트 5000을 사용하는 프로세스 발견: ${portProcesses.length}개`);

      // Claude Code 세션 보호를 위한 현재 프로세스 확인
      const currentPID = process.pid.toString();
      let parentPID = null;
      try {
        const parentCommand = execSync(`wmic process where "ProcessId=${currentPID}" get ParentProcessId /format:list`, {
          encoding: 'utf-8',
          windowsHide: true
        }).trim();
        const parentMatch = parentCommand.match(/ParentProcessId=(\d+)/);
        if (parentMatch) parentPID = parentMatch[1];
      } catch (error) {
        // 부모 프로세스 확인 실패
      }

      // 포트 프로세스 정리 (Claude Code 세션 보호)
      let cleanedCount = 0;
      for (const pid of portProcesses) {
        // 현재 프로세스나 부모 프로세스는 건드리지 않음
        if (pid === currentPID || pid === parentPID) {
          console.log(`   ℹ️  PID ${pid} - Claude Code 세션 (보호됨)`);
          continue;
        }

        try {
          execSync(`taskkill /F /PID ${pid}`, {
            encoding: 'utf-8',
            windowsHide: true
          });
          console.log(`   ✅ PID ${pid} 정리 완료`);
          cleanedCount++;
        } catch (error) {
          console.log(`   ⚠️  PID ${pid} 정리 실패 (이미 종료되었을 수 있음)`);
        }
      }

      if (cleanedCount > 0) {
        console.log(`   📊 총 ${cleanedCount}개 프로세스 정리됨`);
        // 프로세스 종료 완료 대기 (2초)
        const cleanupWait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        return cleanupWait(2000).then(() => {
          console.log('✅ 백그라운드 프로세스 정리 완료');
          startServer();
        });
      }
    } else {
      console.log('✅ 백그라운드 프로세스 확인 완료 (정리할 항목 없음)');
    }
  } catch (error) {
    console.log('⚠️  백그라운드 프로세스 확인 중 오류 (무시하고 계속 진행)');
  }

  // 5단계로 진행
  startServer();
});

// 5단계: 개발 서버 시작 함수
function startServer() {
  console.log('\n📋 5단계: Next.js 개발 서버 시작 중...');
  console.log('=' .repeat(50));
  console.log('\n🌐 서버 주소: http://localhost:5000');
  console.log('🌐 네트워크: http://0.0.0.0:5000');
  console.log('\n✨ 개발 서버가 시작되었습니다!\n');
  console.log('=' .repeat(50) + '\n');

  // Next.js 개발 서버 실행 (node로 직접 실행)
  const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
  const devProcess = spawn('node', [nextBin, 'dev', '-p', '5000', '-H', '0.0.0.0'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false
  });

  // 에러 핸들링
  devProcess.on('error', (error) => {
    console.error('\n❌ 개발 서버 시작 실패:', error.message);
    process.exit(1);
  });

  // 종료 시그널 처리
  process.on('SIGINT', () => {
    console.log('\n\n👋 개발 서버를 종료합니다...');
    devProcess.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\n👋 개발 서버를 종료합니다...');
    devProcess.kill('SIGTERM');
    process.exit(0);
  });

  // 프로세스 종료 처리
  devProcess.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`\n⚠️  개발 서버가 코드 ${code}로 종료되었습니다.`);
    }
    process.exit(code || 0);
  });
}
