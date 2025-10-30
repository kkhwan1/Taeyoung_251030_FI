const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } = require('docx');

const inputFile = path.join(__dirname, '태창ERP_실무가이드.md');
const outputFile = path.join(__dirname, '태창ERP_실무가이드_간결판.docx');

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

    // 코드 블록 토글
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue; // 코드 블록 전체 생략
    }

    if (inCodeBlock) continue;

    // 주요 섹션만 유지
    if (line.startsWith('# ') || line.startsWith('## ')) {
      conciseLines.push(line);
      skipDetails = false;
      continue;
    }

    // ### 소제목 중 핵심만 유지
    if (line.startsWith('### ')) {
      const title = line.substring(4);
      // 핵심 섹션만 포함
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

    // 스크린샷은 유지
    if (line.startsWith('![')) {
      conciseLines.push(line);
      continue;
    }

    // 핵심 포인트만 유지 (**, - 로 시작하는 줄)
    if (line.startsWith('**') ||
        (line.startsWith('- ') && !line.includes('(생략)')) ||
        line.startsWith('> ')) {
      conciseLines.push(line);
      continue;
    }

    // 빈 줄은 하나만 유지
    if (line.trim() === '') {
      if (conciseLines[conciseLines.length - 1]?.trim() !== '') {
        conciseLines.push('');
      }
      continue;
    }
  }

  return conciseLines.join('\n');
}

console.log('Extracting concise content...');
const conciseMd = extractConciseContent(markdown);

console.log('Converting to Word document...');
const paragraphs = [];

// 문서 제목
paragraphs.push(
  new Paragraph({
    text: '태창 ERP 실무 가이드',
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  }),
  new Paragraph({
    text: '간결판 - 핵심 기능 중심',
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
    run: {
      size: 24,
      color: '666666',
    },
  })
);

const lines = conciseMd.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

  if (line === '') {
    paragraphs.push(new Paragraph({ text: '' }));
    continue;
  }

  // 헤더 처리
  if (line.startsWith('# ')) {
    paragraphs.push(
      new Paragraph({
        text: line.substring(2),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );
    continue;
  }

  if (line.startsWith('## ')) {
    paragraphs.push(
      new Paragraph({
        text: line.substring(3),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      })
    );
    continue;
  }

  if (line.startsWith('### ')) {
    paragraphs.push(
      new Paragraph({
        text: line.substring(4),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 },
      })
    );
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
        const imageBuffer = fs.readFileSync(imagePath);
        paragraphs.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: imageBuffer,
                transformation: {
                  width: 500,
                  height: 350,
                },
              }),
            ],
            spacing: { before: 150, after: 150 },
            alignment: AlignmentType.CENTER,
          })
        );
        paragraphs.push(
          new Paragraph({
            text: `[${alt}]`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 250 },
            run: {
              size: 18,
              color: '666666',
              italics: true,
            },
          })
        );
      } catch (error) {
        console.error(`Error embedding image ${src}:`, error.message);
      }
    }
    continue;
  }

  // 리스트 처리
  if (line.startsWith('- ')) {
    paragraphs.push(
      new Paragraph({
        text: line.substring(2),
        bullet: { level: 0 },
        spacing: { before: 50, after: 50 },
      })
    );
    continue;
  }

  // 인용 처리
  if (line.startsWith('> ')) {
    paragraphs.push(
      new Paragraph({
        text: line.substring(2),
        italics: true,
        spacing: { before: 100, after: 100, left: 400 },
        run: {
          color: '555555',
        },
      })
    );
    continue;
  }

  // 볼드 처리
  if (line.startsWith('**') && line.endsWith('**')) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: line.substring(2, line.length - 2),
            bold: true,
          }),
        ],
        spacing: { before: 100, after: 100 },
      })
    );
    continue;
  }

  // 일반 텍스트
  paragraphs.push(
    new Paragraph({
      text: line,
      spacing: { before: 50, after: 50 },
    })
  );
}

const doc = new Document({
  styles: {
    default: {
      heading1: {
        run: {
          font: '맑은 고딕',
          size: 32,
          bold: true,
          color: '000000',
        },
        paragraph: {
          spacing: { before: 400, after: 200 },
        },
      },
      heading2: {
        run: {
          font: '맑은 고딕',
          size: 28,
          bold: true,
          color: '000000',
        },
        paragraph: {
          spacing: { before: 300, after: 150 },
        },
      },
      heading3: {
        run: {
          font: '맑은 고딕',
          size: 24,
          bold: true,
          color: '333333',
        },
        paragraph: {
          spacing: { before: 200, after: 100 },
        },
      },
    },
    paragraphStyles: [
      {
        id: 'Normal',
        name: 'Normal',
        run: {
          font: '맑은 고딕',
          size: 22,
          color: '000000',
        },
        paragraph: {
          spacing: { line: 276 },
        },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: 1440,
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      children: paragraphs,
    },
  ],
});

console.log('Writing Word document...');
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputFile, buffer);
  const stats = fs.statSync(outputFile);
  const fileSizeKB = Math.round(stats.size / 1024);

  console.log('✓ Successfully created concise Word document');
  console.log(`  Output: ${outputFile}`);
  console.log(`  Size: ${fileSizeKB} KB`);
  console.log(`  Total paragraphs: ${paragraphs.length}`);
});
