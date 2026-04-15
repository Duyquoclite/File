# TCP Client – Server (giải thích từng dòng)

Chạy **Server** trước, sau đó chạy **Client**. Cổng mặc định: **5050**.

---

## `Server.cs`


| Dòng | Giải thích                                                                                                                                                |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `using System.Globalization` — dùng `CultureInfo` khi đổi chữ thường → hoa theo văn hóa hệ thống (tiếng Việt, v.v.).                                      |
| 2    | `using System.Net` — chứa `IPAddress` để server lắng nghe trên mọi địa chỉ IP của máy.                                                                    |
| 3    | `using System.Net.Sockets` — chứa `TcpListener`, `TcpClient` cho lập trình socket TCP.                                                                    |
| 4    | `using System.Text` — chứa `Encoding.UTF8` để đọc/ghi chuỗi Unicode (tiếng Việt) đúng trên luồng mạng.                                                    |
| 5    | Dòng trống — tách khối `using` và phần khai báo lớp.                                                                                                      |
| 6    | `class Program` — lớp chứa điểm vào `Main` của chương trình Server.                                                                                       |
| 7    | `{` — bắt đầu thân lớp `Program`.                                                                                                                         |
| 8    | `const int Port = 5050` — hằng số cổng TCP server mở để client kết nối.                                                                                   |
| 9    | `const string ExitToken = "Thoát"` — chuỗi nhận diện lệnh thoát (so sánh không phân biệt hoa thường ở dưới).                                              |
| 10   | `const st`erver trả lời theo yêu cầu đề bài.`ring CnttToken = "CNTT"` — chuỗi đặc biệt để s                                                               |
| 11   | Dòng trống.                                                                                                                                               |
| 12   | `static async Task Main()` — hàm nhập chương trình: `async` để dùng `await` với thao tác mạng không chặn luồng.                                           |
| 13   | `{` — bắt đầu thân `Main`.                                                                                                                                |
| 14   | `var listener = new TcpListener(IPAddress.Any, Port)` — tạo đối tượng lắng nghe TCP trên mọi card mạng, cổng `Port`.                                      |
| 15   | `listener.Start()` — bắt đầu chấp nhận kết nối đến cổng đã cấu hình.                                                                                      |
| 16   | `Console.WriteLine(...)` — in thông báo server đang chạy và cổng đang dùng.                                                                               |
| 17   | Dòng trống.                                                                                                                                               |
| 18   | `try` — khối xử lý chính; kết hợp `finally` để luôn dừng listener khi thoát.                                                                              |
| 19   | `{` — bắt đầu khối `try`.                                                                                                                                 |
| 20   | `using var tcpClient = await listener.AcceptTcpClientAsync()` — chờ (bất đồng bộ) một client kết nối; `using` giải phóng socket khi hết phạm vi.          |
| 21   | `listener.Stop()` — ngừng nhận thêm kết nối mới (chỉ phục vụ một client như mô hình đề bài).                                                              |
| 22   | `Console.WriteLine("Đã có Client kết nối.")` — báo đã có client.                                                                                          |
| 23   | Dòng trống.                                                                                                                                               |
| 24   | `await using var stream = tcpClient.GetStream()` — lấy luồng byte hai chiều trên kết nối; `await using` đóng/giải phóng đúng cách với `IAsyncDisposable`. |
| 25   | `using var reader = new StreamReader(...)` — bọc luồng bằng bộ đọc văn bản UTF-8; `leaveOpen: false` để khi hủy reader thì đóng luồng gốc.                |
| 26   | `await using var writer = new StreamWriter(...)` — bộ ghi văn bản UTF-8; `AutoFlush = true` gửi ngay mỗi dòng xuống mạng không cần `Flush` thủ công.      |
| 27   | Dòng trống.                                                                                                                                               |
| 28   | `while (true)` — vòng lặp vô hạn: xử lý từng dòng client gửi đến khi thoát hoặc đóng kết nối.                                                             |
| 29   | `{` — bắt đầu thân vòng lặp.                                                                                                                              |
| 30   | `var line = await reader.ReadLineAsync()` — đọc một dòng văn bản từ client (kết thúc bằng xuống dòng).                                                    |
| 31   | `if (line is null)` — nếu client đóng kết nối, `ReadLine` trả về `null`.                                                                                  |
| 32   | `break` — thoát vòng lặp xử lý tin nhắn.                                                                                                                  |
| 33   | Dòng trống.                                                                                                                                               |
| 34   | `var trimmed = line.Trim()` — bỏ khoảng trắng đầu/cuối dòng (ví dụ `" Thoát "`).                                                                          |
| 35   | `if (string.Equals(trimmed, ExitToken, StringComparison.OrdinalIgnoreCase))` — nếu dòng (sau trim) là lệnh thoát, không phân biệt hoa thường.             |
| 36   | `{` — bắt đầu nhánh thoát.                                                                                                                                |
| 37   | `await writer.WriteLineAsync("Tạm biệt.")` — gửi một dòng chào client trước khi đóng.                                                                     |
| 38   | `break` — thoát vòng `while`, server kết thúc xử lý session.                                                                                              |
| 39   | `}` — kết thúc nhánh thoát.                                                                                                                               |
| 40   | Dòng trống.                                                                                                                                               |
| 41   | `if (string.Equals(trimmed, CnttToken, StringComparison.Ordinal))` — nếu đúng chuỗi `CNTT` (phân biệt hoa thường).                                        |
| 42   | `{` — bắt đầu nhánh CNTT.                                                                                                                                 |
| 43   | `var reply = " Xin chào Khoa " + "CNTT"` — tạo câu trả lời bằng **phép cộng chuỗi** như yêu cầu đề bài.                                                   |
| 44   | `await writer.WriteLineAsync(reply)` — gửi câu trả lời cho client.                                                                                        |
| 45   | `continue` — quay lần lặp tiếp, chờ dòng tiếp theo.                                                                                                       |
| 46   | `}` — kết thúc nhánh CNTT.                                                                                                                                |
| 47   | Dòng trống.                                                                                                                                               |
| 48   | `var upper = trimmed.ToUpper(CultureInfo.CurrentCulture)` — đổi cả dòng thành chữ hoa theo văn hóa hiện tại (trường hợp “dòng ký tự bất kỳ”).             |
| 49   | `await writer.WriteLineAsync(upper)` — gửi kết quả chữ hoa về client.                                                                                     |
| 50   | `}` — kết thúc vòng `while`.                                                                                                                              |
| 51   | `}` — kết thúc khối `try`.                                                                                                                                |
| 52   | `finally` — luôn chạy dù `try` kết thúc bình thường hay có lỗi.                                                                                           |
| 53   | `{` — bắt đầu `finally`.                                                                                                                                  |
| 54   | `listener.Stop()` — đảm bảo dừng lắng nghe (an toàn nếu chưa gọi `Stop` trước đó).                                                                        |
| 55   | `}` — kết thúc `finally`.                                                                                                                                 |
| 56   | Dòng trống.                                                                                                                                               |
| 57   | `Console.WriteLine("Server đã thoát.")` — thông báo chương trình server kết thúc.                                                                         |
| 58   | `}` — kết thúc `Main`.                                                                                                                                    |
| 59   | `}` — kết thúc lớp `Program`.                                                                                                                             |
| 60   | Dòng trống — kết file (một số editor thêm dòng cuối).                                                                                                     |


---

## `Client.cs`


| Dòng | Giải thích                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------------- |
| 1    | `using System.Net.Sockets` — `TcpClient`, `SocketException` cho kết nối TCP.                                |
| 2    | `using System.Text` — `Encoding.UTF8` cho đọc/ghi chuỗi trên luồng.                                         |
| 3    | Dòng trống.                                                                                                 |
| 4    | `class Program` — lớp chứa điểm vào chương trình Client.                                                    |
| 5    | `{` — bắt đầu thân lớp.                                                                                     |
| 6    | `const int Port = 5050` — cổng phải **trùng** với Server.                                                   |
| 7    | `const string ExitToken = "Thoát"` — cùng quy ước thoát với Server.                                         |
| 8    | Dòng trống.                                                                                                 |
| 9    | `static async Task Main()` — nhập chương trình, bất đồng bộ cho kết nối và đọc/ghi mạng.                    |
| 10   | `{` — bắt đầu `Main`.                                                                                       |
| 11   | `Console.Write("Nhập địa chỉ Server...")` — nhắc người dùng nhập IP/hostname (Enter = máy cục bộ).          |
| 12   | `var host = Console.ReadLine()` — đọc một dòng từ bàn phím làm địa chỉ server.                              |
| 13   | `if (string.IsNullOrWhiteSpace(host))` — nếu không gõ gì hoặc chỉ khoảng trắng.                             |
| 14   | `host = "127.0.0.1"` — mặc định kết nối localhost.                                                          |
| 15   | Dòng trống.                                                                                                 |
| 16   | `using var tcpClient = new TcpClient()` — tạo client TCP; `using` giải phóng khi hết `Main`.                |
| 17   | `try` — bọc `ConnectAsync` để bắt lỗi kết nối.                                                              |
| 18   | `{` — bắt đầu `try`.                                                                                        |
| 19   | `await tcpClient.ConnectAsync(host.Trim(), Port)` — kết nối tới server tại `host` (đã trim) và cổng `Port`. |
| 20   | `}` — kết thúc `try`.                                                                                       |
| 21   | `catch (SocketException ex)` — bắt lỗi socket (server chưa chạy, sai cổng, chặn tường lửa, v.v.).           |
| 22   | `{` — bắt đầu `catch`.                                                                                      |
| 23   | `Console.WriteLine($"... {ex.Message}")` — in lý do lỗi cho người dùng.                                     |
| 24   | `return` — kết thúc chương trình Client vì không có kết nối.                                                |
| 25   | `}` — kết thúc `catch`.                                                                                     |
| 26   | Dòng trống.                                                                                                 |
| 27   | `Console.WriteLine(...)` — báo đã kết nối và nhắc cú pháp thoát.                                            |
| 28   | Dòng trống.                                                                                                 |
| 29   | `await using var stream = tcpClient.GetStream()` — luồng byte trên kết nối đã thiết lập.                    |
| 30   | `using var reader = new StreamReader(...)` — đọc dòng văn bản UTF-8 từ server.                              |
| 31   | `await using var writer = new StreamWriter(...)` — ghi dòng văn bản UTF-8 lên server, `AutoFlush` gửi ngay. |
| 32   | Dòng trống.                                                                                                 |
| 33   | `while (true)` — lặp: nhập từ console → gửi server → nhận phản hồi → in.                                    |
| 34   | `{` — bắt đầu vòng lặp.                                                                                     |
| 35   | `Console.Write("> ")` — prompt nhập lệnh/dòng chữ.                                                          |
| 36   | `var input = Console.ReadLine()` — đọc dòng người dùng gõ.                                                  |
| 37   | `if (input is null)` — hết stdin (ví dụ Ctrl+Z trên Windows) → `null`.                                      |
| 38   | `break` — thoát vòng lặp.                                                                                   |
| 39   | Dòng trống.                                                                                                 |
| 40   | `var trimmed = input.Trim()` — chuẩn hóa giống phía server (đặc biệt cho `CNTT` / `Thoát`).                 |
| 41   | `await writer.WriteLineAsync(trimmed)` — gửi dòng đã trim tới server (kèm ký tự xuống dòng).                |
| 42   | Dòng trống.                                                                                                 |
| 43   | `if (string.Equals(trimmed, ExitToken, StringComparison.OrdinalIgnoreCase))` — nếu người dùng chọn thoát.   |
| 44   | `{` — nhánh thoát.                                                                                          |
| 45   | `var farewell = await reader.ReadLineAsync()` — đọc dòng “Tạm biệt.” server gửi lại.                        |
| 46   | `if (farewell is not null)` — chỉ in nếu có dữ liệu.                                                        |
| 47   | `Console.WriteLine(farewell)` — hiển thị lời chào từ server.                                                |
| 48   | `break` — thoát vòng lặp; sau đó in “Client đã thoát.”.                                                     |
| 49   | `}` — kết thúc nhánh thoát.                                                                                 |
| 50   | Dòng trống.                                                                                                 |
| 51   | `var response = await reader.ReadLineAsync()` — đọc phản hồi bình thường (chữ hoa hoặc câu CNTT).           |
| 52   | `if (response is null)` — server đóng kết nối đột ngột.                                                     |
| 53   | `{` — nhánh lỗi/đóng sớm.                                                                                   |
| 54   | `Console.WriteLine("Server đã đóng kết nối.")` — thông báo cho người dùng.                                  |
| 55   | `break` — thoát vòng lặp.                                                                                   |
| 56   | `}` — kết thúc nhánh `response == null`.                                                                    |
| 57   | Dòng trống.                                                                                                 |
| 58   | `Console.WriteLine(response)` — in nội dung server trả về ra màn hình.                                      |
| 59   | `}` — kết thúc vòng `while`.                                                                                |
| 60   | Dòng trống.                                                                                                 |
| 61   | `Console.WriteLine("Client đã thoát.")` — thông báo kết thúc chương trình Client.                           |
| 62   | `}` — kết thúc `Main`.                                                                                      |
| 63   | `}` — kết thúc lớp `Program`.                                                                               |
| 64   | Dòng trống — kết file.                                                                                      |


---

## Gợi ý chạy thử

1. Biên dịch/chạy **Server** (ví dụ đặt `Server.cs` làm `Program.cs` trong một project Console).
2. Biên dịch/chạy **Client** trong project Console khác.
3. Gõ thử: `hello` → client in `HELLO`; gõ `CNTT` → in  `Xin chào Khoa CNTT`; gõ `Thoát` (có thể thêm khoảng trắng) → cả hai phía kết thúc.

