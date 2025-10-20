const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧹 백그라운드 서버 정리 시작\n');
console.log('==================================================\n');

// 프로젝트 루트 디렉토리
const projectRoot = path.resolve(__dirname, '..');

// Claude Code 세션의 node 프로세스 ID 가져오기
function getClaudeCodePIDs() {
  try {
    const currentPID = process.pid;
    const parentCommand = execSync(`wmic process where "ProcessId=${currentPID}" get ParentProcessId /format:list`, {
      encoding: 'utf-8',
      windowsHide: true
    }).trim();

    const parentMatch = parentCommand.match(/ParentProcessId=(\d+)/);
    if (parentMatch) {
      const parentPID = parentMatch[1];
      console.log(`ℹ️  현재 프로세스 PID: ${currentPID}`);
      console.log(`ℹ️  부모 프로세스 PID: ${parentPID}`);
      return [currentPID, parentPID];
    }
  } catch (error) {
    console.log('⚠️  Claude Code PID 확인 실패, 안전 모드로 진행');
  }
  return [process.pid];
}

// 포트 5000을 사용하는 프로세스 찾기
function getPortProcesses() {
  try {
    const output = execSync('netstat -ano | findstr :5000', {
      encoding: 'utf-8',
      windowsHide: true
    });

    const pids = new Set();
    const lines = output.split('\n');

    lines.forEach(line => {
      const match = line.match(/LISTENING\s+(\d+)/);
      if (match) {
        pids.add(match[1]);
      }
    });

    return Array.from(pids);
  } catch (error) {
    return [];
  }
}

// Next.js 프로세스 찾기
function getNextJSProcesses() {
  try {
    const output = execSync(
      'wmic process where "Name=\'node.exe\' AND CommandLine LIKE \'%next%\'" get ProcessId,CommandLine /format:list',
      { encoding: 'utf-8', windowsHide: true }
    );

    const processes = [];
    const blocks = output.split('\n\n').filter(block => block.trim());

    blocks.forEach(block => {
      const pidMatch = block.match(/ProcessId=(\d+)/);
      const cmdMatch = block.match(/CommandLine=(.*)/);

      if (pidMatch && cmdMatch) {
        processes.push({
          pid: pidMatch[1],
          command: cmdMatch[1].trim()
        });
      }
    });

    return processes;
  } catch (error) {
    return [];
  }
}

// 프로세스가 Claude Code 세션인지 확인
function isClaudeCodeProcess(pid, claudePIDs) {
  return claudePIDs.includes(parseInt(pid));
}

// 프로세스 종료
function killProcess(pid, force = false) {
  try {
    const flag = force ? '/F' : '/T';
    execSync(`taskkill ${flag} /PID ${pid}`, {
      encoding: 'utf-8',
      windowsHide: true
    });
    return true;
  } catch (error) {
    return false;
  }
}

// 메인 실행
async function main() {
  const claudePIDs = getClaudeCodePIDs();

  console.log('\n📋 1단계: 포트 5000 사용 프로세스 확인...\n');
  const portPIDs = getPortProcesses();

  if (portPIDs.length === 0) {
    console.log('✅ 포트 5000을 사용하는 프로세스 없음\n');
  } else {
    console.log(`🎯 발견된 프로세스: ${portPIDs.length}개\n`);
    portPIDs.forEach(pid => {
      const isProtected = isClaudeCodeProcess(pid, claudePIDs);
      console.log(`   PID ${pid} ${isProtected ? '(보호됨 - Claude Code)' : '(정리 대상)'}`);
    });
    console.log('');
  }

  console.log('\n📋 2단계: Next.js 프로세스 확인...\n');
  const nextProcesses = getNextJSProcesses();

  if (nextProcesses.length === 0) {
    console.log('✅ Next.js 프로세스 없음\n');
  } else {
    console.log(`🎯 발견된 Next.js 프로세스: ${nextProcesses.length}개\n`);
    nextProcesses.forEach(proc => {
      const isProtected = isClaudeCodeProcess(proc.pid, claudePIDs);
      const commandPreview = proc.command.length > 80
        ? proc.command.substring(0, 77) + '...'
        : proc.command;
      console.log(`   PID ${proc.pid} ${isProtected ? '(보호됨)' : '(정리 대상)'}`);
      console.log(`      명령어: ${commandPreview}\n`);
    });
  }

  console.log('\n📋 3단계: 프로세스 정리 시작...\n');

  let killedCount = 0;
  let protectedCount = 0;
  let failedCount = 0;

  // 포트 5000 프로세스 정리
  for (const pid of portPIDs) {
    if (isClaudeCodeProcess(pid, claudePIDs)) {
      console.log(`   ℹ️  PID ${pid} - Claude Code 세션 (보호됨)`);
      protectedCount++;
      continue;
    }

    console.log(`   🔄 PID ${pid} 종료 시도...`);
    const success = killProcess(pid, true);

    if (success) {
      console.log(`   ✅ PID ${pid} 종료 성공`);
      killedCount++;
    } else {
      console.log(`   ⚠️  PID ${pid} 종료 실패 (이미 종료되었을 수 있음)`);
      failedCount++;
    }
  }

  // Next.js 프로세스 정리 (포트 프로세스에 포함되지 않은 것만)
  for (const proc of nextProcesses) {
    if (portPIDs.includes(proc.pid)) {
      continue; // 이미 처리됨
    }

    if (isClaudeCodeProcess(proc.pid, claudePIDs)) {
      console.log(`   ℹ️  PID ${proc.pid} - Claude Code 세션 (보호됨)`);
      protectedCount++;
      continue;
    }

    console.log(`   🔄 PID ${proc.pid} 종료 시도...`);
    const success = killProcess(proc.pid, false);

    if (success) {
      console.log(`   ✅ PID ${proc.pid} 종료 성공`);
      killedCount++;
    } else {
      console.log(`   ⚠️  PID ${proc.pid} 종료 실패`);
      failedCount++;
    }
  }

  console.log('\n==================================================\n');
  console.log('✨ 정리 완료!\n');
  console.log(`📊 결과 요약:`);
  console.log(`   - 종료된 프로세스: ${killedCount}개`);
  console.log(`   - 보호된 프로세스: ${protectedCount}개`);
  console.log(`   - 실패/이미 종료: ${failedCount}개`);
  console.log('\n==================================================\n');

  // 잠시 대기 (프로세스가 완전히 종료될 시간)
  console.log('⏳ 프로세스 종료 완료 대기 (2초)...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 최종 확인
  console.log('📋 최종 확인: 포트 5000 상태\n');
  const finalPortPIDs = getPortProcesses();

  if (finalPortPIDs.length === 0) {
    console.log('✅ 포트 5000 사용 가능\n');
  } else {
    console.log(`⚠️  여전히 ${finalPortPIDs.length}개 프로세스가 포트 5000 사용 중`);
    finalPortPIDs.forEach(pid => {
      const isProtected = isClaudeCodeProcess(pid, claudePIDs);
      console.log(`   PID ${pid} ${isProtected ? '(Claude Code 세션)' : ''}`);
    });
    console.log('');
  }

  console.log('==================================================\n');
}

main().catch(error => {
  console.error('❌ 오류 발생:', error.message);
  process.exit(1);
});
