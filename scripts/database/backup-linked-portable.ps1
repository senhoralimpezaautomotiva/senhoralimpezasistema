param(
  [Parameter(Mandatory = $true)]
  [string]$PostgresBin,

  [Parameter(Mandatory = $true)]
  [string]$BackupPath
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$poolerFile = Join-Path $projectRoot 'supabase\.temp\pooler-url'
if (-not (Test-Path -LiteralPath $poolerFile)) {
  throw 'Projeto Supabase não vinculado.'
}

$pgDump = Join-Path $PostgresBin 'pg_dump.exe'
$pgDumpAll = Join-Path $PostgresBin 'pg_dumpall.exe'
if (-not (Test-Path -LiteralPath $pgDump) -or
    -not (Test-Path -LiteralPath $pgDumpAll)) {
  throw 'Binários portáteis do PostgreSQL não encontrados.'
}

$resolvedBackupPath = [System.IO.Path]::GetFullPath($BackupPath)
if ($resolvedBackupPath -notlike 'D:\*') {
  throw 'O backup deve permanecer no disco D:.'
}
New-Item -ItemType Directory -Path $resolvedBackupPath -Force | Out-Null

$poolerUri = [Uri](Get-Content -LiteralPath $poolerFile -Raw).Trim()
$credentials = $poolerUri.UserInfo.Split(':', 2)
if ($credentials.Length -lt 1 -or -not $credentials[0]) {
  throw 'Usuário do pooler não encontrado.'
}

$securePassword = Read-Host 'Digite a senha do banco Supabase' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
  $securePassword
)

try {
  $env:PGHOST = $poolerUri.Host
  $env:PGPORT = [string]$poolerUri.Port
  $env:PGUSER = [Uri]::UnescapeDataString($credentials[0])
  $env:PGDATABASE = $poolerUri.AbsolutePath.TrimStart('/')
  $env:PGSSLMODE = 'require'
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
    $passwordPointer
  )

  $rolesFile = Join-Path $resolvedBackupPath 'roles.sql'
  $schemaFile = Join-Path $resolvedBackupPath 'schema.sql'
  $dataFile = Join-Path $resolvedBackupPath 'data.sql'

  & $pgDumpAll `
    --no-password `
    --roles-only `
    --no-role-passwords `
    "--file=$rolesFile"
  if ($LASTEXITCODE -ne 0) {
    throw 'Falha ao gerar roles.sql.'
  }

  & $pgDump `
    --no-password `
    --schema-only `
    --no-owner `
    --no-privileges `
    "--file=$schemaFile"
  if ($LASTEXITCODE -ne 0) {
    throw 'Falha ao gerar schema.sql.'
  }

  & $pgDump `
    --no-password `
    --data-only `
    --use-copy `
    --no-owner `
    --no-privileges `
    --exclude-table=storage.buckets_vectors `
    --exclude-table=storage.vector_indexes `
    "--file=$dataFile"
  if ($LASTEXITCODE -ne 0) {
    throw 'Falha ao gerar data.sql.'
  }

  Write-Host ''
  Write-Host 'BACKUP_CONCLUIDO' -ForegroundColor Green
  Write-Host $resolvedBackupPath
  Write-Host 'A janela pode ser fechada.'
} finally {
  $env:PGPASSWORD = $null
  $env:PGHOST = $null
  $env:PGPORT = $null
  $env:PGUSER = $null
  $env:PGDATABASE = $null
  $env:PGSSLMODE = $null
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
}
