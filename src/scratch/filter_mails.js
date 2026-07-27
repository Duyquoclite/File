const fs = require('fs');
const path = require('path');

// Đường dẫn file đầu vào và đầu ra
const inputFile = path.join(__dirname, '..', 'note3.txt');
const outputFile = path.join(__dirname, '..', 'note3_filtered.txt');

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
  
  // Tìm vị trí của phần tử chứa email (có kí tự @)
  const emailIdx = parts.findIndex(p => p.includes('@'));
  if (emailIdx === -1) {
    continue;
  }

  const mail = parts[emailIdx].trim();
  
  // Phần tử tiếp theo chứa passmail, RefreshToken và ClientId
  const tokenPart = parts[emailIdx + 1] || '';
  if (!tokenPart.includes('RefreshToken=')) {
    continue;
  }

  // Tách passmail và phần còn lại
  const passSplit = tokenPart.split('RefreshToken=');
  const passmail = passSplit[0].trim();
  
  const tokenClientPart = passSplit[1] || '';
  let tokenmail = '';
  let clientid = '';

  // Tách tokenmail và clientid bằng ký tự $ClientId=
  if (tokenClientPart.includes('$ClientId=')) {
    const tokenClientSplit = tokenClientPart.split('$ClientId=');
    tokenmail = tokenClientSplit[0].trim();
    clientid = tokenClientSplit[1].trim();
  } else {
    tokenmail = tokenClientPart.trim();
  }

  result.push(`${mail}|${passmail}|${tokenmail}|${clientid}`);
}

fs.writeFileSync(outputFile, result.join('\n'), 'utf-8');
console.log(`==================================================`);
console.log(`Đã lọc thành công ${result.length} dòng mail!`);
console.log(`Kết quả đã được ghi vào file: ${outputFile}`);
console.log(`==================================================`);
