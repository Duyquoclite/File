const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '..', 'note3.txt');
const outputFile = path.join(__dirname, '..', 'note3_first_6.txt');

if (!fs.existsSync(inputFile)) {
  console.error(`Không tìm thấy file nguồn: ${inputFile}`);
  process.exit(1);
}

const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split(/\r?\n/);
const result = [];

for (let line of lines) {
  line = line.trim();
  if (!line) continue;

  const parts = line.split('|');
  
  // 1. Tìm email
  const emailIdx = parts.findIndex(p => p.includes('@'));
  if (emailIdx === -1) continue;
  const mail = parts[emailIdx].trim();

  // 2. Tìm password
  let passmail = (parts[emailIdx + 1] || '').trim();
  if (passmail.includes('RefreshToken=')) {
    passmail = passmail.split('RefreshToken=')[0].trim();
  }

  // 3. Tìm token (phần tử bắt đầu bằng M.C)
  let tokenmail = '';
  // Tìm trong tất cả các phần tử
  for (let part of parts) {
    const match = part.match(/(M\.C[^\s|$|]+)/);
    if (match) {
      tokenmail = match[1];
      break;
    }
  }

  // 4. Tìm clientid (phần tử khớp định dạng GUID)
  let clientid = '9e5f94bc-e8a4-4e73-b8be-63364c29d753'; // Mặc định
  const guidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  for (let part of parts) {
    const match = part.match(guidRegex);
    if (match) {
      clientid = match[0];
      break;
    }
  }

  if (mail && passmail && tokenmail) {
    result.push(`${mail}|${passmail}|${tokenmail}|${clientid}`);
  }

  // Chỉ lấy 6 dòng đầu tiên
  if (result.length === 6) {
    break;
  }
}

fs.writeFileSync(outputFile, result.join('\n'), 'utf-8');
console.log(`==================================================`);
console.log(`Đã lọc thành công ${result.length} dòng mail đầu tiên!`);
console.log(`Kết quả được ghi tại: ${outputFile}`);
console.log(`==================================================`);
