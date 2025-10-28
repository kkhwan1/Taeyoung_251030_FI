/**
 * 장식용 아이콘을 제거하여 보수적 디자인으로 전환하는 스크립트
 * Summary/KPI 카드의 장식용 아이콘만 제거하고, 기능 버튼 아이콘은 유지
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 제거할 장식용 아이콘 (Summary/KPI 카드용)
const decorativeIcons = [
  'Package',
  'BarChart3',
  'TrendingUp',
  'TrendingDown',
  'AlertTriangle',
  'DollarSign',
  'Users',
  'ShoppingCart',
  'CreditCard',
  'Wallet',
  'PieChart',
  'Activity',
  'FileText',
  'Layers',
  'Box',
  'Archive',
  'Truck',
  'ShoppingBag'
];

// 유지할 기능 아이콘
const functionalIcons = [
  'Download',
  'Upload',
  'Printer',
  'Calendar',
  'Search',
  'Filter',
  'X',
  'Plus',
  'Minus',
  'Edit',
  'Trash',
  'Save',
  'ChevronLeft',
  'ChevronRight',
  'ChevronUp',
  'ChevronDown',
  'Menu',
  'CheckCircle',
  'XCircle',
  'AlertCircle',
  'Info',
  'Settings',
  'Eye',
  'EyeOff',
  'MoreVertical',
  'MoreHorizontal',
  'RefreshCw',
  'RotateCw'
];

let filesProcessed = 0;
let iconsRemoved = 0;
let importsUpdated = 0;

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const originalContent = content;

    // 1. Import 문에서 장식용 아이콘 제거
    const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g;
    content = content.replace(importRegex, (match, imports) => {
      const iconList = imports.split(',').map(i => i.trim()).filter(i => i);
      const filteredIcons = iconList.filter(icon => {
        const iconName = icon.trim();
        return functionalIcons.includes(iconName) || !decorativeIcons.includes(iconName);
      });
      
      if (filteredIcons.length !== iconList.length) {
        modified = true;
        importsUpdated++;
      }
      
      if (filteredIcons.length === 0) {
        return ''; // import 문 전체 제거
      }
      
      return `import {\n  ${filteredIcons.join(',\n  ')}\n} from 'lucide-react'`;
    });

    // 2. JSX에서 장식용 아이콘 컴포넌트 제거 (Summary/KPI 카드 패턴)
    decorativeIcons.forEach(icon => {
      // 패턴 1: <Icon className="..." />
      const pattern1 = new RegExp(`<${icon}\\s+className="[^"]*"\\s*/>`, 'g');
      if (pattern1.test(content)) {
        content = content.replace(pattern1, '');
        modified = true;
        iconsRemoved++;
      }

      // 패턴 2: <Icon className="..." /> with line breaks
      const pattern2 = new RegExp(`<${icon}\\s+className="[^"]*"\\s*/>\\n?`, 'g');
      if (pattern2.test(content)) {
        content = content.replace(pattern2, '');
        modified = true;
      }

      // 패턴 3: flex 레이아웃에서 아이콘 제거
      const pattern3 = new RegExp(
        `<div className="flex items-center gap-[0-9]">\\s*<${icon}[^>]*/>\\s*<div>`,
        'g'
      );
      if (pattern3.test(content)) {
        content = content.replace(pattern3, '<div>');
        modified = true;
      }
    });

    // 3. 빈 import 문 제거
    content = content.replace(/import\s*\{\s*\}\s*from\s*['"]lucide-react['"];?\n?/g, '');

    // 4. 연속된 빈 줄 제거
    content = content.replace(/\n\n\n+/g, '\n\n');

    if (modified && content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      filesProcessed++;
      console.log(`✓ Processed: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// 제외할 디렉토리
const excludeDirs = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'test-results',
  'playwright-report'
];

// 처리할 파일 찾기
const files = glob.sync('src/**/*.{tsx,ts}', {
  ignore: excludeDirs.map(dir => `**/${dir}/**`),
  nodir: true
});

console.log(`\n🎯 장식용 아이콘 제거 시작...`);
console.log(`📁 총 ${files.length}개 파일 검사 중...\n`);

files.forEach(file => {
  processFile(file);
});

console.log(`\n✅ 작업 완료!`);
console.log(`📊 통계:`);
console.log(`   - 처리된 파일: ${filesProcessed}개`);
console.log(`   - 제거된 아이콘: ${iconsRemoved}개`);
console.log(`   - 업데이트된 import 문: ${importsUpdated}개`);
console.log(`\n💡 다음 단계: 주요 페이지를 수동으로 검토하여 레이아웃 조정 필요\n`);

