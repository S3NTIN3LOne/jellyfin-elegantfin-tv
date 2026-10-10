$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$inputPath = Join-Path $projectRoot 'artifacts/ElegantFinTV-0.1.2-jf12.2.zip'
$outputPath = Join-Path $projectRoot 'artifacts/ElegantFinTV-0.1.2-jf12.2-catalog.zip'
$inputZip = [IO.Compression.ZipFile]::OpenRead($inputPath)
$outputStream = [IO.File]::Open($outputPath, [IO.FileMode]::Create)
$outputZip = [IO.Compression.ZipArchive]::new($outputStream, [IO.Compression.ZipArchiveMode]::Create)
try {
    $prefix = 'ElegantFinTV_0.1.2.0/'
    foreach ($entry in $inputZip.Entries) {
        if (!$entry.FullName.StartsWith($prefix)) { throw 'Unexpected manual-package structure' }
        $name = $entry.FullName.Substring($prefix.Length)
        if (!$name -or $entry.FullName.EndsWith('/')) { continue }
        # Jellyfin creates the plugin directory; catalogue packages contain the DLL at their root.
        $target = $outputZip.CreateEntry($name, [IO.Compression.CompressionLevel]::Optimal)
        $sourceStream = $entry.Open()
        $targetStream = $target.Open()
        try { $sourceStream.CopyTo($targetStream) } finally { $sourceStream.Dispose(); $targetStream.Dispose() }
    }
} finally { $inputZip.Dispose(); $outputZip.Dispose(); $outputStream.Dispose() }
$manifest = @(@{
    guid = 'f723a150-5b12-4ed8-8a31-450b54b2eac9'
    name = 'ElegantFin TV'
    overview = 'ElegantFin for webOS and TV layouts'
    description = 'TV theme with reduced effects and Media Bar focus support. Requires a compatible File Transformation plugin. LG C4 integration still requires on-device verification.'
    owner = 'S3NTIN3LOne'
    category = 'General'
    versions = @(@{
        version = '0.1.2.0'
        changelog = 'Fix duplicate poster focus outlines, reduce additional Media Bar blur and logo effects, and add opt-in on-TV diagnostics without Developer Mode. Existing desktop CSS is unchanged.'
        targetAbi = '12.2.0.0'
        sourceUrl = 'https://github.com/S3NTIN3LOne/jellyfin-elegantfin-tv/releases/download/v0.1.2/ElegantFinTV-0.1.2-jf12.2-catalog.zip'
        checksum = (Get-FileHash -LiteralPath $outputPath -Algorithm MD5).Hash.ToLowerInvariant()
        timestamp = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
    })
})
$json = ConvertTo-Json -InputObject $manifest -Depth 6
[IO.File]::WriteAllText((Join-Path $projectRoot 'manifest.json'), $json + "`n", [Text.UTF8Encoding]::new($false))
Write-Output 'Created manifest.json and a catalogue ZIP with the plugin DLL at its root.'
