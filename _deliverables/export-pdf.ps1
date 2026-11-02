param(
  [string]$Only = ""
)
$ErrorActionPreference = "Stop"
$root = "E:\1-xiangmmu\43-shenwai"
$base = Join-Path $root "_deliverables\20261027-A4版"
$web = Join-Path $base "网页版"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"

$files = Get-ChildItem (Join-Path $web "*.html") | Sort-Object Name
foreach ($f in $files) {
  if ($Only -and -not $f.Name.StartsWith($Only)) { continue }
  $pdf = Join-Path $base ($f.BaseName + ".pdf")
  if (Test-Path $pdf) { Remove-Item $pdf -Force }
  $profile = Join-Path $env:TEMP ("ve-pdf-" + [guid]::NewGuid().ToString("N"))
  $uri = ([System.Uri]$f.FullName).AbsoluteUri
  & $chrome --headless=new --disable-gpu --no-pdf-header-footer "--user-data-dir=$profile" "--print-to-pdf=$pdf" $uri 2>$null | Out-Null
  $t0 = Get-Date
  while (-not (Test-Path $pdf) -and ((Get-Date) - $t0).TotalSeconds -lt 60) { Start-Sleep -Milliseconds 300 }
  if (-not (Test-Path $pdf)) { Write-Host "FAIL $($f.Name)"; continue }
  $size = [math]::Round((Get-Item $pdf).Length / 1MB, 1)
  Write-Host "PDF $($f.BaseName) $size MB"
}

