using System.Text;
using Jellyfin.Plugin.ElegantFinTv;
using Jellyfin.Plugin.FileTransformation.Infrastructure;
using Jellyfin.Plugin.FileTransformation.Library;
using Microsoft.Extensions.Logging;

// Compiled against the unmodified, pinned upstream service by tools/test-file-transformation.ps1.
foreach (var requestPath in new[] { "index.html", "/index.html", "web/index.html" })
{
    foreach (var tvFirst in new[] { false, true })
    {
        if (requestPath is "index.html" or "/index.html")
        {
            var before = await Render(@"(^|[/\\])index\.html$", requestPath, tvFirst);
            if (before.Contains("eftv-bootstrap")) throw new Exception("Expected to reproduce the old registration conflict.");
            Console.WriteLine($"REPRODUCED old regex callback skipped: {requestPath}, TV registered first={tvFirst}");
        }
        var after = await Render(Transformation.FileNamePattern, requestPath, tvFirst);
        if (!after.Contains("eftv-bootstrap") || !after.Contains("media-bar-test"))
            throw new Exception($"Both plugins must run: {requestPath}, TV first={tvFirst}");
        Console.WriteLine($"PASS both plugins injected: {requestPath}, TV registered first={tvFirst}");
    }
}

static async Task<string> Render(string tvPattern, string path, bool tvFirst)
{
    var service = new WebFileTransformationService(new SilentLogger());
    void AddMediaBar() => service.AddTransformation(Guid.NewGuid(), "index.html", async (_, stream) =>
    {
        using var reader = new StreamReader(stream, leaveOpen: true);
        var content = await reader.ReadToEndAsync();
        var output = content.Replace("</head>", "<script id=\"media-bar-test\"></script></head>");
        await Write(stream, output);
    });
    void AddTv() => service.AddTransformation(Guid.NewGuid(), tvPattern, async (_, stream) =>
    {
        using var reader = new StreamReader(stream, leaveOpen: true);
        var content = await reader.ReadToEndAsync();
        await Write(stream, Transformation.Inject(content, true));
    });
    if (tvFirst) { AddTv(); AddMediaBar(); } else { AddMediaBar(); AddTv(); }
    using var data = new MemoryStream();
    await Write(data, "<html><head></head><body></body></html>");
    await service.RunTransformation(path, data);
    return Encoding.UTF8.GetString(data.ToArray());
}

static async Task Write(Stream stream, string content)
{
    var bytes = Encoding.UTF8.GetBytes(content);
    stream.Position = 0;
    await stream.WriteAsync(bytes);
    stream.SetLength(stream.Position);
    stream.Position = 0;
}

sealed class SilentLogger : IFileTransformationLogger
{
    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel logLevel) => false;
    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) { }
}

// Only the logger's generic type needs the plugin type; the upstream pipeline itself is unmodified.
namespace Jellyfin.Plugin.FileTransformation { public sealed class FileTransformationPlugin { } }
