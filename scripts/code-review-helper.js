#!/usr/bin/env node

/**
 * 코드 리뷰 도우미 스크립트
 * 
 * 이 스크립트는 ERP 시스템의 전체 소스 코드를 하나의 파일로 통합하여
 * 코드 리뷰를 용이하게 합니다.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');

function collectSourceFiles(dir, extensions = ['.ts', '.tsx', '.js', '.jsx'], accumulator = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (['node_modules', '.next', 'logs', 'dist', 'coverage', 'build'].includes(entry.name)) continue;
    
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, extensions, accumulator);
    } else if (extensions.includes(path.extname(entry.name))) {
      accumulator.push(fullPath);
    }
  }
  
  return accumulator;
}

function getFileStats(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    return {
      size: content.length,
      lines: lines.length,
      nonEmptyLines: lines.filter(line => line.trim().length > 0).length,
      imports: (content.match(/^import\s+/gm) || []).length,
      exports: (content.match(/^export\s+/gm) || []).length,
      functions: (content.match(/function\s+\w+|const\s+\w+\s*=\s*\(/gm) || []).length,
      classes: (content.match(/class\s+\w+/gm) || []).length,
      comments: (content.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm) || []).length
    };
  } catch (error) {
    return {
      size: 0,
      lines: 0,
      nonEmptyLines: 0,
      imports: 0,
      exports: 0,
      functions: 0,
      classes: 0,
      comments: 0,
      error: error.message
    };
  }
}

function categorizeFiles(files) {
  const categories = {
    api: [],
    components: [],
    lib: [],
    types: [],
    hooks: [],
    utils: [],
    pages: [],
    middleware: [],
    config: [],
    others: []
  };
  
  files.forEach(file => {
    const relativePath = path.relative(path.join(repoRoot, 'src'), file);
    const pathParts = relativePath.split(path.sep);
    
    if (relativePath.startsWith('app/api')) {
      categories.api.push(file);
    } else if (relativePath.startsWith('components')) {
      categories.components.push(file);
    } else if (relativePath.startsWith('lib')) {
      categories.lib.push(file);
    } else if (relativePath.startsWith('types')) {
      categories.types.push(file);
    } else if (relativePath.startsWith('hooks')) {
      categories.hooks.push(file);
    } else if (relativePath.startsWith('utils')) {
      categories.utils.push(file);
    } else if (relativePath.startsWith('app') && pathParts.length > 1 && pathParts[1] !== 'api') {
      categories.pages.push(file);
    } else if (relativePath.startsWith('middleware')) {
      categories.middleware.push(file);
    } else if (relativePath.startsWith('config')) {
      categories.config.push(file);
    } else {
      categories.others.push(file);
    }
  });
  
  return categories;
}

function generateSummaryReport(categories) {
  let summary = `# ERP 시스템 코드 리뷰 보고서\n\n`;
  summary += `생성일시: ${new Date().toLocaleString('ko-KR')}\n`;
  summary += `프로젝트: ERP_TEST\n\n`;
  
  // 전체 통계
  const allFiles = Object.values(categories).flat();
  summary += `## 📊 전체 통계\n\n`;
  summary += `- **총 파일 수**: ${allFiles.length}개\n`;
  
  // 카테고리별 통계
  summary += `### 카테고리별 파일 분포\n\n`;
  Object.entries(categories).forEach(([category, files]) => {
    if (files.length > 0) {
      summary += `- **${category}**: ${files.length}개 파일\n`;
    }
  });
  
  summary += `\n## 📁 파일 구조 분석\n\n`;
  
  // 각 카테고리별 상세 분석
  Object.entries(categories).forEach(([category, files]) => {
    if (files.length === 0) return;
    
    summary += `### ${category.toUpperCase()} (${files.length}개 파일)\n\n`;
    
    let totalStats = {
      size: 0,
      lines: 0,
      nonEmptyLines: 0,
      imports: 0,
      exports: 0,
      functions: 0,
      classes: 0,
      comments: 0
    };
    
    files.forEach(file => {
      const relativePath = path.relative(repoRoot, file);
      const stats = getFileStats(file);
      
      if (!stats.error) {
        totalStats.size += stats.size;
        totalStats.lines += stats.lines;
        totalStats.nonEmptyLines += stats.nonEmptyLines;
        totalStats.imports += stats.imports;
        totalStats.exports += stats.exports;
        totalStats.functions += stats.functions;
        totalStats.classes += stats.classes;
        totalStats.comments += stats.comments;
      }
      
      summary += `- \`${relativePath}\`\n`;
      if (stats.error) {
        summary += `  - ❌ 오류: ${stats.error}\n`;
      } else {
        summary += `  - 📏 크기: ${stats.size} 문자, ${stats.lines} 라인\n`;
        summary += `  - 📝 함수: ${stats.functions}개, 클래스: ${stats.classes}개\n`;
        summary += `  - 📦 import: ${stats.imports}개, export: ${stats.exports}개\n`;
      }
    });
    
    summary += `\n**${category} 전체 통계**:\n`;
    summary += `- 총 코드 크기: ${totalStats.size.toLocaleString()} 문자\n`;
    summary += `- 총 라인 수: ${totalStats.lines.toLocaleString()} 라인\n`;
    summary += `- 총 함수 수: ${totalStats.functions}개\n`;
    summary += `- 총 클래스 수: ${totalStats.classes}개\n\n`;
  });
  
  return summary;
}

function generateDetailedCodeReport(categories) {
  let report = generateSummaryReport(categories);
  
  report += `## 📄 상세 코드 내용\n\n`;
  report += `> 이 섹션에는 모든 소스 파일의 실제 코드 내용이 포함됩니다.\n\n`;
  
  // 카테고리별로 코드 내용 추가
  Object.entries(categories).forEach(([category, files]) => {
    if (files.length === 0) return;
    
    report += `\n---\n\n### ${category.toUpperCase()} 코드\n\n`;
    
    files.forEach(file => {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const relativePath = path.relative(repoRoot, file);
        
        report += `\n#### 📄 ${relativePath}\n\n`;
        report += `\`\`\`typescript\n`;
        report += content;
        report += `\n\`\`\`\n\n`;
      } catch (error) {
        report += `\n#### ❌ ${path.relative(repoRoot, file)}\n\n`;
        report += `**오류**: 파일을 읽을 수 없습니다 - ${error.message}\n\n`;
      }
    });
  });
  
  return report;
}

function runLintingAndTypeCheck() {
  console.log('\n🔍 코드 품질 검사 실행 중...\n');
  
  const commands = [
    { name: 'ESLint 검사', cmd: 'npm', args: ['run', 'lint'] },
    { name: 'TypeScript 타입 검사', cmd: 'npm', args: ['run', 'type-check'] }
  ];
  
  const results = [];
  
  for (const { name, cmd, args } of commands) {
    console.log(`실행 중: ${name}...`);
    const result = spawnSync(cmd, args, {
      cwd: repoRoot,
      stdio: 'pipe',
      shell: process.platform === 'win32',
    });
    
    results.push({
      name,
      success: result.status === 0,
      output: result.stdout?.toString() || result.stderr?.toString() || ''
    });
    
    if (result.status === 0) {
      console.log(`✅ ${name} 완료`);
    } else {
      console.log(`❌ ${name} 실패`);
    }
  }
  
  return results;
}

function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'full';
  
  console.log('🚀 ERP 시스템 코드 리뷰 도우미 시작...\n');
  
  // 소스 파일 수집
  console.log('📁 소스 파일 수집 중...');
  const srcFiles = collectSourceFiles(path.join(repoRoot, 'src'));
  console.log(`✅ ${srcFiles.length}개 파일 발견\n`);
  
  // 파일 카테고리 분류
  console.log('📊 파일 카테고리 분류 중...');
  const categories = categorizeFiles(srcFiles);
  console.log('✅ 파일 분류 완료\n');
  
  // 보고서 생성
  console.log('📝 보고서 생성 중...');
  const report = generateDetailedCodeReport(categories);
  
  // 출력 파일 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = path.join(repoRoot, `CODE_REVIEW_REPORT_${timestamp}.txt`);
  
  fs.writeFileSync(outputPath, report, 'utf8');
  console.log(`✅ 보고서 저장 완료: ${outputPath}\n`);
  
  // 요약 통계 출력
  const allFiles = Object.values(categories).flat();
  console.log('📊 요약 통계:');
  console.log(`- 총 파일 수: ${allFiles.length}개`);
  Object.entries(categories).forEach(([category, files]) => {
    if (files.length > 0) {
      console.log(`- ${category}: ${files.length}개`);
    }
  });
  
  // 코드 품질 검사 실행
  if (mode === 'full') {
    const qualityResults = runLintingAndTypeCheck();
    
    // 품질 검사 결과를 보고서에 추가
    let qualityReport = '\n\n## 🔍 코드 품질 검사 결과\n\n';
    qualityResults.forEach(result => {
      qualityReport += `### ${result.name}\n\n`;
      if (result.success) {
        qualityReport += `✅ **성공**\n\n`;
      } else {
        qualityReport += `❌ **실패**\n\n`;
      }
      if (result.output) {
        qualityReport += `\`\`\`\n${result.output}\n\`\`\`\n\n`;
      }
    });
    
    fs.appendFileSync(outputPath, qualityReport, 'utf8');
  }
  
  console.log('\n🎉 코드 리뷰 보고서 생성 완료!');
  console.log(`📄 파일 위치: ${outputPath}`);
  console.log('\n💡 팁: 생성된 보고서를 사용하여 다음과 같은 사항들을 확인할 수 있습니다:');
  console.log('   - 코드 구조 및 아키텍처');
  console.log('   - 일관된 코딩 스타일');
  console.log('   - 보안 취약점');
  console.log('   - 성능 최적화 기회');
  console.log('   - 코드 중복 및 리팩토링 필요 사항');
}

if (require.main === module) {
  main();
}

module.exports = {
  collectSourceFiles,
  categorizeFiles,
  generateDetailedCodeReport,
  runLintingAndTypeCheck
};



