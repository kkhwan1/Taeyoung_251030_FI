const fs = require('fs');
const path = require('path');

// Read the skipped records file
const skippedPath = path.join(__dirname, '../migration/data/clean-data/inbound-skipped.json');
const skippedFile = JSON.parse(fs.readFileSync(skippedPath, 'utf8'));
const skippedData = skippedFile.records || skippedFile;

console.log('Total skipped records:', skippedData.length);
console.log('Type of skippedData:', typeof skippedData);
console.log('Is array?', Array.isArray(skippedData));

// Check structure of first record
if (skippedData.length > 0) {
  console.log('\nFirst record structure:');
  console.log(JSON.stringify(skippedData[0], null, 2));
}

// Filter for Invalid P/NO records
const invalidPNO = skippedData.filter(record => {
  return record.reason && record.reason.includes('Invalid P/NO');
});

console.log('\n=== INVALID P/NO ANALYSIS ===');
console.log('Total Invalid P/NO records:', invalidPNO.length);

// Analyze patterns
const pnoValues = {};
const patterns = {
  hasSpecialChars: [],
  hasSpaces: [],
  tooShort: [],
  tooLong: [],
  empty: [],
  numeric: [],
  hasKorean: [],
  other: []
};

invalidPNO.forEach((item, index) => {
  const record = item.record || item;
  const rawPNO = record['P/NO'];
  const pno = rawPNO ? String(rawPNO).trim() : null;

  if (!pno || pno === '' || pno === 'null' || pno === 'undefined') {
    patterns.empty.push({ index: index + 1, pno: rawPNO, record, reason: item.reason });
  } else {
    // Store all P/NO values
    pnoValues[pno] = (pnoValues[pno] || 0) + 1;

    // Analyze patterns
    if (pno.includes(' ')) patterns.hasSpaces.push({ index: index + 1, pno, record, reason: item.reason });
    if (pno.length < 3) patterns.tooShort.push({ index: index + 1, pno, record, reason: item.reason });
    if (pno.length > 20) patterns.tooLong.push({ index: index + 1, pno, record, reason: item.reason });
    if (/^[0-9]+$/.test(pno)) patterns.numeric.push({ index: index + 1, pno, record, reason: item.reason });
    if (/[가-힣]/.test(pno)) patterns.hasKorean.push({ index: index + 1, pno, record, reason: item.reason });
    if (/[^a-zA-Z0-9-]/.test(pno) && !pno.includes(' ') && !/[가-힣]/.test(pno)) {
      patterns.hasSpecialChars.push({ index: index + 1, pno, record, reason: item.reason });
    }
  }
});

console.log('\n=== PATTERN ANALYSIS ===');
console.log('Empty P/NO:', patterns.empty.length);
console.log('Has spaces:', patterns.hasSpaces.length);
console.log('Too short (<3 chars):', patterns.tooShort.length);
console.log('Too long (>20 chars):', patterns.tooLong.length);
console.log('Numeric only:', patterns.numeric.length);
console.log('Contains Korean:', patterns.hasKorean.length);
console.log('Has special characters:', patterns.hasSpecialChars.length);

console.log('\n=== UNIQUE P/NO VALUES ===');
const uniquePNOs = Object.keys(pnoValues).sort();
console.log('Total unique P/NO values:', uniquePNOs.length);
uniquePNOs.forEach((pno, i) => {
  console.log(`${i + 1}. "${pno}" (count: ${pnoValues[pno]})`);
});

console.log('\n=== SAMPLE RECORDS ===');
invalidPNO.slice(0, 10).forEach((item, i) => {
  const record = item.record || item;
  console.log(`\n${i + 1}. P/NO: "${record['P/NO']}"`);
  console.log(`   Part Name: ${record['Part Name']}`);
  console.log(`   Company: ${record['협력사']}`);
  console.log(`   Quantity: ${record['납품실적']}`);
  console.log(`   Reason: ${item.reason}`);
});

// Save detailed analysis to JSON
const analysisResult = {
  totalInvalidPNO: invalidPNO.length,
  uniquePNOValues: uniquePNOs.length,
  patterns: {
    empty: patterns.empty.length,
    hasSpaces: patterns.hasSpaces.length,
    tooShort: patterns.tooShort.length,
    tooLong: patterns.tooLong.length,
    numeric: patterns.numeric.length,
    hasKorean: patterns.hasKorean.length,
    hasSpecialChars: patterns.hasSpecialChars.length
  },
  pnoFrequency: pnoValues,
  detailedPatterns: {
    empty: patterns.empty.map(p => ({ pno: p.pno, partName: p.record['Part Name'], company: p.record['협력사'], reason: p.reason })),
    hasSpaces: patterns.hasSpaces.map(p => ({ pno: p.pno, partName: p.record['Part Name'], company: p.record['협력사'], reason: p.reason })),
    tooShort: patterns.tooShort.map(p => ({ pno: p.pno, partName: p.record['Part Name'], company: p.record['협력사'], reason: p.reason })),
    tooLong: patterns.tooLong.map(p => ({ pno: p.pno, partName: p.record['Part Name'], company: p.record['협력사'], reason: p.reason })),
    numeric: patterns.numeric.map(p => ({ pno: p.pno, partName: p.record['Part Name'], company: p.record['협력사'], reason: p.reason })),
    hasKorean: patterns.hasKorean.map(p => ({ pno: p.pno, partName: p.record['Part Name'], company: p.record['협력사'], reason: p.reason })),
    hasSpecialChars: patterns.hasSpecialChars.map(p => ({ pno: p.pno, partName: p.record['Part Name'], company: p.record['협력사'], reason: p.reason }))
  },
  allRecords: invalidPNO.map(item => {
    const r = item.record || item;
    return {
      pno: r['P/NO'],
      partName: r['Part Name'],
      company: r['협력사'],
      quantity: r['납품실적'],
      reason: item.reason
    };
  })
};

const outputPath = path.join(__dirname, 'invalid-pno-analysis.json');
fs.writeFileSync(outputPath, JSON.stringify(analysisResult, null, 2), 'utf8');
console.log(`\n✅ Analysis saved to: ${outputPath}`);
