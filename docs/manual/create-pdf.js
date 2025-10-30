const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const inputFile = path.join(__dirname, '태창ERP_실무가이드.md');
const outputFile = path.join(__dirname, '태창ERP_실무가이드.pdf');

console.log('Reading Markdown file...');
const markdown = fs.readFileSync(inputFile, 'utf-8');

// 간결한 내용 추출 함수
function extractConciseContent(md) {
  const lines = md.split('\n');
  const conciseLines = [];
  let inCodeBlock = false;
  let skipDetails = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) continue;

    if (line.startsWith('# ') || line.startsWith('## ')) {
      conciseLines.push(line);
      skipDetails = false;
      continue;
    }

    if (line.startsWith('### ')) {
      const title = line.substring(4);
      if (title.includes('주요 기능') ||
          title.includes('화면 구성') ||
          title.includes('사용 방법') ||
          title.includes('업무 프로세스') ||
          title.includes('실무 팁')) {
        conciseLines.push(line);
        skipDetails = false;
      } else {
        skipDetails = true;
      }
      continue;
    }

    if (skipDetails) continue;

    if (line.startsWith('![')) {
      conciseLines.push(line);
      continue;
    }

    if (line.startsWith('**') ||
        (line.startsWith('- ') && !line.includes('(생략)')) ||
        line.startsWith('> ')) {
      conciseLines.push(line);
      continue;
    }

    if (line.trim() === '') {
      if (conciseLines[conciseLines.length - 1]?.trim() !== '') {
        conciseLines.push('');
      }
      continue;
    }
  }

  return conciseLines;
}

console.log('Extracting concise content...');
const conciseLines = extractConciseContent(markdown);

console.log('Creating PDF document...');
const doc = new PDFDocument({
  size: 'A4',
  margins: {
    top: 72,
    bottom: 72,
    left: 72,
    right: 72,
  },
  bufferPages: true,
});

const stream = fs.createWriteStream(outputFile);
doc.pipe(stream);

// 한글 폰트 등록 (Windows 기본 폰트 사용)
const fontPath = 'C:/Windows/Fonts/malgun.ttf';
if (fs.existsSync(fontPath)) {
  doc.registerFont('Malgun', fontPath);
  doc.font('Malgun');
} else {
  console.warn('Warning: 맑은 고딕 폰트를 찾을 수 없습니다. 기본 폰트를 사용합니다.');
}

let currentY = doc.y;

// 제목
doc.fontSize(24)
   .fillColor('#000000')
   .text('태창 ERP 실무 가이드', { align: 'center' });

doc.moveDown(0.5);
doc.fontSize(14)
   .fillColor('#666666')
   .text('간결판 - 핵심 기능 중심', { align: 'center' });

doc.moveDown(2);

// 내용 렌더링
for (let i = 0; i < conciseLines.length; i++) {
  const line = conciseLines[i].trim();

  if (line === '') {
    doc.moveDown(0.5);
    continue;
  }

  // 페이지 넘김 확인
  if (doc.y > 700) {
    doc.addPage();
  }

  // H1 헤더
  if (line.startsWith('# ')) {
    if (i > 0) doc.addPage();
    doc.fontSize(20)
       .fillColor('#000000')
       .text(line.substring(2), { continued: false });
    doc.moveDown(0.5);
    continue;
  }

  // H2 헤더
  if (line.startsWith('## ')) {
    doc.moveDown(0.5);
    doc.fontSize(16)
       .fillColor('#000000')
       .text(line.substring(3), { continued: false });
    doc.moveDown(0.3);
    continue;
  }

  // H3 헤더
  if (line.startsWith('### ')) {
    doc.fontSize(14)
       .fillColor('#333333')
       .text(line.substring(4), { continued: false });
    doc.moveDown(0.2);
    continue;
  }

  // 이미지 처리
  const imageMatch = line.match(/!\[(.*?)\]\((.*?)\)/);
  if (imageMatch) {
    const alt = imageMatch[1];
    const src = imageMatch[2];
    const imagePath = path.join(__dirname, src);

    if (fs.existsSync(imagePath)) {
      try {
        // 페이지 공간 확인
        if (doc.y > 500) {
          doc.addPage();
        }

        doc.image(imagePath, {
          fit: [450, 300],
          align: 'center',
        });

        doc.moveDown(0.5);
        doc.fontSize(10)
           .fillColor('#666666')
           .text(`[${alt}]`, { align: 'center', italics: true });
        doc.moveDown(1);
      } catch (error) {
        console.error(`Error embedding image ${src}:`, error.message);
        doc.fontSize(10)
           .fillColor('#999999')
           .text(`[이미지: ${alt}]`, { align: 'center' });
      }
    }
    continue;
  }

  // 리스트
  if (line.startsWith('- ')) {
    doc.fontSize(11)
       .fillColor('#000000')
       .list([line.substring(2)], {
         bulletRadius: 2,
         textIndent: 20,
       });
    continue;
  }

  // 인용
  if (line.startsWith('> ')) {
    doc.fontSize(11)
       .fillColor('#555555')
       .text(line.substring(2), {
         indent: 30,
         italics: true,
       });
    doc.moveDown(0.3);
    continue;
  }

  // 볼드
  if (line.startsWith('**') && line.endsWith('**')) {
    doc.fontSize(11)
       .fillColor('#000000')
       .text(line.substring(2, line.length - 2), {
         continued: false,
       });
    doc.moveDown(0.3);
    continue;
  }

  // 일반 텍스트
  doc.fontSize(11)
     .fillColor('#000000')
     .text(line, {
       align: 'left',
       lineGap: 2,
     });
  doc.moveDown(0.2);
}

// 페이지 번호 추가
const pages = doc.bufferedPageRange();
for (let i = 0; i < pages.count; i++) {
  doc.switchToPage(i);

  doc.fontSize(9)
     .fillColor('#999999')
     .text(
       `${i + 1} / ${pages.count}`,
       0,
       doc.page.height - 50,
       { align: 'center' }
     );
}

doc.end();

stream.on('finish', () => {
  const stats = fs.statSync(outputFile);
  const fileSizeKB = Math.round(stats.size / 1024);

  console.log('✓ Successfully created PDF document');
  console.log(`  Output: ${outputFile}`);
  console.log(`  Size: ${fileSizeKB} KB`);
  console.log(`  Pages: ${pages.count}`);
});

stream.on('error', (err) => {
  console.error('Error creating PDF:', err);
});
