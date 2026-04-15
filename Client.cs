using System.Net.Sockets;
using System.Text;

class Program
{
    const int Port = 5050;
    const string ExitToken = "Thoát";

    static async Task Main()
    {
        Console.Write("Nhập địa chỉ Server (Enter = 127.0.0.1): ");
        var host = Console.ReadLine();
        if (string.IsNullOrWhiteSpace(host))
            host = "127.0.0.1";

        using var tcpClient = new TcpClient();
        try
        {
            await tcpClient.ConnectAsync(host.Trim(), Port);
        }
        catch (SocketException ex)
        {
            Console.WriteLine($"Không kết nối được Server ({host}:{Port}): {ex.Message}");
            return;
        }

        Console.WriteLine($"Đã kết nối tới {host}:{Port}. Nhập nội dung (\"{ExitToken}\" để thoát cả hai).");

        await using var stream = tcpClient.GetStream();
        using var reader = new StreamReader(stream, Encoding.UTF8, leaveOpen: false);
        await using var writer = new StreamWriter(stream, Encoding.UTF8, leaveOpen: false) { AutoFlush = true };

        while (true)
        {
            Console.Write("> ");
            var input = Console.ReadLine();
            if (input is null)
                break;

            var trimmed = input.Trim();
            await writer.WriteLineAsync(trimmed);

            if (string.Equals(trimmed, ExitToken, StringComparison.OrdinalIgnoreCase))
            {
                var farewell = await reader.ReadLineAsync();
                if (farewell is not null)
                    Console.WriteLine(farewell);
                break;
            }

            var response = await reader.ReadLineAsync();
            if (response is null)
            {
                Console.WriteLine("Server đã đóng kết nối.");
                break;
            }

            Console.WriteLine(response);
        }

        Console.WriteLine("Client đã thoát.");
    }
}
