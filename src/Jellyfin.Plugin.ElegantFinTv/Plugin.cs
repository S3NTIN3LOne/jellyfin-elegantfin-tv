using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.ElegantFinTv;

public sealed class PluginConfiguration : BasePluginConfiguration
{
    public bool Enabled { get; set; } = true;
    public bool ApplyToAllClients { get; set; }
    public bool MediaBar { get; set; } = true;
    public string Performance { get; set; } = "balanced";
}

public sealed class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public static Plugin? Instance { get; private set; }
    public override string Name => "ElegantFin TV";
    public override string Description => "ElegantFin browser styling with TV focus support and a reduced-effects profile.";
    public override Guid Id => Guid.Parse("f723a150-5b12-4ed8-8a31-450b54b2eac9");

    public Plugin(IApplicationPaths paths, IXmlSerializer serializer) : base(paths, serializer)
    {
        Instance = this;
    }

    public IEnumerable<PluginPageInfo> GetPages()
    {
        yield return new PluginPageInfo
        {
            Name = "ElegantFinTvSettings",
            EmbeddedResourcePath = "Jellyfin.Plugin.ElegantFinTv.Web.settings.html"
        };
    }
}
