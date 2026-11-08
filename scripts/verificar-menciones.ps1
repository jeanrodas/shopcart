<#
.SYNOPSIS
  Verifica que NO haya menciones de IA en el proyecto (texto y binarios).
.DESCRIPTION
  - Texto: docs, codigo (TS/TSX/JS/MJS), SQL, JSON, YAML, CSS, Markdown.
  - Binarios: metadatos C2PA/XMP/JUMBF ("Generative AI") en web/public/img y api/uploads.
  Termina con codigo 0 si todo esta limpio; 1 si encuentra algo.
  Uso: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verificar-menciones.ps1
#>
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz
$fail = $false

$excl = 'node_modules|package-lock\.json|[\\/]dist[\\/]|web[\\/]public[\\/]img|api[\\/]uploads|verificar-menciones'
$exts = '*.md', '*.ts', '*.tsx', '*.js', '*.mjs', '*.sql', '*.json', '*.yml', '*.yaml', '*.css'
$dirs = 'docs', 'web', 'api', 'db', 'deploy', 'scripts'
$archivos = @('README.md') + ($dirs | Where-Object { Test-Path $_ } | ForEach-Object {
    Get-ChildItem -Path $_ -Recurse -File -Include $exts -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -notmatch $excl } | ForEach-Object { $_.FullName }
  })

Write-Host '== Texto: terminos de IA =='
$palabras = '(?i)\b(claude|anthropic|chatgpt|openai|copilot|gemini|llm|inteligencia artificial|generative ai|genai)\b|(?i)gener(ado|ada|ated) (con|por|with|by) '
$acron = '\b(IA|AI)\b'   # sensible a mayusculas
$txtHits = $archivos | ForEach-Object {
  $p = $_
  Select-String -Path $p -Pattern $palabras -AllMatches -ErrorAction SilentlyContinue
  Select-String -Path $p -Pattern $acron -CaseSensitive -AllMatches -ErrorAction SilentlyContinue
}
if ($txtHits) { $txtHits | ForEach-Object { Write-Host $_.ToString() }; $fail = $true } else { Write-Host 'ok (0)' }

Write-Host '== Binarios: metadatos de IA en imagenes =='
$marcadores = 'c2pa|jumb|generative|genai|trainedalgorithmicmedia|xmp'
$bins = @('web/public/img', 'api/uploads') | Where-Object { Test-Path $_ } |
  ForEach-Object { Get-ChildItem -Path $_ -Recurse -File -ErrorAction SilentlyContinue }
$binHits = @()
foreach ($b in $bins) {
  try {
    $bytes = [IO.File]::ReadAllBytes($b.FullName)
    $texto = [Text.Encoding]::GetEncoding('ISO-8859-1').GetString($bytes)
    if ($texto -match "(?i)($marcadores)") { $binHits += $b.FullName }
  } catch {}
}
if ($binHits) { $binHits | ForEach-Object { Write-Host $_ }; $fail = $true } else { Write-Host 'ok (0)' }

if ($fail) { Write-Host 'RESULTADO: hay menciones'; exit 1 } else { Write-Host 'RESULTADO: limpio'; exit 0 }
