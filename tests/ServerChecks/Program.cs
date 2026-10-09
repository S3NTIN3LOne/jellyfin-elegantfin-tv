using System.Text.RegularExpressions;
using Jellyfin.Plugin.ElegantFinTv;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

static void Check(bool condition, string message)
{
    if (!condition) throw new Exception(message);
    Console.WriteLine("PASS " + message);
}

const string original = "<!doctype html><HTML><HEAD><script src=\"../MediaBar/bar.js\"></script></HEAD><body>$1</body></HTML>";
var output = Transformation.Inject(original, true);
Check(output.Contains("../ElegantFinTv/bootstrap.js"), "frontend injected with relative base URL");
Check(output.Contains("../MediaBar/bar.js") && output.Contains("$1"), "existing scripts and literal dollar strings preserved");
Check(Transformation.Inject(output, true) == output, "injection is idempotent");
Check(Transformation.Inject(original, false) == original, "disabled leaves HTML unchanged");
Check(Transformation.Inject("no head", true) == "no head", "unexpected HTML fails without rewriting");
Check(Transformation.Inject("<head></head >", true).Contains("eftv-bootstrap"), "HTML closing tag whitespace supported");
var pattern = Transformation.FileNamePattern;
Check(pattern == "index.html", "registration shares Media Bar's exact File Transformation pipeline");
foreach (var path in new[] { "index.html", "/web/index.html", @"C:\web\index.html" })
    Check(Regex.IsMatch(path, pattern), "transformation path: " + path);

var controller = new AssetsController { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
Check(controller.Css().Content?.Contains("[data-eftv]") == true, "generated CSS embedded in plugin");
var script = controller.Bootstrap().Content ?? "";
Check(script.Contains("window.ElegantFinTvConfig=") && script.Contains("window.ElegantFinTv"), "bootstrap embeds config and frontend");
Check(controller.Response.Headers.CacheControl == "no-store", "configuration is not cached");
Check(controller.Font("../tv.js") is NotFoundResult, "font route rejects traversal and unrelated resources");
var font = controller.Font("font-0.woff2") as FileStreamResult;
Check(font is not null && font.ContentType == "font/woff2", "font is embedded and served locally");
font?.FileStream.Dispose();
Console.WriteLine("Server checks passed.");
