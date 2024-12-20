// Đầu tiên là cấu trúc code sử dụng hàm int main hoặc void main //
// Ví dụ
int main() {}
void main() {}
// Sự khác biệt giữa void mà int là void không thể trả về một giá trị còn int thì có

// Tiếp theo cần khai báo thư viện để sử dụng các hàm, không khai báo sẽ không dùng được //
#include <stdio.h> //sẽ có thể sử dụng hàm scanf, printf
#include <conio.h> //sẽ có thể sử dụng getch
#include <math.h>  //sẽ có thể sử dụng sin, cos, tan, pow

// Tìm hiểu về hàm và biến và mảng và chuỗi //
// int có thể khai báo biến, mảng, hàm

// char khai báo kí tự
char a = 'g';
// kiểu khai báo kí tự chỉ được dùng nháy đơn và 1 kí tự duy nhất, kí tự của biến a ở đây là g

// char khai báo chuỗi
char a[100];
// Để khai báo các văn bản trong 2 dấu "" với tối đa 100 kí tự, có thể thay đổi 100 bằng số khác hoặc
char a[] = "hello";
// Để khai báo trực tiếp mà không giới hạn kí tự
// Lưu í bạn không thể khai báo a[]; vì chỉ có khai báo trực tiếp mới có thể dùng cách này

// int khai báo biến
int a = 2;
// a ở đây là biến và int biến để khai báo số nguyên

// int khai báo mảng
int a[3];
// a ở đây là 1 mảng gồm 3 phần tử, có thể thay đổi
int a[3] = {"hello", "cac", "ban"};
// a ở đây đã được khai báo sẵn với 3 phần tử là chuỗi
int a[3] = {1, 2, 3};
// a ở đây đã được khai báo sẵn với 3 phần tử là số
// Bạn có thể dùng a[] để khai báo mảng trực tiếp không giới hạn phần tử như cách khai báo chuỗi

// int hoặc void khai báo hàm, các biến sẽ được truyền vào hàm hoặc không cần biến truyền vào ví dụ
int a(int b, int c)
{
    return b + c;
}
// Nếu ta dùng hàm a(1, 3) nó sẽ trả về 4 vì 2 phần tử này đã cộng với nhau

void a(int b, int c)
{
    // ở hàm void không thể trả về giá trị nào và không được khai báo dưới hàm main nên ít được sử dụng
    return b + c;        // nó sẽ lỗi nên không dùng return trong void
    printf("%d", b + c); // nó sẽ in ra giá trị
}

// float để khai báo số thực
float a = 1.1;
// a ở đây là số thực bằng 1.1

// double để khai báo số nguyên và số thực nhưng thuộc kiểu dữ liệu lớn
double a = 1000000000000000;
// Có thể thay thế cho int và float khi số quá lớn

// Tìm hiểu về xuất và nhập //
// Xuất thì ta sử dụng printf();
printf("hello");
// Các kiểu giá trị

// Giá trị là số nguyên thì dùng %d
// Giá trị là số thực thì dùng %f, mặc định ở đây %f là 6 số thập phân ví dụ 1 thì nó sẽ trả về 1.000000, có thể dùng %.2f nó sẽ làm tròn đến 2 chữ số thập phân hoặc số nào tùy chọn
// Giá trị là chuỗi thì dùng %s
// Giá trị là kí tự thì dùng %c

int a = 10;
float b = 10;
char c = '1';
char d[] = "10" printf("%d, %f, %c, %s", a, b, c, d);
// Áp dụng cấu trúc code ở trên để test code

// Nhập thì ta sử dụng scanf
// Bạn phải khai báo trước các biến và truyền vào giá trị
int a;
float b;
char c;
char d[];
// Chạy chương trình sau đó nhập vào phím
scanf("%d", &a);
scanf("%f", &b);
scanf("%c", &c);
scanf("%s", &c);
// Bạn khai báo kiểu dữ liệu như thế nào bạn phải nhập đúng như vậy không sẽ lỗi
// Khi scanf xong ta sẽ có các dữ liệu từ những thứ bạn nhập vào biến

// Toán tử //
// Toán tử phép toán
// +, -, *, /, ++, --
// lần lượt sẽ là cộng, trừ, nhân, chia, cộng 1, trừ 1

// Toán tử so sánh
// Sẽ trả về 1 hoặc 0 với 1 là đúng và 0 là sai
// >, <, ==, <=, >= lần lượt là lớn hơn, bé hơn, bằng, lớn hơn bằng, bé hơn bằng (đều đã học từ lớp 1)
int a = 1;
int b = 1;
    (a > b)  // trả về 0
    (a < b)  // trả về 0
    (a == b) // trả về 1
    (a <= b) // trả về 1
    (a >= b) // trả về 1
    // != là không bằng
    // && là và, có nghĩa 2 điều kiện cạnh dấu và đều phải đúng mới trả về 1 còn sai 1 trong 2 thì trả về 0
    // || là hoặc, có nghĩa là 1 trong 2 điều kiện đúng hoặc cả 2 đều đúng sẽ trả về 1
    (a != b)           // trả về 0
    (a > b || a == b)  // trả về 1
    (a > b && a == b)  // trả về 0
    (a == b || a >= b) // trả về 1
    (a == b && a >= b) // trả về 1


    // Câu lệnh if, else, else if //
    // Câu lệnh if được thực hiện khi điều kiện đúng (trả về 1)
    // Câu lệnh else if sẽ được thực hiện khi câu lệnh if gần nhất sai và sử dụng một điều kiện khác
    // Câu lệnh else được thực hiện khi điều kiện if gần nhất sai
    int a = 1;
if (a == 1)
    printf("a = 1"); // khi điều kiện if đúng
else if (a > 1)
    printf("a > 1"); // khi điều kiện if không đúng
else
    printf("a < 1"); // khi 2 điều kiện trên đều không đúng

// Vòng lặp for //
// For có 3 giá trị ngăn cách nhau bởi dấu chấm phẩy
// Khai báo số
// Điều kiện để vòng lặp chạy
// Số tăng dần hoặc giảm dần
int i;
for (
    i = 0;  // Ở đây ta khai báo i = 0
    i < 10; // Điều kiện để chạy vòng lặp for này là i < 10
    i++;    // cho i tăng dần mỗi lần chạy lại vòng lặp nó sẽ + 1 đến khi = 10 như ở điều kiện nó sẽ dừng lại
)
{
    printf("%d ", i);
}
// In ra các số từ 0 đến 9 vì nó bắt đầu từ 0 đến số nhỏ hơn 10
// Hãy chạy thử code

// Vòng Lặp while
// cũng như for nhưng chỉ khác là phải tự khai báo và tự cho tăng dần giảm dần
int i = 0;
while (i < 10)
{
    printf("%d ", i);
    i++;
}
// while cũng là vòng lặp giống while nên có thể cân nhắc sử dụng cái nào cũng được
