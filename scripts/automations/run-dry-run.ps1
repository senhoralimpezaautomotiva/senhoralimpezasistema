param(
    [string]$PostgresImage = 'postgres:17-alpine'
)

$ErrorActionPreference = 'Stop'
$workspaceRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$containerName = "sl-automation-dry-run-$PID"
$dryRunPassword = [guid]::NewGuid().ToString('N')

if ($containerName -notmatch '^sl-automation-dry-run-[0-9]+$') {
    throw 'Nome de container inesperado; execução interrompida.'
}

$ErrorActionPreference = 'Continue'
docker info *> $null
$dockerInfoExitCode = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($dockerInfoExitCode -ne 0) {
    throw 'Docker daemon indisponível. Nenhuma migration foi executada.'
}

function Invoke-DryRunSqlFile {
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    $resolved = Resolve-Path (Join-Path $workspaceRoot $RelativePath)
    Get-Content -LiteralPath $resolved -Raw -Encoding utf8 |
        docker exec -i $containerName psql -v ON_ERROR_STOP=1 -U postgres -d automation_dry_run
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao executar $RelativePath"
    }
}

try {
    docker run --detach --name $containerName `
        --label 'senhora-limpeza-purpose=automation-dry-run' `
        -e "POSTGRES_PASSWORD=$dryRunPassword" `
        -e POSTGRES_DB=automation_dry_run `
        $PostgresImage | Out-Null

    $ready = $false
    for ($attempt = 1; $attempt -le 60; $attempt++) {
        docker exec $containerName pg_isready -U postgres -d automation_dry_run *> $null
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) {
        throw 'PostgreSQL não ficou pronto em 60 segundos.'
    }

    Invoke-DryRunSqlFile 'scripts\automations\dry-run-fixture.sql'
    Invoke-DryRunSqlFile 'supabase\migrations\20260730233000_automacoes_janela_24h.sql'
    Invoke-DryRunSqlFile 'supabase\migrations\20260727220000_automacoes_execucoes.sql'
    Invoke-DryRunSqlFile 'supabase\migrations\20260728220000_automacoes_triggers_nativos.sql'
    Invoke-DryRunSqlFile 'supabase\migrations\20260729220000_automacoes_fluxo_unificado.sql'
    Invoke-DryRunSqlFile 'scripts\automations\dry-run-pre-claim.sql'
    Invoke-DryRunSqlFile 'supabase\migrations\20260729223000_automacoes_claim_backfill.sql'
    Invoke-DryRunSqlFile 'supabase\migrations\20260729230000_automacoes_riscos_residuais.sql'
    Invoke-DryRunSqlFile 'supabase\migrations\20260805220000_lembrete_seguranca.sql'
    Invoke-DryRunSqlFile 'supabase\migrations\20260805230000_cliente_inativo_seguranca.sql'
    Invoke-DryRunSqlFile 'scripts\automations\dry-run-assertions.sql'
    Invoke-DryRunSqlFile 'scripts\automations\dry-run-claim-target.sql'

    $claimQuery = @'
select count(*)
from public.fn_claim_automacoes_execucoes(
  1,
  300,
  '30000000-0000-0000-0000-000000000099'
);
'@
    $jobs = 1..2 | ForEach-Object {
        Start-Job -ScriptBlock {
            param($Name, $Query)
            $Query | docker exec -i $Name psql -At -v ON_ERROR_STOP=1 -U postgres -d automation_dry_run
        } -ArgumentList $containerName, $claimQuery
    }
    $claimCounts = $jobs | Wait-Job | Receive-Job | ForEach-Object { [int]$_.Trim() }
    $jobs | Remove-Job -Force
    if (($claimCounts | Measure-Object -Sum).Sum -ne 1) {
        throw "Claim concorrente inválido: resultados $($claimCounts -join ', ')."
    }

    Invoke-DryRunSqlFile 'scripts\automations\dry-run-claim-assertions.sql'
    Invoke-DryRunSqlFile 'supabase\migrations\20260805233000_automacoes_monitoramento_operacional.sql'
    Invoke-DryRunSqlFile 'scripts\automations\dry-run-monitoring-assertions.sql'

    # Segunda aplicação: valida idempotência das migrations críticas.
    Invoke-DryRunSqlFile 'supabase\migrations\20260730233000_automacoes_janela_24h.sql'
    Invoke-DryRunSqlFile 'supabase\migrations\20260729220000_automacoes_fluxo_unificado.sql'
    Invoke-DryRunSqlFile 'supabase\migrations\20260729223000_automacoes_claim_backfill.sql'
    Invoke-DryRunSqlFile 'supabase\migrations\20260729230000_automacoes_riscos_residuais.sql'
    Invoke-DryRunSqlFile 'supabase\migrations\20260805220000_lembrete_seguranca.sql'
    Invoke-DryRunSqlFile 'supabase\migrations\20260805230000_cliente_inativo_seguranca.sql'
    Invoke-DryRunSqlFile 'supabase\migrations\20260805233000_automacoes_monitoramento_operacional.sql'

    Write-Output 'AUTOMATION_POSTGRES_DRY_RUN_OK'
}
finally {
    $matchingId = docker ps -aq `
        --filter "name=^/$containerName$" `
        --filter 'label=senhora-limpeza-purpose=automation-dry-run'
    if ($matchingId) {
        docker rm --force $containerName | Out-Null
    }
}
