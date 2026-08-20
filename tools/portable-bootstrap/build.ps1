param(
    [string]$Output = "../../dist/DLPocket-Portable-1.0.0.exe"
)

$ErrorActionPreference = "Stop"
$ToolDir = $PSScriptRoot
$Root = Resolve-Path (Join-Path $ToolDir "../..")
$Payload = Join-Path $ToolDir "app"

Write-Host "==> Sincronizando payload do DLPocket" -ForegroundColor Cyan
Remove-Item -Recurse -Force $Payload -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $Payload | Out-Null
Copy-Item -Recurse (Join-Path $Root "src") $Payload
Copy-Item -Recurse (Join-Path $Root "assets") $Payload
Copy-Item (Join-Path $Root "package.json") $Payload
Copy-Item (Join-Path $Root "LICENSE") $Payload
Copy-Item (Join-Path $Root "THIRD_PARTY_NOTICES.md") $Payload

$OutputPath = [System.IO.Path]::GetFullPath((Join-Path $ToolDir $Output))
New-Item -ItemType Directory -Force -Path (Split-Path $OutputPath -Parent) | Out-Null

Write-Host "==> Compilando bootstrapper Windows x64" -ForegroundColor Cyan
Push-Location $ToolDir
try {
    $env:GOOS = "windows"
    $env:GOARCH = "amd64"
    $env:CGO_ENABLED = "0"
    go build -trimpath -ldflags="-H=windowsgui -s -w" -o $OutputPath .
    if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar o bootstrapper." }
} finally {
    Pop-Location
}

Write-Host "Criado: $OutputPath" -ForegroundColor Green
