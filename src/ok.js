// =====================================================================
// 1. CẤU HÌNH THÔNG TIN TÀI KHOẢN
// =====================================================================
const CLIENT_ID = '9e5f94bc-e8a4-4e73-b8be-63364c29d753';
const REFRESH_TOKEN = 'M.C544_SN1.0.U.MsaArtifacts.-Cvy!Xv2lJdMHcOFDf5Wjx*IeTmh!hnA91zlU5qTgwAp8p6ag3cQBbbcJP0lXl6S!x9us7eQR3iaFm*NcDXkfnnqWbV5tEsP09BeOKK9i0nBFMXEelHERjbeu8UWOcTVehA5VkwYD361ohewfERbrsDnJm3A5gc!ft7sUTxafD6ZZuYOeR0Z9wGgq9Z1Z4K0e1Vat6z3jeGX1rZTPE8g7652nIfCHj0Qfdg*5Xk2PlZ*qiPyJfvO5VxPjkYSyfb!A8V6MAp!*hvmYMCwyafFBQBSLwiQVHt!DqCGsZMqpz1KsiuHMoLA2Q5r*6Y*AX60!CNbshpgmWoyFpbOKc9golJD3y5yy3BgIy*oXVm*fjkWnpJKBaI2WjT8Bwj0k*19ID!JebS25Ouy4VtJecvzCMAsPotttWgaIRc6wviCJcY2YEaeWdwrtnYwD4daG3aCt38UrNivlwjsJBeHGkck5cn4$';


// =====================================================================
// 2. LẤY ACCESS TOKEN
// =====================================================================
async function getNewAccessToken() {
    console.log('🔄 Đang kiểm tra Refresh Token và xin cấp Access Token mới...');
    
    const payload = new URLSearchParams({
        client_id: CLIENT_ID,
        refresh_token: REFRESH_TOKEN,
        grant_type: 'refresh_token'
    });

    try {
        const response = await fetch('https://login.live.com/oauth20_token.srf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: payload
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ Lấy Access Token thành công!');
            return data.access_token;
        } else {
            console.error('❌ LỖI! Không thể lấy Token:', data);
            return null;
        }
    } catch (error) {
        console.error('⚠️ Lỗi kết nối khi lấy Token:', error);
        return null;
    }
}


// =====================================================================
// 3. LẤY DANH SÁCH THƯ BẰNG OUTLOOK REST API
// =====================================================================
async function listEmails(accessToken, folder = 'inbox') {
    // Đã đổi link sang outlook.office.com và viết hoa chữ cái đầu các trường (Id, Subject...)
    const endpoint = `https://outlook.office.com/api/v2.0/me/MailFolders/${folder}/messages?$select=Id,Subject,From,ReceivedDateTime&$top=5`;

    try {
        console.log(`\n📬 Đang tải danh sách thư từ thư mục: [${folder.toUpperCase()}]...`);
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`✅ Đã tìm thấy ${data.value.length} thư:`);
            data.value.forEach((msg, index) => {
                // Biến msg lấy từ Outlook API sẽ viết hoa chữ cái đầu
                console.log(`${index + 1}. [${msg.ReceivedDateTime}] Từ: ${msg.From.EmailAddress.Address}`);
                console.log(`   Tiêu đề: ${msg.Subject}`);
            });
            return data.value; 
        } else {
            console.error('❌ Lỗi khi lấy danh sách thư:', data);
            return [];
        }
    } catch (error) {
        console.error('⚠️ Lỗi kết nối khi tải danh sách thư:', error);
        return [];
    }
}


// =====================================================================
// 4. ĐỌC CHI TIẾT NỘI DUNG MỘT BỨC THƯ
// =====================================================================
async function readSpecificEmail(accessToken, messageId) {
    const endpoint = `https://outlook.office.com/api/v2.0/me/messages/${messageId}?$select=Subject,Body`;

    try {
        console.log('\n📖 Đang mở nội dung chi tiết của bức thư...');
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok) {
            console.log('--------------------------------------------------');
            console.log(`📌 TIÊU ĐỀ: ${data.Subject}`);
            console.log('--------------------------------------------------');
            // Nội dung lấy từ Body.Content
            console.log(data.Body.Content);
            console.log('--------------------------------------------------');
        } else {
            console.error('❌ Lỗi khi đọc thư chi tiết:', data);
        }
    } catch (error) {
        console.error('⚠️ Lỗi kết nối khi đọc thư:', error);
    }
}


// =====================================================================
// 5. CHẠY CHƯƠNG TRÌNH
// =====================================================================
async function main() {
    const accessToken = await getNewAccessToken();
    if (!accessToken) return;

    // Lấy thư từ inbox
    const inboxMails = await listEmails(accessToken, 'inbox');

    // Nếu có thư, tự động chọn bức thư đầu tiên trên cùng để đọc
    if (inboxMails.length > 0) {
        const firstMailId = inboxMails[0].Id; // Thuộc tính Id viết hoa
        await readSpecificEmail(accessToken, firstMailId);
    } else {
        console.log('\n📭 Hộp thư này hiện không có thư nào.');
    }
}

main();