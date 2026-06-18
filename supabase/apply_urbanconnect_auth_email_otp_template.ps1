param(
  [string]$ProjectRef = '',
  [string]$PayloadPath = ''
)

$ErrorActionPreference = 'Stop'

if (-not $PayloadPath) {
  $PayloadPath = Join-Path $PSScriptRoot 'urbanconnect_auth_email_otp_template.json'
}

if (-not (Test-Path -LiteralPath $PayloadPath)) {
  throw "Template payload was not found at $PayloadPath"
}

if (-not $ProjectRef) {
  $envPath = Join-Path (Split-Path $PSScriptRoot -Parent) '.env'
  if (Test-Path -LiteralPath $envPath) {
    $supabaseUrlLine = Get-Content -LiteralPath $envPath |
      Where-Object { $_ -match '^\s*EXPO_PUBLIC_SUPABASE_URL\s*=' } |
      Select-Object -First 1

    if ($supabaseUrlLine -match 'https://([^.]+)\.supabase\.co') {
      $ProjectRef = $matches[1]
    }
  }
}

if (-not $ProjectRef) {
  throw 'Project ref is missing. Pass -ProjectRef or set EXPO_PUBLIC_SUPABASE_URL in .env.'
}

$accessToken = $env:SUPABASE_ACCESS_TOKEN
if (-not $accessToken) {
  throw 'SUPABASE_ACCESS_TOKEN is missing. Create a Supabase Management API access token, set it in this shell, then run this script again.'
}

$body = Get-Content -LiteralPath $PayloadPath -Raw
$uri = "https://api.supabase.com/v1/projects/$ProjectRef/config/auth"

Invoke-RestMethod `
  -Method Patch `
  -Uri $uri `
  -Headers @{ Authorization = "Bearer $accessToken" } `
  -ContentType 'application/json' `
  -Body $body

Write-Output "UrbanConnect signup emails now show the 8 digit OTP code for project $ProjectRef."
