const fs = require('fs');
const path = require('path');

// Complete item_id mapping from all 4 batches
const itemMapping = {
  // Batch 1 (47 items found)
  '69156-DO000 (PAD)': 4405,
  '69166-DO000 (PAD)': 4406,
  '69172-DO000': 4407,
  '69182-DO000': 4408,
  '69116-EV000': 4409,
  '69139-EV000': 4410,
  '69156-EV000': 4411,
  '69166-EV000': 4412,
  '651M8-L2800': 4413,
  '65136-L2800': 4414,
  '69118-DO000': 4415,
  '69158-DO000': 4416,
  '69168-DO000': 4417,
  // 'P/NO': INVALID - skip
  '69112-DO000': 4418,
  '69122-DO000': 4419,
  '69112-EV000': 4420,
  '69122-EV000': 4421,
  '84191-A7500': 4422,
  '69145-AT000': 5476, // Added 2025-01-30
  '65852-L2000': 4423,
  '65832-L1000': 4424,
  '65916-L1000': 4425,
  '65412-L1000': 4426,
  '65422-L1000': 4427,
  '657N2-L1000': 4428,
  '657P2-L1000': 4429,
  '655N6-L1000': 4430,
  '655P6-L1000': 4431,
  '65554-D4000': 4432,
  '65916-L8400': 4433,
  '655N6-L8400': 4434,
  '655P6-L8400': 4435,
  '65639-3K000': 4436,
  '65512-A3000': 4437,
  '65837-A3000': 4438,
  '65847-A3000': 4439,
  '65821-1Y800': 4440,
  '65523-A3500': 4441,
  '65779-1Y010': 4442,
  '65789-1Y010': 4443,
  '65798-1Y000': 4444,
  '65512-E2510': 4445,
  '65567-E2510': 4446,
  '657A6-E2510': 4447,
  '657B6-E2510': 4448,
  '65598-E2510': 4449,

  // Batch 2 (50 items found)
  '64749-CV000': 4314,
  '65152-L1000': 4316,
  '65162-L1000': 4317,
  '65152-L8000': 4318,
  '65162-L8000': 4319,
  '65158-L1000': 4320,
  '65168-L1000': 4321,
  '651E4-L1000': 4322,
  '651F4-L1000': 4323,
  '65176-L1000': 4324,
  '65186-L1000': 4325,
  '65154-L1000': 4326,
  '65164-L1000': 4327,
  '65156-L1000': 4328,
  '65166-L1000': 4329,
  '651E6-L1000': 4330,
  '651F6-L1000': 4331,
  '65352-L1000': 4332,
  '65362-L1000': 4333,
  '65174-L1000': 4334,
  '65184-L1000': 4335,
  '65264-F6000': 4336,
  '65264-D4000': 4337,
  '65294-D4000': 4338,
  '651E2-L5000': 4339,
  '651F2-L5000': 4340,
  '65132-L2500': 4341,
  '65132-L3400': 4342,
  '65132-L8000': 4343,
  '65132-L8400': 4344,
  '652E6-L3400': 4345,
  '652F6-L3400': 4346,
  '65282-L3400': 4347,
  '65292-L3400': 4348,
  '65172-L2000': 4349,
  '65182-L2000': 4350,
  '65172-L8000': 4351,
  '65182-L8000': 4352,
  '69156-DO000': 4437,
  '69166-DO000': 4438,
  '69138-DO000': 4366,
  '69148-DO000': 4367,
  '65996-C5000': 4368,
  '99242-06100': 4370,
  '69162-G8000': 4369,
  '69146-AT000': 4373,
  '69138-EV000': 4371,
  '69148-EV000': 4372,
  '12904-06101': 4439,
  '64372-1F000': 4440,

  // Batch 3 (50 items found)
  '64372-1R000': 4441,
  '12900-06140': 4442,
  '12900-06180': 4443,
  '12922-06201': 4444,
  '81763-1Y000': 4445,
  '81838-R0600': 4446,
  '50009766A': 4451,
  '50009768A': 4452,
  '50009971C': 4408,
  '50009973C': 4409,
  '728A1-R0500': 4401,
  '728B1-R0500': 4402,
  '72815-R0500': 4403,
  '72816-R0500': 4404,
  '65154-L8000': 4396,
  '65164-L8000': 4397,
  '65156-L8000': 4398,
  '65166-L8000': 4399,
  '651M8-L8000': 4400,
  '69174-DO000': 4456,
  '69184-DO000': 4457,
  '50010562C': 4458,
  '50011106C': 4388,
  '69116-DO000': 4410,
  '50032843A': 4459,
  '50032844A': 4460,
  '50014454B': 4461,
  '50011937C': 4462,
  '50011938C': 4463,
  '50011939B': 4464,
  '50011941B': 4465,
  '50011944C': 4466,
  '50011955C': 4467,
  '50011957A': 4468,
  '81836-R0500': 4411,
  '81846-R0500': 4412,
  '81836-R0600': 4413,
  '81846-R0600': 4414,
  '50009975B': 4415,
  '50009977B': 4416,
  '50011623A': 4471,
  '50011624A': 4472,
  '50011721D': 4429,
  '50010755C': 4430,
  '50016288A': 4431,
  '50007278B': 4428,
  '50012110B': 4432,
  '65158-L8000': 4375,
  '65168-L8000': 4376,
  '651E3-L8000': 4377,

  // Batch 4 (23 items found)
  '651F3-L8000': 4378,
  '65278-L8000': 4379,
  '65116-L3400': 4380,
  '65126-L3400': 4381,
  '651M7-L2000': 4481,
  '65136-L8000': 4383,
  '65136-L8400': 4384,
  '651M7-L8400': 4385,
  '65158-L8000/': 4482,
  '65168-L8000/': 4483,
  '651E4-L8000/': 4484,
  '651F4-L8000/': 4485,
  '65278-L8000/': 4486,
  '65116-L3400/': 4487,
  '65126-L3400/': 4488,
  '13905-05000': 4489,
  '13905-06000': 4490,
  '13905-08000': 4491,
  '13911-08001': 4492,
  '19353-07250': 4493,
  '13194-08220': 4494,
  '13917-10120': 4495,
  '10216-10000': 4496
};

// Company mapping (expanded with database variations)
const companyMapping = {
  // Original mappings
  'JS테크': 170,
  '양산처': 206,
  '에이오에스': 169,
  '태영금속': 168,
  '태창금속': 163,
  '호원 사급': 174,
  '호원사급': 208,

  // Expanded mappings from database query (21 companies)
  '대우사급': 202,
  '대우당진': 204,
  '웅지테크': 197,
  '아신금속': 182,
  '아신금속 (호원사급)': 167,
  '세원테크': 196,
  '세진오토': 181,
  '삼진스틸': 209,
  '코리아신예 (호원사급)': 164,
  '이원금속 (호원사급)': 165,
  '세원상공 (호원사급)': 171,
  '동신금속 (호원사급)': 172,
  '다인 (호원사급)': 177,
  '풍기산업 (호원사급)': 173,
  '대우공업': 175,
  '호원오토': 176,
  '솔루코': 207,
  '대우태광': 205,
  '대우스틸': 203,
  '다인': 195,
  '인알파코리아': 200,

  // Additional companies added 2025-01-30 (14 companies from skipped records)
  '현대제철': 205,
  '창경': 199,
  '민현': 176,
  '유동금속 (호원사급)': 175,
  '대상': 180,
  '신성산업': 207,
  '신성산업 (호원사급)': 165,
  '풍기사급': 203,
  '오토다임': 177,
  '신호 (호원사급)': 166,
  '광성산업': 186
};

// Load all inbound files
const files = [
  'inbound-coop.json',
  'inbound-daewoo.json',
  'inbound-howon.json',
  'inbound-partners.json'
];

const dataDir = path.join(__dirname, 'data', 'clean-data');
let allRecords = [];

files.forEach(file => {
  const filePath = path.join(dataDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  allRecords = allRecords.concat(data.map(record => ({ ...record, _sourceFile: file })));
});

console.log(`총 ${allRecords.length}개 입고 레코드 로드됨`);

// Transform records
const transformedRecords = [];
const skippedRecords = [];
let recordNo = 1;
let currentCompany = null; // Track current company across records
let lastSourceFile = null; // Track file changes

allRecords.forEach((record, index) => {
  // Reset company when switching to a new file
  if (record._sourceFile !== lastSourceFile) {
    currentCompany = null;
    lastSourceFile = record._sourceFile;
  }

  const itemCode = record['P/NO'];

  // Handle different column names for company
  const companyField = record['협력사'] || record['양산처'];
  if (companyField && companyField.trim()) {
    currentCompany = companyField.trim();
  }

  const companyName = currentCompany; // Use current company

  // Handle different column names for quantity
  const quantity = record['납품실적'] !== undefined ? record['납품실적'] : record['입고수량'];

  // Validate
  if (!itemCode || typeof itemCode !== 'string' || !itemCode.trim()) {
    skippedRecords.push({
      index: index + 1,
      reason: 'Invalid P/NO',
      record: record
    });
    return;
  }

  if (itemCode === 'P/NO') {
    skippedRecords.push({
      index: index + 1,
      reason: 'Header row P/NO',
      record: record
    });
    return;
  }

  const itemId = itemMapping[itemCode];
  if (!itemId) {
    skippedRecords.push({
      index: index + 1,
      reason: `Item code not found: ${itemCode}`,
      record: record
    });
    return;
  }

  const companyId = companyMapping[companyName];
  if (!companyId) {
    skippedRecords.push({
      index: index + 1,
      reason: `Company not found: ${companyName}`,
      record: record
    });
    return;
  }

  if (quantity === null || quantity === undefined || isNaN(quantity) || quantity < 0) {
    skippedRecords.push({
      index: index + 1,
      reason: 'Invalid quantity',
      record: record
    });
    return;
  }

  // Skip zero-quantity records (no delivery)
  if (quantity === 0) {
    skippedRecords.push({
      index: index + 1,
      reason: 'Zero quantity (no delivery)',
      record: record
    });
    return;
  }

  // Generate transaction_no
  const transactionNo = `IN-2025-${String(recordNo).padStart(4, '0')}`;

  transformedRecords.push({
    transaction_no: transactionNo,
    transaction_date: '2025-01-15', // Default date (adjust if needed)
    transaction_type: '입고',
    item_id: itemId,
    item_code: itemCode,
    company_id: companyId,
    company_name: companyName,
    quantity: quantity,
    unit_price: null, // Will be set from price_master if available
    total_amount: null, // Will be calculated
    notes: record['Part Name'] || null,
    status: 'COMPLETED'
  });

  recordNo++;
});

console.log(`\n변환 완료:`);
console.log(`- 성공: ${transformedRecords.length}개`);
console.log(`- 건너뜀: ${skippedRecords.length}개`);

// Save results
fs.writeFileSync(
  path.join(dataDir, 'inbound-transformed.json'),
  JSON.stringify({
    total: transformedRecords.length,
    records: transformedRecords
  }, null, 2)
);

fs.writeFileSync(
  path.join(dataDir, 'inbound-skipped.json'),
  JSON.stringify({
    total: skippedRecords.length,
    records: skippedRecords
  }, null, 2)
);

console.log('\n파일 저장 완료:');
console.log('- inbound-transformed.json: 변환된 레코드');
console.log('- inbound-skipped.json: 건너뛴 레코드');
