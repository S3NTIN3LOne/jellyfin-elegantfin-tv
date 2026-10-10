param([string]$Dotnet = 'dotnet')
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $projectRoot
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
    & $Dotnet build 'src/Jellyfin.Plugin.ElegantFinTv/Jellyfin.Plugin.ElegantFinTv.csproj' -c Release --nologo
    if ($LASTEXITCODE -ne 0) { throw 'Plugin build failed' }

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $artifacts = Join-Path $projectRoot 'artifacts'
    New-Item -ItemType Directory -Force -Path $artifacts | Out-Null
    $sourcePath = Join-Path $artifacts 'ElegantFinTV-0.1.3-source.zip'
    $sourceStream = [IO.File]::Open($sourcePath, [IO.FileMode]::Create)
    $sourceZip = [IO.Compression.ZipArchive]::new($sourceStream, [IO.Compression.ZipArchiveMode]::Create)
    try {
        $sourceFiles = @(Get-ChildItem -LiteralPath $projectRoot -File)
        foreach ($dir in @('src', 'vendor', 'tools', 'tests')) {
            $sourceFiles += Get-ChildItem -LiteralPath (Join-Path $projectRoot $dir) -File -Recurse |
                Where-Object { $_.FullName -notmatch '[\\/](bin|obj|node_modules)[\\/]' }
        }
        foreach ($file in $sourceFiles) {
            $relative = $file.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($sourceZip, $file.FullName, $relative) | Out-Null
        }
    } finally { $sourceZip.Dispose(); $sourceStream.Dispose() }

    $packagePath = Join-Path $artifacts 'ElegantFinTV-0.1.3-jf12.2.zip'
    $packageStream = [IO.File]::Open($packagePath, [IO.FileMode]::Create)
    $packageZip = [IO.Compression.ZipArchive]::new($packageStream, [IO.Compression.ZipArchiveMode]::Create)
    try {
        $folder = 'ElegantFinTV_0.1.3.0/'
        $dll = Join-Path $projectRoot 'src/Jellyfin.Plugin.ElegantFinTv/bin/Release/net10.0/Jellyfin.Plugin.ElegantFinTv.dll'
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($packageZip, $dll, ($folder + 'Jellyfin.Plugin.ElegantFinTv.dll')) | Out-Null
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($packageZip, $sourcePath, ($folder + 'source.zip')) | Out-Null
        foreach ($name in @('README.md', 'ANALYSIS.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md')) {
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($packageZip, (Join-Path $projectRoot $name), ($folder + $name)) | Out-Null
        }
        foreach ($license in Get-ChildItem -LiteralPath (Join-Path $projectRoot 'vendor/fonts') -Filter '*.txt') {
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($packageZip, $license.FullName, ($folder + 'licenses/' + $license.Name)) | Out-Null
        }
    } finally { $packageZip.Dispose(); $packageStream.Dispose() }
    Get-FileHash -LiteralPath $packagePath, $sourcePath -Algorithm SHA256 | Format-List Path,Hash
} finally { Pop-Location }
