using System.Runtime.Loader;
using System.Text.RegularExpressions;
using MediaBrowser.Model.Tasks;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.ElegantFinTv;

public sealed class TransformationPayload
{
    public string? Contents { get; set; }
}

public static class Transformation
{
    public static string IndexHtml(TransformationPayload payload) => Inject(payload.Contents ?? string.Empty,
        Plugin.Instance?.Configuration.Enabled == true);

    public static string Inject(string contents, bool enabled)
    {
        if (!enabled || contents.Contains("id=\"eftv-bootstrap\"", StringComparison.Ordinal)) return contents;
        // Jellyfin serves index.html in /web/. Relative URL also preserves a configured base URL.
        const string script = "<script id=\"eftv-bootstrap\" defer src=\"../ElegantFinTv/bootstrap.js\"></script>";
        var end = Regex.Match(contents, @"</head\s*>", RegexOptions.IgnoreCase, TimeSpan.FromSeconds(1));
        return end.Success ? contents.Insert(end.Index, script) : contents;
    }
}

// Jellyfin discovers IScheduledTask implementations in plugin assemblies.
// Registration runs after plugins are loaded and can be retried in the dashboard.
public sealed class RegisterTransformationTask(ILogger<RegisterTransformationTask> logger) : IScheduledTask
{
    public string Name => "ElegantFin TV: Frontend registrieren";
    public string Key => "ElegantFinTv.RegisterTransformation";
    public string Description => "Bindet das TV-Modul über File Transformation ein, ohne Webdateien zu ändern.";
    public string Category => "ElegantFin TV";

    public IEnumerable<TaskTriggerInfo> GetDefaultTriggers()
    {
        yield return new TaskTriggerInfo { Type = TaskTriggerInfoType.StartupTrigger };
    }

    public Task ExecuteAsync(IProgress<double> progress, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var assembly = AssemblyLoadContext.All.SelectMany(context => context.Assemblies)
            .FirstOrDefault(candidate => candidate.GetName().Name == "Jellyfin.Plugin.FileTransformation");
        var method = assembly?.GetType("Jellyfin.Plugin.FileTransformation.PluginInterface")
            ?.GetMethod("RegisterTransformation");
        if (method is null)
        {
            logger.LogError("ElegantFin TV requires a Jellyfin 12.2-compatible File Transformation plugin. No web files were changed.");
            throw new InvalidOperationException("File Transformation is missing or its registration API is incompatible.");
        }

        var payload = new JObject
        {
            ["id"] = "c78f284c-44c9-4aa8-a65d-780d4231752a",
            ["fileNamePattern"] = @"(^|[/\\])index\.html$",
            ["callbackAssembly"] = typeof(Transformation).Assembly.FullName,
            ["callbackClass"] = typeof(Transformation).FullName,
            ["callbackMethod"] = nameof(Transformation.IndexHtml)
        };
        method.Invoke(null, [payload]);
        logger.LogInformation("ElegantFin TV frontend registered. Profile: {Profile}", Plugin.Instance?.Configuration.Performance);
        progress.Report(100);
        return Task.CompletedTask;
    }
}
