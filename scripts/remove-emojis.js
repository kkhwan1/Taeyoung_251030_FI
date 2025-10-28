/**
 * 이모티콘 제거 스크립트 (문서 파일 제외)
 */

const fs = require('fs');
const glob = require('glob');

// 이모티콘 범위 (유니코드)
const emojiRanges = [
  /[\u{1F600}-\u{1F64F}]/gu, // Emoticons
  /[\u{1F300}-\u{1F5FF}]/gu, // Misc Symbols and Pictographs
  /[\u{1F680}-\u{1F6FF}]/gu, // Transport and Map
  /[\u{1F1E0}-\u{1F1FF}]/gu, // Flags
  /[\u{2600}-\u{26FF}]/gu,   // Misc symbols
  /[\u{2700}-\u{27BF}]/gu,   // Dingbats
  /[\u{1F900}-\u{1F9FF}]/gu, // Supplemental Symbols and Pictographs
  /[\u{1FA00}-\u{1FA6F}]/gu, // Chess Symbols
  /[\u{1FA70}-\u{1FAFF}]/gu, // Symbols and Pictographs Extended-A
];

function removeEmojis(text) {
  let result = text;
  for (const regex of emojiRanges) {
    result = result.replace(regex, '');
  }
  return result;
}

function processFile(filePath) {
  // 마크다운 파일 제외
  if (filePath.endsWith('.md')) {
    return false;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const cleaned = removeEmojis(content);
    
    if (content !== cleaned) {
      fs.writeFileSync(filePath, cleaned, 'utf8');
      console.log(`✓ Removed emojis from: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🧹 이모티콘 제거 시작...\n');
  
  const files = glob.sync('src/**/*.{ts,tsx,js,jsx}', {
    ignore: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/*.md'
    ]
  });
  
  console.log(`📁 ${files.length}개 파일 검사 중\n`);
  
  let updatedCount = 0;
  
  for (const file of files) {
    if (processFile(file)) {
      updatedCount++;
    }
  }
  
  console.log(`\n✨ 완료: ${updatedCount}개 파일에서 이모티콘 제거됨`);
}

main();
