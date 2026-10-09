param([string]$Dotnet = 'dotnet')
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$scratch = Join-Path $projectRoot '.tools/file-transformation-test'
New-Item -ItemType Directory -Force -Path $scratch | Out-Null
# Pinned upstream implementation; downloaded only for this integration test, not shipped in the plugin.
$commit = '2dd4279bc7aedd082de0639278f9142ead229a52'
$base = "https://raw.githubusercontent.com/IAmParadox27/jellyfin-plugin-file-transformation/$commit/src/Jellyfin.Plugin.FileTransformation/"
foreach ($name in @('Infrastructure/WebFileTransformationService.cs', 'Library/IWebFileTransformationReadService.cs', 'Library/IWebFileTransformationWriteService.cs', 'Library/IFileTransformationLogger.cs')) {
    Invoke-WebRequest -UseBasicParsing -Uri ($base + $name) -OutFile (Join-Path $scratch ([IO.Path]::GetFileName($name)))
}
$plugin = [Security.SecurityElement]::Escape((Join-Path $projectRoot 'src/Jellyfin.Plugin.ElegantFinTv/Jellyfin.Plugin.ElegantFinTv.csproj'))
$test = [Security.SecurityElement]::Escape((Join-Path $projectRoot 'tests/FileTransformationIntegration/Program.cs'))
$project = @"
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable></PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="$plugin" />
    <Compile Include="$test" Link="Program.cs" />
    <PackageReference Include="Jellyfin.Controller" Version="12.2.0" />
    <PackageReference Include="Jellyfin.Model" Version="12.2.0" />
  </ItemGroup>
</Project>
"@
[IO.File]::WriteAllText((Join-Path $scratch 'Integration.csproj'), $project)
& $Dotnet run --project (Join-Path $scratch 'Integration.csproj') -c Release --nologo
if ($LASTEXITCODE -ne 0) { throw 'File Transformation integration check failed' }
