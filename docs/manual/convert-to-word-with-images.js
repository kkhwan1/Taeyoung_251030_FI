const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, AlignmentType, BorderStyle } = require('docx');

const markdownFile = path.join(__dirname, '태창ERP_실무가이드.md');
const outputFile = path.join(__dirname, '태창ERP_실무가이드.docx');

console.log('Reading Markdown file...');
const markdown = fs.readFileSync(markdownFile, 'utf-8');

function parseMarkdownToDocx(md) {
  const lines = md.split('\n');
  const paragraphs = [];
  let inCodeBlock = false;
  let codeLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        paragraphs.push(
          new Paragraph({
            text: codeLines.join('\n'),
            style: 'Code',
            shading: {
              fill: 'F5F5F5',
            },
            border: {
              left: {
                color: '000000',
                space: 1,
                style: BorderStyle.SINGLE,
                size: 18,
              },
            },
          })
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Check for images
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
                    width: 600,
                    height: 400,
                  },
                }),
              ],
              spacing: {
                before: 200,
                after: 200,
              },
              alignment: AlignmentType.CENTER,
            })
          );
          // Add caption
          paragraphs.push(
            new Paragraph({
              text: alt,
              alignment: AlignmentType.CENTER,
              spacing: {
                after: 300,
              },
              style: 'Caption',
            })
          );
        } catch (error) {
          console.error(`Error embedding image ${src}:`, error.message);
          paragraphs.push(
            new Paragraph({
              text: `[이미지: ${alt}]`,
              italics: true,
            })
          );
        }
      } else {
        paragraphs.push(
          new Paragraph({
            text: `[이미지: ${alt}]`,
            italics: true,
          })
        );
      }
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          text: line.substring(2),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
          border: {
            bottom: {
              color: '000000',
              space: 1,
              style: BorderStyle.SINGLE,
              size: 12,
            },
          },
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
          border: {
            bottom: {
              color: '000000',
              space: 1,
              style: BorderStyle.SINGLE,
              size: 8,
            },
          },
        })
      );
      continue;
    }

    if (line.startsWith('### ')) {
      paragraphs.push(
        new Paragraph({
          text: line.substring(4),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 250, after: 100 },
          border: {
            left: {
              color: '000000',
              space: 1,
              style: BorderStyle.SINGLE,
              size: 18,
            },
          },
        })
      );
      continue;
    }

    // Horizontal rules
    if (line.trim() === '---') {
      paragraphs.push(
        new Paragraph({
          text: '',
          spacing: { before: 200, after: 200 },
          border: {
            top: {
              color: 'CCCCCC',
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6,
            },
          },
        })
      );
      continue;
    }

    // Lists
    if (line.match(/^[-*✅❌]\s+/)) {
      const content = line.replace(/^[-*✅❌]\s+/, '');
      const runs = parseInlineFormatting(content);
      paragraphs.push(
        new Paragraph({
          children: [new TextRun('• '), ...runs],
          spacing: { before: 50, after: 50 },
          indent: { left: 400 },
        })
      );
      continue;
    }

    // Empty lines
    if (line.trim() === '') {
      paragraphs.push(
        new Paragraph({
          text: '',
          spacing: { before: 100, after: 100 },
        })
      );
      continue;
    }

    // Regular paragraphs
    const runs = parseInlineFormatting(line);
    paragraphs.push(
      new Paragraph({
        children: runs,
        spacing: { before: 100, after: 100 },
      })
    );
  }

  return paragraphs;
}

function parseInlineFormatting(text) {
  const runs = [];
  let currentPos = 0;

  // Simple parser for bold, italic, and code
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > currentPos) {
      runs.push(
        new TextRun({
          text: text.substring(currentPos, match.index),
        })
      );
    }

    // Add formatted text
    if (match[2]) {
      // Bold
      runs.push(
        new TextRun({
          text: match[2],
          bold: true,
        })
      );
    } else if (match[4]) {
      // Italic
      runs.push(
        new TextRun({
          text: match[4],
          italics: true,
        })
      );
    } else if (match[6]) {
      // Code
      runs.push(
        new TextRun({
          text: match[6],
          font: 'Consolas',
          shading: {
            fill: 'F5F5F5',
          },
        })
      );
    }

    currentPos = match.index + match[0].length;
  }

  // Add remaining text
  if (currentPos < text.length) {
    runs.push(
      new TextRun({
        text: text.substring(currentPos),
      })
    );
  }

  return runs.length > 0 ? runs : [new TextRun({ text })];
}

console.log('Converting to Word document with embedded images...');
const paragraphs = parseMarkdownToDocx(markdown);

const doc = new Document({
  styles: {
    paragraphStyles: [
      {
        id: 'Normal',
        name: 'Normal',
        basedOn: 'Normal',
        next: 'Normal',
        run: {
          font: '맑은 고딕',
          size: 22, // 11pt
          color: '000000',
        },
        paragraph: {
          spacing: {
            line: 276, // 1.15 line spacing
            before: 0,
            after: 0,
          },
        },
      },
      {
        id: 'Code',
        name: 'Code',
        basedOn: 'Normal',
        run: {
          font: 'Consolas',
          size: 18, // 9pt
          color: '000000',
        },
        paragraph: {
          spacing: {
            before: 200,
            after: 200,
          },
        },
      },
      {
        id: 'Caption',
        name: 'Caption',
        basedOn: 'Normal',
        run: {
          size: 20, // 10pt
          color: '666666',
          italics: true,
        },
      },
    ],
    characterStyles: [
      {
        id: 'Strong',
        name: 'Strong',
        basedOn: 'Normal',
        run: {
          bold: true,
          color: '000000',
        },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: 1440, // 1 inch
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
  console.log(`✓ Successfully created Word document with embedded images`);
  console.log(`  Output: ${outputFile}`);
  console.log(`  Size: ${Math.round(buffer.length / 1024)} KB`);
  console.log(`  Original lines: ${markdown.split('\n').length.toLocaleString()}`);
  console.log(`  Total paragraphs: ${paragraphs.length}`);
});
