# Cấu trúc dự án và chú thích các file

Dưới đây là chú thích về toàn bộ các file và thư mục có trong dự án Quản Lý Khách Sạn.

## Thư mục gốc (`/`)

*   **`37_24004497_DINHVANPHONG_NHOM17_Bài thi.docx` / `.pdf`**: Các file tài liệu bài thi cuối kỳ môn Phân tích thiết kế hệ thống (định dạng Word và PDF).
*   **`37_NHOM17_Phiếu đánh giá.docx` / `.pdf`**: Các file tài liệu phiếu đánh giá của nhóm 17 (định dạng Word và PDF).
*   **`all_code.txt`**: File chứa toàn bộ mã nguồn của dự án, có thể được dùng để nộp bài hoặc lưu trữ nhanh.
*   **`generate_all_code.js`**: Script dùng để tự động gộp tất cả mã nguồn từ các file khác nhau lại và xuất ra file `all_code.txt`.
*   **`server.js`**: File chính (entry point) của ứng dụng backend Node.js, cấu hình Express, routing và middleware.
*   **`scrape.js`**: Script dùng để cào (scrape) dữ liệu từ các trang web bên ngoài (có thể là lấy dữ liệu các phòng khách sạn mẫu).
*   **`test_scrape.js`**: Script kiểm thử cho tính năng scraping ở trên.
*   **`test_booking.js`**: Script dùng để kiểm thử logic chức năng đặt phòng.
*   **`package.json`**: File cấu hình của dự án Node.js, chứa danh sách các thư viện (dependencies) và các script (như start, dev, v.v.).
*   **`package-lock.json`**: File khóa phiên bản của các thư viện (dependencies), đảm bảo mọi người đều cài đặt chính xác cùng một phiên bản thư viện.

## Các thư mục

### 1. `data/`
Thư mục lưu trữ dữ liệu dạng JSON.
*   **`rooms.json`**: Chứa dữ liệu của các phòng khách sạn (ví dụ: thông tin, giá cả, trạng thái) có thể là dữ liệu cào về được lưu dưới dạng JSON thay vì lưu vào DB, hoặc dùng để seed DB.

### 2. `database/`
Thư mục liên quan đến cơ sở dữ liệu.
*   **`schema.sql`**: Chứa các câu lệnh SQL để tạo cấu trúc cơ sở dữ liệu (tạo bảng, các ràng buộc, v.v.).

### 3. `public/`
Thư mục chứa các tài nguyên tĩnh (static assets) cung cấp trực tiếp cho client.
*   **`css/`**: Thư mục chứa các file CSS để định dạng giao diện cho trang web.

### 4. `views/`
Thư mục chứa các file giao diện được viết bằng EJS template engine (được server render thành HTML trả về cho client).
*   **`home.ejs`**: Trang chủ của ứng dụng.
*   **`rooms.ejs`**: Trang danh sách các phòng khách sạn.
*   **`room-detail.ejs`**: Trang chi tiết của một phòng cụ thể.
*   **`booking.ejs`**: Trang đặt phòng.
*   **`login.ejs`**: Trang đăng nhập.
*   **`admin.ejs`**: Trang quản trị dành cho admin.
*   **`contact.ejs`**: Trang liên hệ.
*   **`news.ejs`**: Trang tin tức.
*   **`partials/`**: Thư mục chứa các phần giao diện dùng chung (như header, footer) để include vào các trang ejs khác.

### 5. `node_modules/`
Thư mục chứa toàn bộ mã nguồn của các thư viện cài đặt từ npm (không cần quan tâm trong quá trình phát triển).
