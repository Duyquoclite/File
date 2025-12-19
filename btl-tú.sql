CREATE DATABASE IF NOT EXISTS QuanLyBenhAnDienTu;
USE QuanLyBenhAnDienTu;

CREATE TABLE Nguoi (
    MaNguoi INT PRIMARY KEY AUTO_INCREMENT,
    HoTen NVARCHAR(100) NOT NULL,
    NgaySinh DATE,
    GioiTinh NVARCHAR(10),
    SoDienThoai VARCHAR(20),
    Email VARCHAR(100),
    DiaChi NVARCHAR(200),
    CCCD VARCHAR(20) UNIQUE NOT NULL,
    NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE BenhNhan (
    MaBenhNhan INT PRIMARY KEY AUTO_INCREMENT,
    MaNguoi INT NOT NULL UNIQUE,
    TienSuBenhAn NVARCHAR(1000)
);

CREATE TABLE BacSi (
    MaBacSi INT PRIMARY KEY AUTO_INCREMENT,
    MaNguoi INT NOT NULL UNIQUE,
    ChuyenKhoa NVARCHAR(100)
);

CREATE TABLE NguoiGiamHo (
    MaNguoiGiamHo INT PRIMARY KEY AUTO_INCREMENT,
    MaNguoi INT NOT NULL,
    MaBenhNhan INT NOT NULL,
    QuanHe NVARCHAR(50)
);

CREATE TABLE HoSoBenhAn (
    MaHoSo INT PRIMARY KEY AUTO_INCREMENT,
    MaBenhNhan INT NOT NULL,
    NgayNhapVien DATE NOT NULL,
    NgayXuatVien DATE,
    ChanDoan NVARCHAR(500),
    PhuongAnDieuTri NVARCHAR(1000),
    KetQua NVARCHAR(500)
);

CREATE TABLE LichSuKham (
    MaLichSuKham INT PRIMARY KEY AUTO_INCREMENT,
    MaBenhNhan INT NOT NULL,
    MaBacSi INT NOT NULL,
    NgayGioKham DATETIME NOT NULL
);

CREATE TABLE LoaiThuoc (
    MaThuoc INT PRIMARY KEY AUTO_INCREMENT,
    TenThuoc NVARCHAR(200) NOT NULL,
    HangSanXuat NVARCHAR(200)
);

CREATE TABLE DonThuoc (
    MaDon INT PRIMARY KEY AUTO_INCREMENT,
    MaBacSi INT NOT NULL,
    MaBenhNhan INT NOT NULL,
    NgayKeDon DATE NOT NULL
);

CREATE TABLE ChiTietDonThuoc (
    MaChiTiet INT PRIMARY KEY AUTO_INCREMENT,
    MaDon INT NOT NULL,
    MaThuoc INT NOT NULL,
    LieuDung NVARCHAR(500) NOT NULL
);

CREATE TABLE DichVuYTe (
    MaDichVu INT PRIMARY KEY AUTO_INCREMENT,
    TenDichVu NVARCHAR(200) NOT NULL,
    ChiPhi DECIMAL(15, 2) NOT NULL
);

CREATE TABLE BenhNhanSuDungDichVu (
    MaSuDung INT PRIMARY KEY AUTO_INCREMENT,
    MaBenhNhan INT NOT NULL,
    MaDichVu INT NOT NULL,
    NgaySuDung DATE NOT NULL
);

ALTER TABLE BenhNhan
ADD CONSTRAINT FK_BenhNhan_Nguoi
FOREIGN KEY (MaNguoi) REFERENCES Nguoi(MaNguoi);

ALTER TABLE BacSi
ADD CONSTRAINT FK_BacSi_Nguoi
FOREIGN KEY (MaNguoi) REFERENCES Nguoi(MaNguoi);

ALTER TABLE NguoiGiamHo
ADD CONSTRAINT FK_NguoiGiamHo_Nguoi
FOREIGN KEY (MaNguoi) REFERENCES Nguoi(MaNguoi);

ALTER TABLE NguoiGiamHo
ADD CONSTRAINT FK_NguoiGiamHo_BenhNhan
FOREIGN KEY (MaBenhNhan) REFERENCES BenhNhan(MaBenhNhan);

ALTER TABLE HoSoBenhAn
ADD CONSTRAINT FK_HoSoBenhAn_BenhNhan
FOREIGN KEY (MaBenhNhan) REFERENCES BenhNhan(MaBenhNhan);

ALTER TABLE LichSuKham
ADD CONSTRAINT FK_LichSuKham_BenhNhan
FOREIGN KEY (MaBenhNhan) REFERENCES BenhNhan(MaBenhNhan);

ALTER TABLE LichSuKham
ADD CONSTRAINT FK_LichSuKham_BacSi
FOREIGN KEY (MaBacSi) REFERENCES BacSi(MaBacSi);

ALTER TABLE DonThuoc
ADD CONSTRAINT FK_DonThuoc_BacSi
FOREIGN KEY (MaBacSi) REFERENCES BacSi(MaBacSi);

ALTER TABLE DonThuoc
ADD CONSTRAINT FK_DonThuoc_BenhNhan
FOREIGN KEY (MaBenhNhan) REFERENCES BenhNhan(MaBenhNhan);

ALTER TABLE ChiTietDonThuoc
ADD CONSTRAINT FK_ChiTietDonThuoc_DonThuoc
FOREIGN KEY (MaDon) REFERENCES DonThuoc(MaDon);

ALTER TABLE ChiTietDonThuoc
ADD CONSTRAINT FK_ChiTietDonThuoc_LoaiThuoc
FOREIGN KEY (MaThuoc) REFERENCES LoaiThuoc(MaThuoc);

ALTER TABLE BenhNhanSuDungDichVu
ADD CONSTRAINT FK_BenhNhanSuDungDichVu_BenhNhan
FOREIGN KEY (MaBenhNhan) REFERENCES BenhNhan(MaBenhNhan);

ALTER TABLE BenhNhanSuDungDichVu
ADD CONSTRAINT FK_BenhNhanSuDungDichVu_DichVuYTe
FOREIGN KEY (MaDichVu) REFERENCES DichVuYTe(MaDichVu);

INSERT INTO Nguoi (HoTen, NgaySinh, GioiTinh, SoDienThoai, Email, DiaChi, CCCD) VALUES
('Nguyễn Văn A', '1980-05-15', 'Nam', '0912345678', 'bs.nguyenvana@hospital.com', '123 Đường ABC, Quận 1, TP.HCM', '001234567890'),
('Trần Thị B', '1985-08-20', 'Nữ', '0912345679', 'bs.tranthib@hospital.com', '456 Đường XYZ, Quận 2, TP.HCM', '001234567891'),
('Lê Văn C', '1982-03-10', 'Nam', '0912345680', 'bs.levanc@hospital.com', '789 Đường DEF, Quận 3, TP.HCM', '001234567892'),
('Nguyễn Thị D', '1990-01-15', 'Nữ', '0987654321', 'nguyenthid@email.com', '123 Đường ABC, Quận 1, TP.HCM', '012345678901'),
('Trần Văn E', '1985-06-20', 'Nam', '0987654322', 'tranvane@email.com', '456 Đường XYZ, Quận 2, TP.HCM', '012345678902'),
('Lê Thị F', '1995-11-30', 'Nữ', '0987654323', 'lethif@email.com', '789 Đường DEF, Quận 3, TP.HCM', '012345678903'),
('Nguyễn Văn G', '1965-03-20', 'Nam', '0987654324', 'nguyenvang@email.com', '123 Đường ABC, Quận 1, TP.HCM', '012345678904'),
('Trần Thị H', '1970-07-15', 'Nữ', '0987654325', 'tranthih@email.com', '456 Đường XYZ, Quận 2, TP.HCM', '012345678905');

INSERT INTO BacSi (MaNguoi, ChuyenKhoa) VALUES
(1, 'Khoa Nội'),
(2, 'Khoa Ngoại'),
(3, 'Khoa Nhi');

INSERT INTO BenhNhan (MaNguoi, TienSuBenhAn) VALUES
(4, 'Tiền sử dị ứng thuốc kháng sinh'),
(5, 'Tiền sử cao huyết áp'),
(6, 'Không có tiền sử bệnh lý');

INSERT INTO NguoiGiamHo (MaNguoi, MaBenhNhan, QuanHe) VALUES
(7, 1, 'Cha'),
(8, 2, 'Mẹ');

INSERT INTO LoaiThuoc (TenThuoc, HangSanXuat) VALUES
('Paracetamol 500mg', 'Công ty Dược phẩm A'),
('Amoxicillin 500mg', 'Công ty Dược phẩm B'),
('Ibuprofen 400mg', 'Công ty Dược phẩm C'),
('Vitamin C 1000mg', 'Công ty Dược phẩm D');

INSERT INTO DichVuYTe (TenDichVu, ChiPhi) VALUES
('Xét nghiệm máu tổng quát', 200000),
('Xét nghiệm đường huyết', 50000),
('Xét nghiệm chức năng gan', 300000),
('Xét nghiệm nước tiểu', 80000),
('Chụp X-quang ngực', 150000),
('Siêu âm bụng', 200000);

INSERT INTO HoSoBenhAn (MaBenhNhan, NgayNhapVien, NgayXuatVien, ChanDoan, PhuongAnDieuTri, KetQua) VALUES
(1, '2024-01-15', '2024-01-20', 'Cảm cúm thông thường', 'Nghỉ ngơi, uống thuốc hạ sốt, bổ sung nước', 'Đã khỏi'),
(2, '2024-01-16', '2024-01-18', 'Viêm phế quản', 'Điều trị bằng kháng sinh, nghỉ ngơi', 'Đang điều trị'),
(3, '2024-01-17', NULL, 'Khám sức khỏe định kỳ', 'Theo dõi định kỳ', 'Sức khỏe tốt');

INSERT INTO LichSuKham (MaBenhNhan, MaBacSi, NgayGioKham) VALUES
(1, 1, '2024-01-15 08:00:00'),
(1, 1, '2024-01-20 09:00:00'),
(2, 2, '2024-01-16 10:00:00'),
(3, 1, '2024-01-17 14:00:00');

INSERT INTO DonThuoc (MaBacSi, MaBenhNhan, NgayKeDon) VALUES
(1, 1, '2024-01-15'),
(2, 2, '2024-01-16'),
(1, 3, '2024-01-17');

INSERT INTO ChiTietDonThuoc (MaDon, MaThuoc, LieuDung) VALUES
(1, 1, 'Uống 1 viên mỗi 6 giờ khi sốt'),
(1, 4, 'Uống 1 viên mỗi ngày'),
(2, 2, 'Uống 1 viên sau ăn, ngày 2 lần'),
(2, 3, 'Uống 1 viên sau ăn, ngày 2 lần'),
(3, 4, 'Uống 1 viên mỗi ngày');

INSERT INTO BenhNhanSuDungDichVu (MaBenhNhan, MaDichVu, NgaySuDung) VALUES
(1, 1, '2024-01-15'),
(1, 2, '2024-01-15'),
(2, 1, '2024-01-16'),
(2, 3, '2024-01-16'),
(3, 1, '2024-01-17');
