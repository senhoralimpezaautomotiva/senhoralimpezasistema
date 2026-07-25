# DB-001 — Baseline, backup e fonte única de migrações

Data do inventário: 2026-07-24.

## Resultado executivo

A estrutura remota não foi alterada. O ambiente disponível não possui
credenciais de banco, projeto Supabase vinculado, Supabase CLI, `pg_dump` ou
`psql`. Por isso:

- o catálogo deste documento é derivado do código e dos SQL locais, não uma
  declaração do estado real do Supabase;
- o backup real, a introspecção remota e o ensaio de restauração permanecem
  pendências operacionais bloqueantes;
- nenhum SQL local foi executado ou promovido a migration oficial;
- `supabase/migrations/` foi formalizado como única fonte autorizada;
- a baseline executável não foi criada, pois criá-la sem o banco real
  produziria uma falsa fonte da verdade.

O manifesto completo e legível por máquina está em
`docs/database/db001-manifest.json`.

## 1. Fontes inventariadas

| Fonte | Situação | Autoridade |
|---|---|---|
| Banco Supabase remoto | Sem acesso neste ambiente | Pendente; será a autoridade inicial |
| `src/db/localDb.ts` | Lido integralmente nas áreas de mapeamento, sincronização e DDL | Contrato do runtime, não schema real |
| `src/types.ts` | Lido | Modelo de domínio, não schema real |
| Componentes e servidor | Todas as chamadas `.from(...)` inventariadas | Evidência de consumo |
| Edge Function `admin-create-user` | Inventariada | Evidência de `auth.users` e `public.usuarios` |
| Quatro arquivos SQL locais | Classificados | Evidência histórica/experimental; não oficiais |
| Doze scripts avulsos | Classificados | Diagnósticos/testes; não oficiais |
| `supabase/migrations/` | Criado sem SQL executável | Única fonte oficial futura |

Não há `supabase/config.toml`, `.temp/project-ref`, histórico local de
migrations ou vínculo com projeto remoto.

## 2. Catálogo derivado do código

`status` nunca significa “confirmado no banco”. Todos os tipos, defaults,
constraints, índices, triggers e policies não demonstrados pelo runtime devem
ser coletados com `scripts/database/introspect_schema.sql`.

| Objeto | Finalidade | Colunas observadas pelo código | Evidência | Confirmação remota |
|---|---|---|---|---|
| `public.configuracoes_empresa` | Configuração pública, agenda e automações | `id`, `company_name`, `phone`, `email`, `cnpj`, `address`, `hours_of_operation`, `logo_url`, `primary_color`, `accent_color`, `referral_active`, `referral_discount_percent`, `agenda`, `automations`, `created_at`, `updated_at` | Runtime + SQL local divergente | Pendente |
| `public.clientes` | Clientes e metadados serializados | `id`, `nome`, `telefone`, `data_aniversario`, `created_at` | Runtime | Pendente |
| `public.veiculos` | Veículos por cliente | `id`, `cliente_id`, `marca`, `modelo`, `placa`, `cor`, `porte` | Runtime | Pendente |
| `public.servicos_disponiveis` | Catálogo de serviços | `id`, `nome_servico`, `observacao`, `ativo`, `categoria` | Runtime | Pendente |
| `public.agendamentos` | Agenda/ordem de serviço | `id`, `cliente_id`, `veiculo_id`, `servico_id`, `data_agendamento`, `hora_agendamento`, `status`, `valor_servico`, `tempo_real`, `observacoes`, `created_at`, `updated_at` | Runtime | Pendente |
| `public.automacoes_execucoes` | Fila e histórico de automações | `id`, `empresa_id`, `automacao`, `appointment_id`, `customer_id`, `telefone`, `mensagem`, `status`, `tentativas`, `resposta_api`, `data_execucao`, `data_proxima_tentativa`, `created_at`, `updated_at` | Runtime + DDL embutido | Pendente |
| `public.vehicle_models` | Fabricante/modelo/porte | `id`, `manufacturer`, `model`, `size_category`, `active`, `created_at`, `updated_at` | Runtime + SQL local | Pendente |
| `public.usuarios` | Perfil, papel, status, permissões e comissões | `id`, `auth_user_id`, `nome`, `email`, `telefone`, `status`, `perfil`, `foto_url`, `permissions`, `commissions`, `default_commission_percent`, `created_at`, `updated_at` | Runtime + DDL embutido | Pendente |
| `public.marcas_veiculos` | Marcas no portal | `id`, `nome`, `ativo`, `ordem` | Apenas frontend | Pendente |
| `public.modelos_veiculos` | Modelos no portal | `id`, `marca_id`, `nome`, `porte`, `ativo` | Apenas frontend | Pendente |
| `public.servicos_precos` | Preço/duração por porte | `servico_id`, `porte`, `preco`, `tempo_estimado_minutos` | Apenas frontend | Pendente |
| `auth.users` | Identidades Supabase Auth | `id` como vínculo e operações via Admin API | API + FK proposta | Pendente |

Objetos remotos ainda não confirmados:

- views e materialized views;
- sequences;
- enums, domains e tipos customizados;
- extensões;
- índices e constraints completos, inclusive ações `ON DELETE`/`ON UPDATE`;
- triggers;
- functions/RPCs;
- RLS, policies e grants por role;
- publicações Realtime;
- customizações dos schemas `auth` e `storage`;
- histórico em `supabase_migrations.schema_migrations`.

Functions citadas localmente, sem confirmação remota:

- `public.is_active_usuario_admin()`;
- `public.update_configuracoes_empresa_updated_at()`;
- `public.update_vehicle_models_updated_at()`;
- `public.get_check_constraints()` aparece somente em um diagnóstico.

A Edge Function `admin-create-user` existe no repositório. Deploy e versão
remotos não foram confirmados.

Armazenamentos que hoje são exclusivamente do navegador/memória, não tabelas
confirmadas: histórico, financeiro, logs, comissões e caches de configuração e
automações.

## 3. Divergências confirmadas localmente

| ID | Divergência | Evidência | Impacto | Tratamento |
|---|---|---|---|---|
| D-01 | Runtime usa colunas em português, mas `getPostgresSchemaSql()` cria colunas em inglês | `localDb.ts`: mapeadores versus linhas 2348–2405 | O DDL embutido não recria o schema que a aplicação consome | Não executar; decidir em DB-002 após baseline real |
| D-02 | `configuracoes_empresa.sql` não cria `agenda`, mas o runtime lê/grava essa coluna | SQL local versus `localDb.ts` 1091–1183 | Instalação por esse SQL falha ou perde configuração de agenda | Incorporar apenas o estado remoto confirmado |
| D-03 | Portal lê três tabelas sem DDL local | `ClientPortal.tsx` 203–226 | Instalação local não é reproduzível | Capturar na baseline real |
| D-04 | Existem dois catálogos de modelos | `vehicle_models` e `modelos_veiculos` | Drift de porte/modelo e duplicação conceitual | Decisão funcional somente em DB-002 |
| D-05 | Dados estruturados são serializados dentro de textos | metadados em `nome`, `modelo`, `observacao`, `observacoes` | Constraints, busca e migração ficam frágeis | Normalização é DB-002, não DB-001 |
| D-06 | História, finanças e comissões têm tipos, mas não persistência remota confirmada | `types.ts` e chaves `sl_*` | Dados podem ser locais por navegador | Modelagem posterior |
| D-07 | SQLs de segurança estão fora da pasta oficial e sem histórico verificável | raiz do projeto | Não se sabe com certeza o que foi aplicado | Comparar efeitos com banco; não reaplicar |
| D-08 | `vehicle_models.sql` concede controle total a qualquer `authenticated` | policy local | Risco de autorização se aplicado | Não aplicar; estado real deve ser auditado |

## 4. Classificação de artefatos

| Artefato | Categoria | Reexecutável/idempotente | Risco | Recomendação |
|---|---|---|---|---|
| `configuracoes_empresa.sql` | experimental / baseline parcial | não / parcial | Alto | Preservar; não executar |
| `supabase_sec001_credentials_migration.sql` | migration legada / perigosa | condicional / parcial | Alto | Confirmar efeito remoto; absorver resultado, sem replay |
| `supabase_usuarios_rls_migration.sql` | migration legada / perigosa | condicional / parcial | Alto | Confirmar efeito remoto; absorver resultado, sem replay |
| `vehicle_models.sql` | experimental / baseline parcial / seed | não / parcial | Alto | Não executar; policy permissiva e objetos duplicáveis |
| `localDb.ts#getPostgresSchemaSql` | obsoleto / duplicado / perigoso | não / parcial | Crítico | Nunca executar; diverge do próprio runtime |
| `scripts/database/introspect_schema.sql` | diagnóstico oficial | sim / sim | Baixo | Executar com acesso controlado; saída em `backups/` |
| `scripts/database/validate_restore.sql` | diagnóstico oficial / teste | sim / sim | Baixo | Comparar origem e restore isolado |
| `scripts/database/verify-backup.ts` | diagnóstico oficial / teste | sim / sim | Baixo | Executar depois de cada dump |
| `checkPorte.ts` | diagnóstico / teste / perigoso | inseguro / não | Crítico | Não executar em banco compartilhado |
| `getAgendamentosSchema.ts` | diagnóstico / obsoleto | sim / sim | Médio | Não usar como catálogo |
| `inspectAgendamentos.ts` | diagnóstico | sim / sim | Médio | Evidência complementar somente |
| `listTables.ts` | diagnóstico / obsoleto | sim / sim | Baixo | Não enumera o catálogo real |
| `logInsertErrorDetails.ts` | diagnóstico / teste / perigoso | inseguro / não | Crítico | Não executar |
| `probeAgendamentosColumns.ts` | diagnóstico / teste / perigoso | inseguro / não | Crítico | Não executar |
| `probeCaseSensitive.ts` | diagnóstico / obsoleto | sim / sim | Médio | Fora do fluxo oficial |
| `probeMoreTables.ts` | diagnóstico / obsoleto | sim / sim | Alto | Não executar em produção; imprime amostras |
| `queryPostgresCatalog.ts` | diagnóstico / obsoleto | sim / sim | Baixo | Substituído pela introspecção DB-001 |
| `testInsertAgendamentos.ts` | diagnóstico / teste / perigoso | inseguro / não | Alto | Não executar |
| `testServicosDisponiveis.ts` | diagnóstico / teste | sim / sim | Alto | Não executar em produção; imprime linhas |
| `testVehicleModels.ts` | diagnóstico / teste | sim / sim | Baixo | Fora do fluxo oficial |

Nenhum artefato foi removido. O JSON contém finalidade e recomendação
individual de todos eles.

## 5. Backup oficial e verificável

### Pré-requisitos

1. Janela operacional aprovada.
2. Responsável com acesso ao projeto de origem e à senha do banco.
3. Supabase CLI e Docker instalados; `psql` instalado para o restore.
4. Destino criptografado e com acesso restrito fora do repositório.
5. Projeto Supabase correto conferido visualmente.
6. Nenhuma credencial colada em arquivo, issue, log ou commit.

### Coleta

No PowerShell, a partir da raiz do projeto:

```powershell
supabase init
supabase login
supabase link --project-ref <PROJECT_REF_DA_ORIGEM>
$db001Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$db001Backup = Join-Path (Get-Location) "backups\db001-$db001Stamp"
New-Item -ItemType Directory -Path $db001Backup
supabase db dump --linked -f (Join-Path $db001Backup 'roles.sql') --role-only
supabase db dump --linked -f (Join-Path $db001Backup 'schema.sql')
supabase db dump --linked -f (Join-Path $db001Backup 'data.sql') --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
psql "$env:DB001_SOURCE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/database/introspect_schema.sql | Out-File -LiteralPath (Join-Path $db001Backup 'catalog.txt') -Encoding utf8
psql "$env:DB001_SOURCE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/database/validate_restore.sql | Out-File -LiteralPath (Join-Path $db001Backup 'source-counts.txt') -Encoding utf8
npm run db:backup:verify -- $db001Backup
```

`DB001_SOURCE_DATABASE_URL` deve ser injetada por secret manager apenas na
sessão operacional. Não deve ser salva em `.env`, histórico compartilhado ou
documentação.

Além do dump lógico, verificar em **Database > Backups** no Dashboard se há
backup diário/PITR utilizável e registrar fora do repositório: data/hora,
retenção e responsável. Objetos binários do Supabase Storage não fazem parte
do dump lógico; se houver buckets, o inventário e backup de objetos são uma
ação operacional separada.

### Critérios para aceitar o backup

- `roles.sql`, `schema.sql` e `data.sql` existem e não estão vazios;
- o verificador não encontra connection string com senha;
- SHA-256 e tamanho dos três arquivos são registrados;
- `schema.sql` contém DDL;
- `data.sql` contém `COPY`/`INSERT`, ou a ausência de dados é justificada e
  assinada;
- `catalog.txt` contém todas as seções sem erro;
- os arquivos permanecem em armazenamento criptografado e não versionado.

### Restauração de prova

Criar um projeto Supabase isolado ou Postgres descartável. Nunca testar restore
na origem. Habilitar antes as extensões não padrão identificadas no catálogo.

```powershell
$env:DB001_RESTORE_DATABASE_URL = '<injetar-pelo-cofre>'
psql --single-transaction --variable ON_ERROR_STOP=1 --file (Join-Path $db001Backup 'roles.sql') --file (Join-Path $db001Backup 'schema.sql') --command 'SET session_replication_role = replica' --file (Join-Path $db001Backup 'data.sql') --dbname "$env:DB001_RESTORE_DATABASE_URL"
psql "$env:DB001_RESTORE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/database/introspect_schema.sql | Out-File -LiteralPath (Join-Path $db001Backup 'restored-catalog.txt') -Encoding utf8
psql "$env:DB001_RESTORE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/database/validate_restore.sql | Out-File -LiteralPath (Join-Path $db001Backup 'restored-counts.txt') -Encoding utf8
```

Aceitar a restauração somente quando:

- o restore termina sem erro com `ON_ERROR_STOP=1`;
- catálogos de origem e alvo têm os mesmos objetos de aplicação;
- contagens por tabela coincidem;
- functions, triggers, índices, constraints e policies de `public` coincidem;
- uma sessão anônima e uma autenticada preservam os acessos esperados;
- login e leitura do próprio perfil funcionam no alvo;
- nenhuma automação externa é disparada pelo alvo isolado.

Vault/criptografia, Auth providers, Edge Functions, API keys, SMTP, Realtime,
Storage objects e configurações de plataforma exigem validação separada. Uma
restauração manual em outro projeto pode exigir tratamento específico da chave
raiz do Vault.

## 6. Fonte única e baseline canônica

### Diretórios

- `supabase/migrations/`: única fonte executável e versionada;
- `scripts/database/`: introspecção e verificadores somente leitura;
- `docs/database/`: catálogo, decisões e manifestos;
- `backups/`: dumps e saídas operacionais, sempre ignorados;
- raiz atual: artefatos legados preservados, porém não executáveis pelo fluxo
  oficial.

### Geração da baseline

Depois do backup e da confirmação remota:

```powershell
supabase migration list
supabase db pull --linked -f baseline
```

O `db pull` gera
`supabase/migrations/<YYYYMMDDHHMMSS>_baseline.sql` e registra essa versão como
aplicada na origem. Esse nome nativo foi escolhido em vez de renomear
manualmente para `20260724_000001_baseline.sql`, pois manter o mesmo version ID
no arquivo e em `supabase_migrations.schema_migrations` evita divergência de
histórico.

Antes do aceite:

1. revisar `DROP`, `TRUNCATE`, alterações de extensões e grants;
2. garantir que não há dados, PII ou segredos no arquivo;
3. comparar todas as tabelas deste inventário;
4. confirmar RLS/policies, functions, triggers, views, índices e constraints;
5. revisar customizações `auth`/`storage` separadamente;
6. executar `supabase db reset` apenas no ambiente local;
7. executar aplicação, testes e smoke tests contra o banco local recriado;
8. executar `supabase db diff --linked` e explicar qualquer diferença;
9. aprovar a baseline em revisão técnica.

O arquivo atual não foi criado porque seu conteúdo só pode vir do schema real.

### Fluxo de mudanças futuras

1. Criar migration com `supabase migration new <descricao>`.
2. Editar apenas o novo arquivo.
3. Executar `supabase db reset` local e testes de banco.
4. Revisar o SQL e o diff.
5. Aplicar em desenvolvimento.
6. Aplicar em homologação com `supabase db push --dry-run`, backup e depois
   `supabase db push`.
7. Validar aplicação/RLS/dados em homologação.
8. Repetir dry-run, backup e change approval em produção.
9. Aplicar em produção; validar e registrar versão.

### Ordem, drift e alterações manuais

- migrations têm version ID crescente, único e ordem lexicográfica;
- CI rejeita nomes incompatíveis, duplicados ou fora de ordem;
- uma migration aplicada é imutável;
- `supabase migration list` deve coincidir antes de todo deploy;
- migration atrasada/out-of-order exige nova versão; não se retrodata;
- Dashboard/SQL Editor não são canal de mudança;
- acesso de escrita manual deve ser restrito a break-glass auditado;
- qualquer intervenção emergencial deve ser capturada imediatamente em nova
  migration e validada por drift;
- executar periodicamente `supabase db diff --linked`; saída inesperada bloqueia
  deploy.

### Rollback

- migrations normais devem descrever rollback e risco no pull request;
- preferir correção forward-only quando já aplicada em produção;
- rollback destrutivo só com restore comprovado e janela aprovada;
- antes de cada deploy remoto: backup verificado e ponto de recuperação;
- `supabase db reset --linked` é proibido em produção e não faz parte do
  rollback.

## 7. Validações automatizadas da DB-001

`npm run test:db001` valida:

- manifesto parseável e com estado remoto honesto;
- pasta oficial única;
- ausência de migration executável antes da confirmação remota;
- nomes e ordem determinísticos quando migrations forem adicionadas;
- todos os SQLs/diagnósticos conhecidos classificados;
- divergências críticas registradas;
- scripts de introspecção/restore são somente leitura;
- backups e temporários estão ignorados;
- verificador rejeita dump ausente/vazio e aceita sentinelas válidas;
- regressões de SEC-001 a SEC-005 permanecem no pipeline consolidado.

O teste de clean install (`supabase db reset`) e o restore real não podem ser
simulados honestamente sem CLI, Docker, baseline e backup reais. Eles permanecem
gates operacionais, não testes marcados falsamente como aprovados.

## 8. Itens reservados para DB-002 ou posteriores

Não foram implementados:

- decidir e normalizar nomes português/inglês;
- extrair metadados serializados de campos texto;
- consolidar `vehicle_models` e `modelos_veiculos`;
- criar persistência para histórico, financeiro e comissões;
- alterar FKs, cascatas, checks, uniques, índices ou defaults;
- rever modelagem de preços por porte;
- rever RLS/policies das tabelas de negócio;
- migrar dados;
- remover scripts legados;
- corrigir regras de agenda, clientes, veículos, preços ou automações.

## 9. Pendências operacionais bloqueantes

| Pendência | Responsável sugerido | Evidência de conclusão |
|---|---|---|
| Fornecer acesso controlado ao projeto Supabase | Owner/DBA | projeto vinculado sem credenciais versionadas |
| Instalar CLI, Docker e `psql` | DevOps | versões registradas |
| Gerar e verificar dump | DBA | três arquivos, hashes e verificador aprovado |
| Executar introspecção remota | DBA + Tech Lead | `catalog.txt` revisado |
| Testar restore isolado | DBA | log sem erros e contagens equivalentes |
| Confirmar backup/PITR do Dashboard | Owner | data, retenção e responsável |
| Gerar baseline por `db pull` | Tech Lead | migration revisada e histórico alinhado |
| Validar clean install | Tech Lead | `supabase db reset` aprovado |
| Confirmar drift zero explicado | Tech Lead | diff vazio ou decisão registrada |

Até a conclusão dessas pendências, nenhuma alteração estrutural deve avançar
para DB-002.
