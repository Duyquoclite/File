const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'note3_filtered.txt');
if (!fs.existsSync(filePath)) {
  console.error("Không tìm thấy file note3_filtered.txt");
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf-8');

// Tách các khối tài khoản bằng đường kẻ ---
const blocks = content.split(/------------------------------------------------/);
const outputBlocks = [];

for (const block of blocks) {
  const trimmed = block.trim();
  if (!trimmed) continue;

  const lines = trimmed.split(/\r?\n/);
  let uid = '';
  let cookieLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('tài khoản:')) {
      uid = line.replace('tài khoản:', '').trim();
    }
    if (line.startsWith('cookie:')) {
      cookieLineIndex = i;
    }
  }

  if (cookieLineIndex !== -1 && uid) {
    const rawCookieVal = lines[cookieLineIndex].replace('cookie:', '').trim();
    
    // Chỉ giữ lại các key cookie chuẩn của Facebook
    const allowedKeys = ['c_user', 'xs', 'fr', 'datr', 'sb', 'locale', 'presence', 'wd', 'dpr'];
    const foundCookies = {};

    // Tìm tất cả các cặp key=value trong chuỗi cookie thô
    const regex = /([a-zA-Z0-9_]+)=([^;|\s]+)/g;
    let match;
    while ((match = regex.exec(rawCookieVal)) !== null) {
      const key = match[1];
      const val = match[2];
      if (allowedKeys.includes(key)) {
        // Nếu là c_user thì phải khớp đúng với UID của tài khoản để tránh lẫn lộn
        if (key === 'c_user' && val !== uid) {
          continue;
        }
        foundCookies[key] = val;
      }
    }

    // Khôi phục lại chuỗi cookie sạch sẽ
    const cleanCookieStr = Object.entries(foundCookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    lines[cookieLineIndex] = `cookie: ${cleanCookieStr}`;
  }

  outputBlocks.push(lines.join('\n'));
}

const newContent = outputBlocks.join('\n------------------------------------------------\n\n') + '\n------------------------------------------------\n';
fs.writeFileSync(filePath, newContent, 'utf-8');
console.log("==================================================");
console.log("Đã làm sạch cookies thành công, loại bỏ thông tin lộ!");
console.log("==================================================");
