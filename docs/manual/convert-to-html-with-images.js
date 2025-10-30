const fs = require('fs');
const path = require('path');

const markdownFile = path.join(__dirname, '태창ERP_실무가이드.md');
const outputFile = path.join(__dirname, '태창ERP_실무가이드.html');

console.log('Reading Markdown file...');
const markdown = fs.readFileSync(markdownFile, 'utf-8');

// Convert markdown image syntax to base64 embedded images
function embedImages(md) {
  const imageRegex = /!\[(.*?)\]\((.*?)\)/g;

  let result = md.replace(imageRegex, (match, alt, src) => {
    try {
      const imagePath = path.join(__dirname, src);
      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        const base64 = imageBuffer.toString('base64');
        const ext = path.extname(imagePath).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
        return `<img src="data:${mimeType};base64,${base64}" alt="${alt}" style="max-width: 100%; height: auto; border: 1px solid #ddd; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`;
      } else {
        return `<p style="color: #666; font-style: italic;">[이미지: ${alt}]</p>`;
      }
    } catch (e) {
      return `<p style="color: #666; font-style: italic;">[이미지: ${alt}]</p>`;
    }
  });

  return result;
}

// Convert markdown to HTML
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function processMarkdown(md) {
  let lines = md.split('\n');
  let html = [];
  let inCodeBlock = false;
  let inList = false;
  let listItems = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html.push('</pre>');
        inCodeBlock = false;
      } else {
        if (inList) {
          html.push('<ul>' + listItems.join('') + '</ul>');
          listItems = [];
          inList = false;
        }
        html.push('<pre>');
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      html.push(escapeHtml(line));
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      if (inList) {
        html.push('<ul>' + listItems.join('') + '</ul>');
        listItems = [];
        inList = false;
      }
      html.push('<h3>' + escapeHtml(line.substring(4)) + '</h3>');
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) {
        html.push('<ul>' + listItems.join('') + '</ul>');
        listItems = [];
        inList = false;
      }
      html.push('<h2>' + escapeHtml(line.substring(3)) + '</h2>');
      continue;
    }
    if (line.startsWith('# ')) {
      if (inList) {
        html.push('<ul>' + listItems.join('') + '</ul>');
        listItems = [];
        inList = false;
      }
      html.push('<h1>' + escapeHtml(line.substring(2)) + '</h1>');
      continue;
    }

    // Lists
    if (line.match(/^[-*✅❌]\\s+/)) {
      let content = line.replace(/^[-*✅❌]\\s+/, '');
      content = processInlineFormatting(content);
      listItems.push('<li>' + content + '</li>');
      inList = true;
      continue;
    } else if (inList && line.trim() === '') {
      html.push('<ul>' + listItems.join('') + '</ul>');
      listItems = [];
      inList = false;
      html.push('<p>&nbsp;</p>');
      continue;
    }

    // Horizontal rules
    if (line.trim() === '---') {
      if (inList) {
        html.push('<ul>' + listItems.join('') + '</ul>');
        listItems = [];
        inList = false;
      }
      html.push('<hr>');
      continue;
    }

    // Empty lines
    if (line.trim() === '') {
      if (inList) {
        continue;
      }
      html.push('<p>&nbsp;</p>');
      continue;
    }

    // Regular paragraphs
    if (inList) {
      html.push('<ul>' + listItems.join('') + '</ul>');
      listItems = [];
      inList = false;
    }

    let processedLine = processInlineFormatting(line);
    html.push('<p>' + processedLine + '</p>');
  }

  if (inList) {
    html.push('<ul>' + listItems.join('') + '</ul>');
  }

  return html.join('\n');
}

function processInlineFormatting(text) {
  text = escapeHtml(text);
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/`(.+?)`/g, '<code>$1</code>');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return text;
}

// Embed images first
const markdownWithImages = embedImages(markdown);

// Then convert to HTML
const htmlBody = processMarkdown(markdownWithImages);

// Create final HTML document
const docContent = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>태창 ERP 실무 가이드</title>
<style>
@page {
  margin: 2.5cm;
}
body {
  font-family: '맑은 고딕', 'Malgun Gothic', Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.6;
  margin: 0;
  padding: 20pt;
  color: #000;
  background: #fff;
  max-width: 1200px;
  margin: 0 auto;
}
h1 {
  font-size: 22pt;
  font-weight: bold;
  color: #000;
  margin: 25pt 0 12pt 0;
  padding-bottom: 8pt;
  border-bottom: 2pt solid #000;
  page-break-before: always;
}
h1:first-child {
  page-break-before: avoid;
}
h2 {
  font-size: 16pt;
  font-weight: bold;
  color: #000;
  margin: 20pt 0 10pt 0;
  padding-bottom: 5pt;
  border-bottom: 1.5pt solid #000;
}
h3 {
  font-size: 13pt;
  font-weight: bold;
  color: #000;
  margin: 15pt 0 8pt 0;
  padding-left: 8pt;
  border-left: 3pt solid #000;
}
p {
  margin: 8pt 0;
  text-align: left;
  color: #000;
}
pre {
  background-color: #f5f5f5;
  padding: 10pt;
  border: 1pt solid #ccc;
  border-left: 3pt solid #000;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 9pt;
  line-height: 1.4;
  overflow-x: auto;
  margin: 10pt 0;
  white-space: pre-wrap;
  color: #000;
}
code {
  background-color: #f5f5f5;
  padding: 2pt 5pt;
  border: 1pt solid #ccc;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 9.5pt;
  color: #000;
}
ul {
  margin: 8pt 0 8pt 20pt;
  padding: 0;
}
li {
  margin: 4pt 0;
  line-height: 1.5;
  color: #000;
}
strong {
  font-weight: bold;
  color: #000;
}
em {
  font-style: italic;
  color: #333;
}
hr {
  border: none;
  border-top: 1pt solid #ccc;
  margin: 12pt 0;
}
a {
  color: #000;
  text-decoration: underline;
}
img {
  max-width: 100%;
  height: auto;
  border: 1px solid #ddd;
  margin: 20px 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
</style>
</head>
<body>
${htmlBody}
</body>
</html>
`;

console.log('Writing HTML document...');
fs.writeFileSync(outputFile, docContent, 'utf-8');

console.log(`✓ Successfully converted to HTML with embedded images`);
console.log(`  Output: ${outputFile}`);
console.log(`  Size: ${Math.round(docContent.length / 1024)} KB`);
console.log(`  Original lines: ${markdown.split('\n').length.toLocaleString()}`);
