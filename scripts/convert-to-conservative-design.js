/**
 * 전체 코드베이스를 보수적 디자인(금융권 스타일)으로 변환하는 스크립트
 * 모든 컬러 클래스를 grayscale로 일괄 변경
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 제외할 디렉토리
const EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'test-results',
  'playwright-report'
];

// 변경 패턴 정의
const colorReplacements = {
  // 배경색
  'bg-red-': 'bg-gray-',
  'bg-blue-': 'bg-gray-',
  'bg-green-': 'bg-gray-',
  'bg-yellow-': 'bg-gray-',
  'bg-purple-': 'bg-gray-',
  'bg-orange-': 'bg-gray-',
  'bg-pink-': 'bg-gray-',
  'bg-indigo-': 'bg-gray-',
  'bg-cyan-': 'bg-gray-',
  'bg-teal-': 'bg-gray-',
  'bg-emerald-': 'bg-gray-',
  
  // 텍스트
  'text-red-': 'text-gray-',
  'text-blue-': 'text-gray-',
  'text-green-': 'text-gray-',
  'text-yellow-': 'text-gray-',
  'text-purple-': 'text-gray-',
  'text-orange-': 'text-gray-',
  'text-pink-': 'text-gray-',
  
  // 테두리
  'border-red-': 'border-gray-',
  'border-blue-': 'border-gray-',
  'border-green-': 'border-gray-',
  'border-yellow-': 'border-gray-',
  'border-purple-': 'border-gray-',
  'border-orange-': 'border-gray-',
  
  // HEX 컬러 값
  '#10B981': '#525252', // Green → Gray-600
  '#059669': '#525252', // Green → Gray-600
  '#34D399': '#525252', // Green → Gray-600
  '#EF4444': '#262626', // Red → Gray-800
  '#DC2626': '#262626', // Red → Gray-800
  '#F59E0B': '#525252', // Amber → Gray-600
  '#D97706': '#525252', // Amber → Gray-600
  '#3B82F6': '#525252', // Blue → Gray-600
  '#2563EB': '#525252', // Blue → Gray-600
  '#8B5CF6': '#525252', // Purple → Gray-600
  '#F87171': '#525252', // Red → Gray-600
  '#FBBF24': '#525252', // Yellow → Gray-600
};

// Gradient 패턴
const gradientReplacements = [
  {
    pattern: /bg-gradient-to-[rlbt]\s+from-\w+-\d+\s+to-\w+-\d+/g,
    replacement: 'bg-gray-600'
  },
  {
    pattern: /bg-gradient-to-[rlbt]\s+from-\w+-\d+\s+via-\w+-\d+\s+to-\w+-\d+/g,
    replacement: 'bg-gray-600'
  }
];

// 이모티콘 제거 (문서 파일 제외)
// const emojiPattern = /[😀-🙏🌀-🗿✀-➿⚠-🟿]/g;

// Shadow 축소
const shadowReplacements = {
  'shadow-lg': 'shadow-sm',
  'shadow-xl': 'shadow-sm',
  'shadow-2xl': 'shadow-sm'
};

/**
 * 파일이 변환 대상인지 확인
 */
function shouldTransform(filePath) {
  const ext = path.extname(filePath);
  
  // TypeScript/JavaScript/TSX 파일만 처리
  if (!['.ts', '.tsx', '.js', '.jsx', '.css'].includes(ext)) {
    return false;
  }
  
  // 제외 디렉토리 체크
  for (const excludeDir of EXCLUDE_DIRS) {
    if (filePath.includes(excludeDir)) {
      return false;
    }
  }
  
  // 마크다운 파일 제외
  if (filePath.endsWith('.md')) {
    return false;
  }
  
  return true;
}

/**
 * 파일 내용 변환
 */
function transformFileContent(content, filePath) {
  let transformed = content;
  let hasChanges = false;
  
  // 컬러 클래스 변경
  for (const [oldPattern, newPattern] of Object.entries(colorReplacements)) {
    const regex = new RegExp(oldPattern, 'g');
    if (regex.test(transformed)) {
      transformed = transformed.replace(regex, newPattern);
      hasChanges = true;
    }
  }
  
  // HEX 컬러 변경
  for (const [oldHex, newHex] of Object.entries(colorReplacements)) {
    if (oldHex.startsWith('#') && transformed.includes(oldHex)) {
      transformed = transformed.replace(new RegExp(oldHex, 'g'), newHex);
      hasChanges = true;
    }
  }
  
  // Gradient 제거
  for (const { pattern, replacement } of gradientReplacements) {
    if (pattern.test(transformed)) {
      transformed = transformed.replace(pattern, replacement);
      hasChanges = true;
    }
  }
  
  // Shadow 축소
  for (const [oldShadow, newShadow] of Object.entries(shadowReplacements)) {
    const regex = new RegExp(oldShadow, 'g');
    if (regex.test(transformed)) {
      transformed = transformed.replace(regex, newShadow);
      hasChanges = true;
    }
  }
  
  // 이모티콘 제거 (CSS 파일 제외)
  // if (!filePath.endsWith('.css') && emojiPattern.test(transformed)) {
  //   transformed = transformed.replace(emojiPattern, '');
  //   hasChanges = true;
  // }
  
  return { transformed, hasChanges };
}

/**
 * 파일 처리
 */
function processFile(filePath) {
  if (!shouldTransform(filePath)) {
    return false;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { transformed, hasChanges } = transformFileContent(content, filePath);
    
    if (hasChanges) {
      fs.writeFileSync(filePath, transformed, 'utf8');
      console.log(`✓ Updated: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    return false;
  }
}

/**
 * 메인 실행
 */
function main() {
  console.log('🎨 보수적 디자인 변환 시작...\n');
  
  // src 디렉토리에서 모든 .ts, .tsx, .js, .jsx 파일 찾기
  const files = glob.sync('src/**/*.{ts,tsx,js,jsx}', {
    ignore: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**'
    ]
  });
  
  console.log(`📁 ${files.length}개 파일 발견\n`);
  
  let updatedCount = 0;
  
  for (const file of files) {
    if (processFile(file)) {
      updatedCount++;
    }
  }
  
  console.log(`\n✨ 변환 완료: ${updatedCount}개 파일 업데이트됨`);
}

main();
