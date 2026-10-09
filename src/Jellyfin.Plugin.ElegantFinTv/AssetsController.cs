using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.ElegantFinTv;

[ApiController]
[Route("ElegantFinTv")]
public sealed class AssetsController : ControllerBase
{
    private static readonly Lazy<string> Script = new(() => ReadAsset("tv.js"));
    private static readonly Lazy<string> Styles = new(() => ReadAsset("tv.css"));

    // Only static frontend code and non-secret presentation options are public.
    // Configuration writes use Jellyfin's existing administrator-only plugin API.
    [AllowAnonymous]
    [HttpGet("bootstrap.js")]
    public ContentResult Bootstrap()
    {
        Response.Headers.CacheControl = "no-store";
        var configuration = Plugin.Instance?.Configuration;
        var settings = JsonSerializer.Serialize(new
        {
            enabled = configuration?.Enabled == true,
            applyToAllClients = configuration?.ApplyToAllClients == true,
            mediaBar = configuration?.MediaBar == true,
            performance = configuration?.Performance == "full" ? "full" : "balanced",
            version = typeof(Plugin).Assembly.GetName().Version?.ToString()
        });
        return Content("window.ElegantFinTvConfig=" + settings + ";\n" + Script.Value, "application/javascript; charset=utf-8");
    }

    [AllowAnonymous]
    [HttpGet("tv.css")]
    public ContentResult Css()
    {
        Response.Headers.CacheControl = "public,max-age=3600";
        return Content(Styles.Value, "text/css; charset=utf-8");
    }

    [AllowAnonymous]
    [HttpGet("fonts/{name}")]
    public IActionResult Font(string name)
    {
        // Names are allowlisted by syntax and embedded-resource existence, never filesystem paths.
        if (!System.Text.RegularExpressions.Regex.IsMatch(name, @"^font-[0-9]{1,2}\.woff2$")) return NotFound();
        var stream = typeof(Plugin).Assembly.GetManifestResourceStream("Jellyfin.Plugin.ElegantFinTv.Web.fonts." + name);
        if (stream is null) return NotFound();
        Response.Headers.CacheControl = "public,max-age=3600";
        return File(stream, "font/woff2");
    }

    private static string ReadAsset(string name)
    {
        using var stream = typeof(Plugin).Assembly.GetManifestResourceStream("Jellyfin.Plugin.ElegantFinTv.Web." + name)
            ?? throw new InvalidOperationException("Missing embedded frontend asset: " + name);
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
