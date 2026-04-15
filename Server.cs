using System.Globalization;
using System.Net;
using System.Net.Sockets;
using System.Text;

class Program
{
    const int Port = 5050;
    const string ExitToken = "Thoát";
    const string CnttToken = "CNTT";

    static async Task Main()
    {
        var listener = new TcpListener(IPAddress.Any, Port);
        listener.Start();
        Console.WriteLine($"Server đang lắng nghe cổng {Port}... (Ctrl+C để dừng)");

        try
        {
            using var tcpClient = await listener.AcceptTcpClientAsync();
            listener.Stop();
            Console.WriteLine("Đã có Client kết nối.");

            await using var stream = tcpClient.GetStream();
            using var reader = new StreamReader(stream, Encoding.UTF8, leaveOpen: false);
            await using var writer = new StreamWriter(stream, Encoding.UTF8, leaveOpen: false) { AutoFlush = true };

            while (true)
            {
                var line = await reader.ReadLineAsync();
                if (line is null)
                    break;

                var trimmed = line.Trim();
                if (string.Equals(trimmed, ExitToken, StringComparison.OrdinalIgnoreCase))
                {
                    await writer.WriteLineAsync("Tạm biệt.");
                    break;
                }

                if (string.Equals(trimmed, CnttToken, StringComparison.Ordinal))
                {
                    var reply = " Xin chào Khoa " + "CNTT";
                    await writer.WriteLineAsync(reply);
                    continue;
                }

                var upper = trimmed.ToUpper(CultureInfo.CurrentCulture);
                await writer.WriteLineAsync(upper);
            }
        }
        finally
        {
            listener.Stop();
        }

        Console.WriteLine("Server đã thoát.");
    }
}
