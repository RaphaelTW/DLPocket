param(
    [Parameter(Mandatory = $false)]
    [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"
$tag = "v$Version"
$package = Get-Content -Raw -Path "package.json" | ConvertFrom-Json
if ($package.version -ne $Version) {
    throw "A versão do package.json ($($package.version)) não corresponde à versão solicitada ($Version). Atualize e commite o package.json antes de publicar."
}

if (git tag --list $tag) {
    throw "A tag $tag já existe localmente."
}

Write-Host "==> Validando repositório" -ForegroundColor Cyan
git diff --exit-code
git diff --cached --exit-code

Write-Host "==> Executando validação JavaScript" -ForegroundColor Cyan
npm run check

Write-Host "==> Gerando instalador Windows" -ForegroundColor Cyan
npm run dist:win

Write-Host "==> Criando tag $tag" -ForegroundColor Cyan
git tag -a $tag -m "DLPocket $tag"
git push origin $tag

Write-Host "" 
Write-Host "Tag enviada. O workflow do GitHub Actions criará/atualizará a Release e anexará o .exe." -ForegroundColor Green
