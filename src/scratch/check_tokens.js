const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'note2.txt');
if (!fs.existsSync(filePath)) {
  console.error("Không tìm thấy file note2.txt");
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split(/\r?\n/);

async function checkToken(token, clientId) {
  const payload = new URLSearchParams({
    client_id: clientId,
    refresh_token: token,
    grant_type: 'refresh_token'
  });

  try {
    const response = await fetch('https://login.live.com/oauth20_token.srf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload
    });

    const data = await response.json();
    if (response.ok && data.access_token) {
      return { success: true };
    } else {
      return { success: false, error: data.error_description || JSON.stringify(data) };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function run() {
  console.log("=== BẮT ĐẦU KIỂM TRA TOKENS TRONG NOTE2.TXT ===");
  let index = 1;
  let liveCount = 0;
  let dieCount = 0;

  const liveLines = [];
  const dieLines = [];

  for (let line of lines) {
    const rawLine = line;
    line = line.trim();
    if (!line) continue;

    const parts = line.split('|');
    const emailIdx = parts.findIndex(p => p.includes('@'));
    const email = emailIdx !== -1 ? parts[emailIdx].trim() : 'Không rõ email';

    // Trích xuất token
    let token = '';
    const matchToken = line.match(/RefreshToken=([^$|\s|]+)/) || line.match(/(M\.C[^\s|]+)/);
    if (matchToken) {
      token = matchToken[1];
    }

    // Trích xuất client ID dạng GUID
    let clientId = '9e5f94bc-e8a4-4e73-b8be-63364c29d753'; // Default client ID
    const guidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const matchGuid = line.match(guidRegex);
    if (matchGuid) {
      clientId = matchGuid[0];
    }

    if (!token) {
      console.log(`[Dòng ${index}] ${email} -> DIE (Không tìm thấy RefreshToken)`);
      dieLines.push(rawLine);
      dieCount++;
      index++;
      continue;
    }

    const checkResult = await checkToken(token, clientId);
    if (checkResult.success) {
      console.log(`[Dòng ${index}] ${email} -> LIVE`);
      liveLines.push(rawLine);
      liveCount++;
    } else {
      // Cắt gọn bớt thông báo lỗi nếu quá dài
      const shortError = checkResult.error.length > 80 ? checkResult.error.substring(0, 80) + '...' : checkResult.error;
      console.log(`[Dòng ${index}] ${email} -> DIE (${shortError})`);
      dieLines.push(rawLine);
      dieCount++;
    }

    index++;
    // Tránh spam quá nhanh
    await new Promise(r => setTimeout(r, 200));
  }

  // Ghi kết quả ra file riêng biệt
  const liveFilePath = path.join(__dirname, '..', 'note2_live.txt');
  const dieFilePath = path.join(__dirname, '..', 'note2_die.txt');

  fs.writeFileSync(liveFilePath, liveLines.join('\n'), 'utf-8');
  fs.writeFileSync(dieFilePath, dieLines.join('\n'), 'utf-8');

  console.log("\n=== KẾT QUẢ KIỂM TRA ===");
  console.log(`Tổng số: ${liveCount + dieCount}`);
  console.log(`LIVE: ${liveCount} (Đã ghi vào note2_live.txt)`);
  console.log(`DIE: ${dieCount} (Đã ghi vào note2_die.txt)`);
}

run();
