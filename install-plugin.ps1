param()

$ErrorActionPreference = "Stop"

$repoRoot = $PSScriptRoot
$source = Join-Path $repoRoot "plugins\auto-agent-team"
$pluginsRoot = Join-Path $env:USERPROFILE "plugins"
$target = Join-Path $pluginsRoot "auto-agent-team"
$marketplaceDir = Join-Path $env:USERPROFILE ".agents\plugins"
$marketplacePath = Join-Path $marketplaceDir "marketplace.json"

if (-not (Test-Path $source)) {
    throw "Plugin source not found: $source"
}

$manifest = Join-Path $source ".codex-plugin\plugin.json"
$mcpConfig = Join-Path $source ".mcp.json"
$server = Join-Path $source "mcp\server.mjs"
$dashboard = Join-Path $source "ui\team-dashboard.html"
$smokeTest = Join-Path $source "scripts\smoke-test.mjs"

foreach ($required in @($manifest, $mcpConfig, $server, $dashboard, $smokeTest)) {
    if (-not (Test-Path $required)) {
        throw "Required plugin file not found: $required"
    }
}

# Validate JSON before changing the user's installation.
Get-Content $manifest -Raw | ConvertFrom-Json | Out-Null
Get-Content $mcpConfig -Raw | ConvertFrom-Json | Out-Null

# The runtime is a local Node MCP server. Validate it before installation.
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    throw "Node.js is required by the Auto Agent Team MCP runtime, but 'node' was not found in PATH."
}

& $node.Source --check $server
if ($LASTEXITCODE -ne 0) {
    throw "Node syntax validation failed for $server"
}

& $node.Source $smokeTest
if ($LASTEXITCODE -ne 0) {
    throw "Auto Agent Team MCP runtime smoke test failed. Installation was not changed."
}

New-Item -ItemType Directory -Force -Path $pluginsRoot | Out-Null
New-Item -ItemType Directory -Force -Path $marketplaceDir | Out-Null

# Install a clean copy so stale files from an older version cannot survive.
if (Test-Path $target) {
    Remove-Item $target -Recurse -Force
}
Copy-Item $source $target -Recurse -Force

if (Test-Path $marketplacePath) {
    $raw = Get-Content $marketplacePath -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
        $marketplace = [pscustomobject]@{}
    }
    else {
        $marketplace = $raw | ConvertFrom-Json
    }
}
else {
    $marketplace = [pscustomobject]@{}
}

if (-not $marketplace.PSObject.Properties["name"]) {
    $marketplace | Add-Member -NotePropertyName name -NotePropertyValue "local-plugins"
}
if (-not $marketplace.PSObject.Properties["interface"]) {
    $marketplace | Add-Member -NotePropertyName interface -NotePropertyValue ([pscustomobject]@{ displayName = "Local Plugins" })
}
if (-not $marketplace.PSObject.Properties["plugins"]) {
    $marketplace | Add-Member -NotePropertyName plugins -NotePropertyValue @()
}

$entry = [pscustomobject]@{
    name = "auto-agent-team"
    source = [pscustomobject]@{
        source = "local"
        path = "./plugins/auto-agent-team"
    }
    policy = [pscustomobject]@{
        installation = "AVAILABLE"
        authentication = "ON_INSTALL"
        products = @("CODEX")
    }
    category = "Developer Tools"
}

$existing = @($marketplace.plugins | Where-Object { $_.name -ne "auto-agent-team" })
$marketplace.plugins = @($existing + $entry)

# Windows PowerShell 5.1's Set-Content -Encoding UTF8 writes a BOM. Use UTF-8 without BOM
# because marketplace.json is consumed as machine-readable JSON by Codex.
$json = $marketplace | ConvertTo-Json -Depth 30
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($marketplacePath, $json + [Environment]::NewLine, $utf8NoBom)

Write-Host ""
Write-Host "Auto Agent Team plugin installed." -ForegroundColor Green
Write-Host "Plugin:      $target"
Write-Host "Marketplace: $marketplacePath"
Write-Host ""
Write-Host "The standalone Auto Agent Team Skill remains in place and is not duplicated by the plugin."
Write-Host "Completely restart Codex, then open Plugins and enable/install Auto Agent Team if Codex shows it as available rather than enabled."
