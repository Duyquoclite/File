const fs = require('fs');
const path = require('path');

console.log("====================================================================");
console.log("     BẮT ĐẦU DỌN DẸP HỆ THỐNG VÀ GIẢI PHÓNG Ổ C (NODE.JS)");
console.log("====================================================================");

// Lấy đường dẫn động từ hệ thống của VPS/Máy chủ
const userProfile = process.env.USERPROFILE || process.env.HOMEPATH || 'C:\\Users\\Admin';
const systemRoot = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
const tempDir = process.env.TEMP || process.env.TMP;

const foldersToClear = [
    path.join(systemRoot, 'Temp'),
    tempDir,
    path.join(systemRoot, 'SoftwareDistribution', 'Download'),
    path.join(systemRoot, 'SoftwareDistribution', 'DeliveryOptimization'),
    path.join(systemRoot, 'Logs'),
    path.join(systemRoot, 'Minidump'),
    path.join(userProfile, 'AppData', 'Local', 'CrashDumps'),
    path.join(systemRoot, 'Prefetch'),
    path.join(userProfile, '.cache', 'puppeteer'),
    path.join(userProfile, 'AppData', 'Local', 'npm-cache'),
    path.join(userProfile, 'AppData', 'Local', 'pip', 'cache'),
    path.join(userProfile, '.nuget', 'packages')
].filter(Boolean);

/**
 * Hàm đệ quy dọn sạch nội dung bên trong thư mục
 * Bỏ qua các tệp tin đang bị hệ thống hoặc ứng dụng khác khóa (in-use) để tránh crash.
 */
function cleanDirectoryContents(dirPath) {
    if (!fs.existsSync(dirPath)) return;

    let files;
    try {
        files = fs.readdirSync(dirPath);
    } catch (err) {
        // Tránh in log lỗi nếu không có quyền truy cập một số thư mục hệ thống
        return;
    }

    for (const file of files) {
        const curPath = path.join(dirPath, file);
        try {
            const stat = fs.lstatSync(curPath);
            if (stat.isDirectory()) {
                cleanDirectoryContents(curPath);
                fs.rmdirSync(curPath); // Xóa thư mục con sau khi đã dọn rỗng
            } else {
                fs.unlinkSync(curPath); // Xóa file
            }
        } catch (err) {
            // File hoặc thư mục đang được Windows sử dụng, bỏ qua an toàn
        }
    }
}

let successCount = 0;
foldersToClear.forEach(folder => {
    // Chuẩn hóa đường dẫn để tránh lỗi ký tự Windows
    const targetFolder = path.resolve(folder);
    if (fs.existsSync(targetFolder)) {
        console.log(`🧹 Đang dọn dẹp: ${targetFolder}`);
        try {
            cleanDirectoryContents(targetFolder);
            successCount++;
        } catch (err) {
            console.log(`⚠️ Bỏ qua/Lỗi khi xử lý: ${targetFolder} (${err.message})`);
        }
    }
});

console.log("====================================================================");
console.log(`🎉 HOÀN TẤT! Đã quét và dọn dẹp ${successCount} vùng thư mục rác hệ thống.`);
console.log("====================================================================");
