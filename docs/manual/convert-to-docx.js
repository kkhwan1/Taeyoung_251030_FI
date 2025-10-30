const fs = require('fs');
const path = require('path');

// Simple markdown to Word conversion using basic HTML
const markdownFile = path.join(__dirname, '태창ERP_실무가이드.md');
const outputFile = path.join(__dirname, '태창ERP_실무가이드.docx');

console.log('Reading Markdown file...');
const markdown = fs.readFileSync(markdownFile, 'utf-8');

// Convert markdown to HTML with basic formatting
let html = markdown
  // Headers
  .replace(/^### (.+)$/gm, '<h3>$1</h3>')
  .replace(/^## (.+)$/gm, '<h2>$1</h2>')
  .replace(/^# (.+)$/gm, '<h1>$1</h1>')
  // Bold
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Italic
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Code blocks
  .replace(/```[\s\S]*?```/g, (match) => {
    return '<pre>' + match.replace(/```/g, '') + '</pre>';
  })
  // Inline code
  .replace(/`(.+?)`/g, '<code>$1</code>')
  // Lists
  .replace(/^- (.+)$/gm, '<li>$1</li>')
  .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
  // Line breaks
  .replace(/\n\n/g, '<br><br>')
  .replace(/\n/g, '<br>');

// Create a simple Word-compatible HTML
const docContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>태창 ERP 실무 가이드</title>
<style>
body {
  font-family: 'Malgun Gothic', '맑은 고딕', Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.6;
}
h1 {
  font-size: 24pt;
  font-weight: bold;
  color: #2c3e50;
  page-break-before: always;
  margin-top: 30pt;
}
h2 {
  font-size: 18pt;
  font-weight: bold;
  color: #34495e;
  margin-top: 20pt;
}
h3 {
  font-size: 14pt;
  font-weight: bold;
  color: #7f8c8d;
  margin-top: 15pt;
}
pre {
  background-color: #f5f5f5;
  padding: 10pt;
  border: 1pt solid #ddd;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 10pt;
}
code {
  background-color: #f5f5f5;
  padding: 2pt 4pt;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 10pt;
}
ul {
  margin-left: 20pt;
}
li {
  margin-bottom: 5pt;
}
table {
  border-collapse: collapse;
  width: 100%;
  margin: 10pt 0;
}
th, td {
  border: 1pt solid #ddd;
  padding: 8pt;
  text-align: left;
}
th {
  background-color: #f5f5f5;
  font-weight: bold;
}
</style>
</head>
<body>
${html}
</body>
</html>
`;

console.log('Writing Word document...');
fs.writeFileSync(outputFile, docContent, 'utf-8');

console.log(`✓ Successfully converted to: ${outputFile}`);
console.log(`  File size: ${Math.round(docContent.length / 1024)} KB`);
console.log(`  Total lines in original: ${markdown.split('\n').length}`);
