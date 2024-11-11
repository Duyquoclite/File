/*
Bài 16. Viết chương trình bằng ngôn ngữ lập trình C thực hiện những yêu cầu sau:
a) Viết chương trình nhập vào một mảng gồm N số nguyên (số N được nhập từ bàn phím);
b) In ra mảng đã nhập vào;
c) Hãy tìm và in ra phần tử có giá trị nhỏ nhất của mảng đã nhập;
*/
#include <stdlib.h>
int n, i = 0, min;
void nhap_n()
{
    printf("Nhap n: ");
    scanf("%d", &n);
}
int main()
{
    nhap_n();
    int a[n];
    while (i < n)
    {
        printf("nhap phan tu thu %d cua mang: ", i + 1);
        scanf("%d", &a[i]);
        if (!i)
            min = a[i];
        if (a[i] < min)
            min = a[i];
        i++;
    }
    i = 0;
    printf("\ncac phan tu da nhap trong mang la: ");
    while (i < n)
    {
        printf("%d ", a[i]);
        i++;
    }
    printf("\nphan tu nho nhat cua mang la: %d", min);
    getch();
}
