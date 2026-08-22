# Histórico de trabalho e alterações

Este documento é o registro contínuo das auditorias, decisões e mudanças
realizadas no sistema da Senhora Limpeza Estética Automotiva.

Ele complementa o histórico das conversas do Codex. As conversas explicam o
contexto; este arquivo registra de forma durável o que foi analisado ou
modificado no projeto.

## Como utilizar este histórico

- As entradas são acrescentadas em ordem cronológica e não devem ser apagadas.
- Cada conversa ou etapa relevante recebe uma entrada própria.
- “Alterado localmente” não significa “aplicado no banco” nem “publicado”.
- Nenhum segredo ou dado pessoal de cliente deve ser incluído.
- Antes de tentar desfazer algo, confirme o estado atual dos arquivos e do
  ambiente para não remover mudanças posteriores.

---

## 2026-07-30-001 — Auditoria inicial das automações e criação do histórico

**Etapa relacionada:** planejamento geral das automações.

**Objetivo:** mapear o funcionamento atual das automações e estabelecer um
registro permanente para as próximas etapas do trabalho.

### Trabalho realizado

- Mapeado o fluxo de eventos do banco, fila persistente, worker do servidor e
  transporte via Make/Z-API.
- Rastreados os gatilhos de novo cliente, novo agendamento, serviço iniciado e
  serviço finalizado.
- Analisadas as rotinas periódicas de aniversário, cliente inativo e lembrete
  de agendamento.
- Identificadas divergências entre o comportamento atual e os requisitos:
  bloqueio de envios entre 20h e 08h, lembrete fixo em 60 minutos, parâmetro de
  mínimo de atendimentos não utilizado, risco de fuso horário, hospedagem que
  pode adormecer e sucesso simulado quando não há provedor configurado.
- Definido um plano de cinco etapas: validação do ambiente real, correção das
  regras, confiabilidade do envio, operação 24/7 e testes/liberação gradual.
- Criada uma instrução permanente para que futuras tarefas mantenham este
  histórico atualizado.

### Arquivos criados

- `AGENTS.md`
- `docs/HISTORICO_DE_ALTERACOES.md`

### Arquivos funcionais alterados

- Nenhum.

### Banco, hospedagem e serviços externos

- Nenhuma migration foi executada.
- Nenhuma tabela ou informação do Supabase foi modificada.
- Nenhuma configuração do Render, Make ou Z-API foi modificada.
- Nenhuma mensagem foi enviada a clientes.

### Verificações executadas

- `npm run test:automations`: 10 testes aprovados, nenhuma falha.
- `npm run test:stabilization`: 15 testes aprovados, nenhuma falha.
- A auditoria constatou que esses testes ainda não cobrem integralmente as
  regras periódicas, o fuso horário e a entrega real pelo WhatsApp.

### Riscos e pendências

- Ainda é necessário confirmar quais migrations estão aplicadas no Supabase
  real.
- Ainda é necessário confirmar a configuração e disponibilidade efetiva do
  provedor de WhatsApp.
- O ambiente atual documentado no Render não garante worker ativo 24 horas.
- O disco `C:` estava sem espaço durante a auditoria; os temporários sob nosso
  controle devem ser direcionados ao disco `D:`.

### Como desfazer

Esta entrada não alterou o funcionamento do sistema. Para remover apenas a
estrutura de documentação criada nesta tarefa, seria necessário excluir
`AGENTS.md` e `docs/HISTORICO_DE_ALTERACOES.md`. Essa remoção perderia o
histórico permanente e só deve ser feita com autorização explícita.

---

## 2026-07-30-002 — Início da Noite 1 e correção do inventário DB-001

**Etapa relacionada:** Noite 1 — Verificação do ambiente real.

**Objetivo:** iniciar a conferência de migrations, filas, gatilhos e provedor,
sem enviar mensagens nem modificar o ambiente real.

### Trabalho realizado

- Confirmada localmente a sequência de oito migrations oficiais, incluindo as
  quatro migrations recentes do fluxo de automações.
- Classificados no manifesto DB-001 as quatro migrations recentes e os seis
  scripts operacionais e de dry-run que ainda não estavam inventariados.
- Confirmada a ausência local de vínculo do Supabase, Supabase CLI, arquivo de
  ambiente real, variáveis de integração e Render CLI.
- Tentado acesso somente de leitura aos painéis do Supabase e do Render; ambos
  exigiram autenticação.
- Atualizado o cronograma para registrar a Noite 1 como em andamento e indicar
  os bloqueios atuais.

### Arquivos alterados

- `docs/database/db001-manifest.json`
- `docs/PLANO_DIARIO_AUTOMACOES.md`
- `docs/HISTORICO_DE_ALTERACOES.md`

### Banco, hospedagem e serviços externos

- Nenhuma migration foi executada.
- Nenhuma tabela, registro ou configuração do Supabase foi modificado.
- Nenhuma configuração do Render, Make ou Z-API foi modificada.
- Nenhuma mensagem foi enviada.

### Verificações executadas

- `npm run test:automations`: 10 testes aprovados.
- `npm run test:stabilization`: 15 testes aprovados.
- `npm run test:db001`: inicialmente 9 aprovados e 2 reprovados por inventário
  desatualizado; após a correção, 11 aprovados e nenhuma falha.
- Validação sintática do JSON do manifesto: aprovada.

### Riscos, limitações e pendências

- O estado das migrations, filas, gatilhos e volumes no Supabase real ainda não
  foi confirmado porque o painel requer autenticação.
- O provedor efetivamente configurado no Render ainda não foi identificado pelo
  mesmo motivo.
- O telefone autorizado para testes ainda precisa ser informado e confirmado.
- A Noite 1 permanece em andamento e não autoriza o início da Noite 2.

### Como desfazer

Para desfazer apenas esta alteração local, restaurar a versão anterior de
`docs/database/db001-manifest.json` e remover, por uma nova correção registrada,
as mudanças desta entrada em `docs/PLANO_DIARIO_AUTOMACOES.md`. Não há reversão
externa, pois banco, hospedagem e provedores não foram alterados.

---

## 2026-07-30-003 — Verificação somente de leitura do Render

**Etapa relacionada:** Noite 1 — Verificação do ambiente real.

**Objetivo:** confirmar o serviço publicado, sua configuração essencial e o
provedor de mensagens, sem revelar segredos nem alterar o ambiente.

### Trabalho realizado

- Confirmado o serviço `senhora-limpeza-piloto` no plano gratuito e gerenciado
  por Blueprint.
- Confirmado que o último deploy exibido pelo painel está ativo.
- Conferidos somente os nomes das variáveis de ambiente, mantendo todos os
  valores ocultos.
- Confirmadas as configurações de Supabase e a presença de
  `MAKE_WEBHOOK_URL`; não foram encontradas variáveis da Z-API.
- Acessado o endereço público para acordar a instância gratuita e confirmar a
  abertura da tela de login do sistema.
- Consultada a janela recente de logs; o painel não apresentou registros na
  última hora e informou que os mais recentes eram de cerca de 20 horas antes.

### Arquivos alterados

- `docs/PLANO_DIARIO_AUTOMACOES.md`
- `docs/HISTORICO_DE_ALTERACOES.md`

### Banco, hospedagem e serviços externos

- Nenhuma configuração do Render foi modificada e nenhum deploy foi iniciado.
- Nenhuma migration, tabela ou registro do Supabase foi modificado.
- Nenhuma configuração do Make foi modificada e nenhum webhook foi acionado.
- Nenhuma mensagem foi enviada.
- A única ação externa foi uma requisição HTTP de leitura ao sistema publicado,
  que acordou a instância gratuita.

### Verificações executadas

- Painel do Render autenticado e serviço identificado: aprovado.
- Último deploy com estado `live`: aprovado.
- Inventário dos nomes das variáveis obrigatórias do Supabase: presente.
- Provedor configurado: Make presente; Z-API não configurada no serviço.
- Abertura pública após o cold start: aprovada; tela de login carregada.
- Logs do worker na última hora: inconclusivos por ausência de registros.

### Riscos, limitações e pendências

- O plano gratuito adormece por inatividade e pode atrasar requisições.
- A ausência de logs recentes não comprova que o worker processa filas
  continuamente.
- Ainda é necessário autenticar no Supabase, conferir migrations, filas e
  gatilhos e definir o telefone autorizado.
- A Noite 1 permanece em andamento.

### Como desfazer

Não há mudança externa a desfazer. Para reverter apenas a documentação local,
restaurar a redação anterior de `docs/PLANO_DIARIO_AUTOMACOES.md` e registrar
uma nova correção no histórico; não apagar esta entrada.

---

## 2026-07-30-004 — Validação da Noite 1 no Supabase real

**Etapa relacionada:** Noite 1 — Verificação do ambiente real.

**Objetivo:** conferir migrations, fila e gatilhos no Supabase real, confirmar o
telefone autorizado e encerrar a primeira etapa sem mensagens acidentais.

### Trabalho realizado

- Confirmado o projeto Supabase utilizado pelo ambiente publicado.
- Conferidas as tabelas e colunas pelo painel, sem abrir dados pessoais.
- Executada uma única consulta agregada e somente de leitura para verificar
  versões de migrations, existência dos objetos e totais da fila por status.
- Confirmado o telefone autorizado para testes futuros; somente o final
  mascarado `***9796` foi registrado.
- Identificado drift entre o repositório, o histórico oficial de migrations e
  a estrutura efetivamente presente no banco.
- Marcada a Noite 1 como validada e criado um gate de alinhamento do banco antes
  da Noite 2.

### Evidências do ambiente real

- O histórico `supabase_migrations.schema_migrations` registra somente:
  `20260724210000`, `20260724213000` e `20260724224500`.
- `automacoes_execucoes` existe com as 14 colunas da migration inicial, embora
  a versão `20260727220000` não apareça no histórico oficial.
- A fila possui 50 registros agregados: 33 em `sucesso` e 17 em
  `erro_definitivo`; não havia registros pendentes no agrupamento consultado.
- A coluna `deduplication_key` não existe.
- Nenhuma das três colunas de claim existe.
- A tabela `automacoes_eventos` não existe.
- Nenhum gatilho de negócio `trigger_enfileirar_*` existe nas tabelas de
  clientes ou agendamentos.
- O único gatilho relacionado à fila é o de atualização de `updated_at`.

### Arquivos alterados

- `docs/PLANO_DIARIO_AUTOMACOES.md`
- `docs/HISTORICO_DE_ALTERACOES.md`

### Banco, hospedagem e serviços externos

- Nenhuma migration foi executada.
- Nenhuma tabela, linha, função, policy ou gatilho foi modificado.
- Nenhuma configuração do Supabase, Render ou Make foi alterada.
- Nenhuma mensagem foi enviada.
- A consulta executada foi agregada e somente de leitura.

### Verificações e testes

- Estrutura da fila comparada com as migrations locais: drift confirmado.
- Histórico oficial comparado com os oito arquivos locais: cinco versões de
  automação não estão registradas no ledger remoto.
- Contagem agregada da fila: concluída sem exposição de telefones ou clientes.
- Verificação visual dos gatilhos: nenhum gatilho de negócio encontrado.
- Resultados locais já obtidos nesta noite: 10/10 testes de automações, 15/15
  testes de estabilização e 11/11 testes DB-001 aprovados.

### Riscos, limitações e pendências

- A tabela de fila foi criada fora do histórico oficial ou sua versão não foi
  registrada, portanto não se deve aplicar migrations às cegas.
- As quatro migrations posteriores da automação dependem de ordem e dry-run.
- Os 17 erros definitivos precisam ser analisados apenas por metadados seguros
  antes de qualquer reprocessamento.
- O plano gratuito do Render não garante worker contínuo.
- O próximo passo é preparar backup, dry-run e plano de aplicação/reversão;
  qualquer migration real dependerá de aprovação explícita.

### Como desfazer

Não há alteração externa a desfazer. Para reverter apenas a mudança de estado
do cronograma, registrar nova entrada corretiva e devolver a Noite 1 para
**Em andamento**. Não apagar esta entrada nem remover as evidências históricas.

---

## 2026-07-30-005 — Alinhamento das migrations no Supabase de testes

**Etapa relacionada:** gate técnico entre a Noite 1 e a Noite 2.

**Objetivo:** alinhar o schema remoto com a sequência oficial das automações,
validar os invariantes de fila e reativar o serviço sem enviar mensagens.

### Decisão e escopo autorizados

- O responsável confirmou que o Supabase não contém dados reais e pode ser
  tratado como laboratório descartável, sem backup de dados de negócio.
- Foi mantido apenas o registro técnico de contagens e estrutura.
- O telefone autorizado continuou mascarado e não foi usado nesta etapa.

### Trabalho realizado

- Confirmada a indisponibilidade local de Docker e `psql`; por isso o dry-run
  PostgreSQL efêmero não pôde ser executado nesta máquina.
- Suspenso temporariamente o serviço no Render antes da alteração do schema.
- Aplicadas e registradas, em ordem, as migrations:
  - `20260727220000_automacoes_execucoes.sql`;
  - `20260728220000_automacoes_triggers_nativos.sql`;
  - `20260729220000_automacoes_fluxo_unificado.sql`;
  - `20260729223000_automacoes_claim_backfill.sql`;
  - `20260729230000_automacoes_riscos_residuais.sql`.
- A migration inicial da fila era estruturalmente idempotente e foi usada para
  reconciliar o ledger com a tabela já existente.
- O serviço foi reativado no Render após a validação do banco.

### Incidente controlado durante a aplicação

- Na primeira tentativa da migration de fluxo unificado, o editor SQL reteve
  conteúdo anterior e montou uma consulta duplicada.
- O PostgreSQL recusou a consulta com erro de sintaxe antes do `COMMIT`; a
  versão não foi registrada e nenhuma alteração dessa tentativa persistiu.
- O conteúdo foi substituído integralmente, conferido pela quantidade correta
  de linhas e reaplicado com sucesso.

### Arquivos alterados

- `docs/PLANO_DIARIO_AUTOMACOES.md`
- `docs/HISTORICO_DE_ALTERACOES.md`

### Banco, hospedagem e serviços externos

- As cinco migrations de automação foram aplicadas ao Supabase de testes.
- O ledger remoto passou a registrar todas as oito migrations oficiais.
- O Render foi suspenso durante a janela e reativado ao final.
- Nenhum deploy novo foi iniciado e nenhuma configuração do Make foi alterada.
- Nenhuma mensagem foi enviada.

### Validações do banco

- `automacoes_eventos` presente.
- `deduplication_key` presente.
- Três colunas de claim presentes.
- Três gatilhos de negócio presentes.
- Permissão de claim para `service_role`: aprovada.
- Permissão de atualização concorrente de configuração para `service_role`:
  aprovada.
- Execuções vazias pendentes: zero.
- Claims em processamento sem token: zero.
- Pagamentos ambíguos pendentes: zero.
- Outbox vazio ao final, como esperado sem novos fatos de negócio.
- Fila legada preservada: 33 sucessos e 17 erros definitivos.

### Testes executados

- `npm run test:automations`: 10 aprovados.
- `npm run test:stabilization`: 15 aprovados.
- `npm run test:db001`: 11 aprovados.
- Consulta agregada pós-migration: todos os invariantes esperados aprovados.
- `GET /health` no serviço reativado: HTTP 200 com estado `ok`.

### Riscos, limitações e pendências

- O dry-run Docker continua sem execução nesta máquina; a validação ocorreu no
  próprio ambiente descartável autorizado.
- Os 17 erros definitivos legados foram preservados e não devem ser
  reprocessados automaticamente.
- O plano gratuito do Render ainda pode adormecer e não garante worker
  contínuo.
- A próxima etapa é a Noite 2; qualquer teste real de WhatsApp continuará
  restrito ao telefone autorizado.

### Como desfazer

Não existe rollback seguro para restaurar os produtores SQL antigos. Como o
ambiente foi declarado descartável, a reversão recuperável é recriar o projeto
de testes a partir das migrations oficiais até a versão desejada. Em caso de
falha funcional, suspender novamente o Render e corrigir para frente; não
remover isoladamente a tabela de outbox, os claims ou os gatilhos.

---

## 2026-07-30-006 — Preparação do teste real controlado de novo cliente

**Etapa relacionada:** continuação do primeiro dia, validação integrada do
pipeline de automações em laboratório.

**Objetivo:** preparar e tentar um único envio autorizado de WhatsApp para o
cliente de teste Pedro, mantendo proteção contra duplicidade e sem expor dados
pessoais no histórico.

### Trabalho realizado

- Criada a migration oficial
  `20260730225000_configuracoes_empresa_runtime.sql` para disponibilizar a
  configuração pública de execução esperada pelo servidor.
- Atualizados o manifesto DB-001 e o teste de baseline para incluir a nova
  migration.
- Aplicada e registrada a migration no Supabase de testes.
- Configurada temporariamente apenas a automação `novo_cliente`, com mensagem
  explícita de teste autorizado; as demais automações ficaram fora desta
  configuração controlada.
- Confirmado que o Render aponta para o mesmo projeto Supabase e possui chaves
  pública e administrativa em formatos distintos e compatíveis.
- Recarregado o schema do PostgREST e reiniciado o serviço no Render.
- Confirmado no log que `supabase.config.load` passou de `table_not_found` para
  `success`.
- Confirmado exatamente um cadastro alvo para Pedro, com telefone registrado
  neste documento somente como `***4579`.
- Criado exatamente um evento `novo_cliente`, protegido pela chave de
  deduplicação exclusiva deste teste.

### Arquivos criados ou alterados

- `supabase/migrations/20260730225000_configuracoes_empresa_runtime.sql`
- `docs/database/db001-manifest.json`
- `tests/db001-baseline.test.ts`
- `docs/HISTORICO_DE_ALTERACOES.md`

### Banco, hospedagem e serviços externos

- Migration `20260730225000` aplicada e registrada no Supabase de testes.
- Uma linha de configuração controlada foi criada/atualizada no Supabase.
- Um evento de teste foi criado em `automacoes_eventos`.
- O serviço Render foi suspenso e reativado para reinício controlado.
- Nenhum deploy de código novo foi publicado.
- Nenhuma alteração foi feita no cenário do Make.
- Até o fechamento desta entrada, nenhuma mensagem foi enviada: o evento
  permanece `pendente`, com zero tentativas e sem erro.

### Verificações e testes

- `npm run test:db001`: 11 aprovados.
- `npm run test:automations`: 10 aprovados.
- `npm run test:stabilization`: 15 aprovados.
- `GET /health` após reativação: HTTP 200, estado `ok`.
- Configuração no servidor: carregamento confirmado como `success`.
- Cliente alvo: uma correspondência por nome e telefone normalizado.
- Deduplicação: uma única inserção, com estado inicial `pendente`.
- Monitoramento após ciclos do trabalhador: zero tentativas; portanto não
  houve entrega nem duplicidade.

### Riscos, limitações e pendências

- O trabalhador do Render sincroniza clientes, veículos, serviços e
  agendamentos, mas não consumiu a fila protegida nesta execução.
- Há erros legados de sincronização em tabelas auxiliares que ainda precisam
  ser separados do bloqueio da fila.
- Para acionar o mesmo motor imediatamente pela rota administrativa, falta uma
  sessão autenticada de administrador ou gerente no sistema.
- O evento deve continuar preservado e não deve ser recriado; a chave de
  deduplicação já impede uma segunda inserção idêntica.

### Como desfazer

- Para cancelar somente este teste antes do envio, atualizar o evento desta
  etapa para um estado final de cancelamento documentado, sem apagar a linha.
- Para desfazer a configuração controlada, restaurar o JSON anterior de
  `configuracoes_empresa.automations` por uma nova alteração registrada.
- Para reverter a migration em ambiente descartável, preferir recriar o banco
  até a versão anterior. Não remover a tabela isoladamente enquanto o servidor
  depender dela.

---

## 2026-07-30-007 — Diagnóstico da janela operacional no teste autorizado

**Etapa relacionada:** continuação da validação integrada iniciada na entrada
`2026-07-30-006`.

**Objetivo:** acionar a execução autorizada pelo painel administrativo e
confirmar o comportamento da fila fora da janela de funcionamento.

### Trabalho realizado

- Realizado acesso ao sistema com conta administrativa fornecida pelo
  responsável; nenhuma credencial foi registrada neste documento.
- Confirmado no painel que o evento anterior foi convertido em exatamente uma
  execução para o contato mascarado `***4579`.
- Confirmado que a execução ficou pendente e foi postergada por estar fora da
  janela 08:00–20:00.
- Testada temporariamente a alteração visual do término da janela para 23:59.
- Identificado que o painel mostra confirmação de salvamento, mas
  `saveConfigToSupabase` não persiste `automationStartHour` nem
  `automationEndHour`, e o carregamento do servidor também não restaura esses
  campos. O backend, portanto, continuou usando 20:00.
- Restaurado o valor visual para 20:00.
- A execução foi mantida única, pendente e sem tentativas.
- O serviço no Render foi suspenso preventivamente para impedir envio
  posterior inesperado enquanto o defeito não for corrigido.

### Arquivos alterados

- `docs/HISTORICO_DE_ALTERACOES.md`

Nenhum código foi alterado nesta etapa. A investigação mostrou que a correção
exige mudança de código, migration e um novo deploy.

### Banco, hospedagem e serviços externos

- O campo `data_execucao` da única execução de teste foi ajustado durante o
  diagnóstico, mas o backend voltou a postergá-la pela janela efetiva de 20:00.
- Nenhuma nova execução e nenhum novo evento foram criados.
- Nenhuma mensagem foi enviada e o Make não foi acionado.
- Render suspenso preventivamente ao final.

### Verificações e resultados

- Login administrativo: aprovado.
- Quantidade de execuções controladas: uma.
- Estado final observado: `pendente`, zero de três tentativas.
- Telefone exibido e registrado apenas de forma mascarada.
- Defeito reproduzido: confirmação visual de salvamento sem persistência da
  janela operacional no backend.

### Riscos, limitações e pendências

- A cópia local disponibilizada ao Codex não contém metadados `.git`; por isso
  não é possível publicar a correção no branch que alimenta o Render a partir
  deste diretório sem recuperar ou vincular o repositório.
- O cenário do Make ainda precisa ser inspecionado para validar o trecho final
  da integração.
- O Render deve permanecer suspenso até a execução ser cancelada de forma
  auditável ou até a correção ser publicada e testada.

### Como desfazer

- Reativar o Render somente depois de resolver a pendência da execução.
- Para desfazer o ajuste de diagnóstico no banco, registrar uma nova alteração
  que defina explicitamente o destino da execução; não apagar a linha.
- Nenhum rollback de código é necessário nesta entrada, pois não houve
  alteração funcional local.

---

## 2026-07-30-008 — Auditoria do cenário Make e bloqueio de publicação

**Etapa relacionada:** validação do provedor para o teste controlado.

**Objetivo:** verificar o caminho webhook → provedor, o histórico de respostas
e a compatibilidade entre o payload atual do backend e o cenário do Make.

### Trabalho realizado

- Inspecionado o único cenário ativo relacionado à integração.
- Confirmado o fluxo com dois módulos: webhook personalizado seguido de
  requisição HTTP ao provedor de WhatsApp.
- Confirmado em execução histórica que ambos os módulos concluíram e que o
  provedor respondeu HTTP 200.
- Confirmado que o cenário registra aceitação HTTP, mas não contém módulo
  adicional de resposta ao webhook nem acompanhamento de entrega ao aparelho.
- Comparado o mapeamento do Make com `src/server/automationTransport.ts`.
- Identificada incompatibilidade: o backend atual publica `phone` e `message`,
  enquanto o cenário ainda consome os campos legados `telefone` e
  `formattedMessage`.
- Verificada a possibilidade de publicar a correção pelo GitHub; o CLI está
  instalado, mas a autenticação da conta configurada está inválida.

### Arquivos alterados

- `docs/HISTORICO_DE_ALTERACOES.md`

Nenhum código, migration ou configuração foi alterado nesta etapa.

### Banco, hospedagem e serviços externos

- Make apenas inspecionado; nenhum cenário foi executado, reprocessado, salvo
  ou modificado.
- Nenhum webhook foi acionado e nenhuma mensagem foi enviada.
- Render permaneceu suspenso.
- Supabase não foi alterado nesta etapa.

### Verificações e resultados

- Cenário Make: ativo.
- Última execução histórica visível: sucesso técnico com duas operações.
- Resposta histórica do módulo HTTP: status 200.
- Confirmação de entrega ao destinatário: inexistente no cenário atual.
- Compatibilidade do payload atual: reprovada.
- Pré-requisito de publicação: `gh` disponível, autenticação inválida.

### Riscos, limitações e pendências

- HTTP 200 indica aceitação da requisição, não comprova entrega da mensagem.
- As credenciais do provedor estão armazenadas diretamente no módulo HTTP e
  devem ser rotacionadas após esta auditoria; nenhum valor foi registrado.
- Não executar replay de histórico: ele poderia reenviar mensagens antigas
  para contatos que não fazem parte deste teste.
- O deploy depende de nova autenticação no GitHub e de um checkout válido do
  repositório.

### Como desfazer

Não há mudança funcional a desfazer. Para corrigir o registro, acrescentar uma
nova entrada; não apagar esta auditoria. Manter o Render suspenso até publicar
e validar as correções.

---

## 2026-07-30-009 — Correção local da janela 24h e compatibilidade com o Make

**Etapa relacionada:** correção dos bloqueios encontrados nas entradas
`2026-07-30-007` e `2026-07-30-008`.

**Objetivo:** persistir a janela operacional, adicionar o modo Envios 24 horas
e manter compatibilidade temporária com os campos legados do cenário Make.

### Trabalho realizado

- Recuperado um checkout limpo do branch `piloto-2026` após autenticação do
  GitHub CLI.
- Adicionada a configuração pública `automation24Hours`.
- O carregamento e o salvamento da configuração passaram a incluir início,
  término e modo 24 horas.
- O worker passou a ignorar a janela somente quando o modo 24 horas estiver
  explicitamente ligado.
- Adicionado o controle visual **Envios 24 horas** ao módulo de automações.
- O payload enviado ao Make mantém `phone` e `message` como contrato atual e
  adiciona aliases temporários `telefone` e `formattedMessage`.
- As migrations de automação aplicadas anteriormente no laboratório foram
  incorporadas ao checkout oficial.
- Criada e aplicada a migration
  `20260730233000_automacoes_janela_24h.sql`.

### Arquivos criados ou alterados

- `src/types.ts`
- `src/security/publicConfig.ts`
- `src/db/localDb.ts`
- `src/db/automationEngine.ts`
- `src/server/automationTransport.ts`
- `src/components/AutomacoesTab.tsx`
- `supabase/migrations/20260728220000_automacoes_triggers_nativos.sql`
- `supabase/migrations/20260729220000_automacoes_fluxo_unificado.sql`
- `supabase/migrations/20260729223000_automacoes_claim_backfill.sql`
- `supabase/migrations/20260729230000_automacoes_riscos_residuais.sql`
- `supabase/migrations/20260730225000_configuracoes_empresa_runtime.sql`
- `supabase/migrations/20260730233000_automacoes_janela_24h.sql`
- `scripts/automations/*`
- `docs/database/db001-manifest.json`
- `tests/db001-baseline.test.ts`
- `tests/stabilization-regressions.test.ts`
- `docs/HISTORICO_DE_ALTERACOES.md`

### Banco, hospedagem e serviços externos

- Migration `20260730233000` aplicada e registrada no Supabase de testes.
- Confirmadas três colunas novas, uma versão no ledger e valores padrão
  `08:00`, `20:00` e modo 24 horas desligado.
- Render continua suspenso.
- Make não foi alterado nem executado.
- O código ainda não havia sido publicado no fechamento desta entrada.
- Nenhuma mensagem foi enviada.

### Verificações e testes

- `npm run lint`: aprovado.
- `npm run test:stabilization`: 14 aprovados.
- `npm run test:db001`: 11 aprovados.
- `npm run build`: aprovado, incluindo políticas de artefato e piloto.
- Validação remota da migration: três colunas, ledger presente e defaults
  corretos.

### Riscos, limitações e pendências

- A compatibilidade com campos legados deve ser removida somente depois de
  migrar e validar o cenário Make com o contrato atual.
- Ainda falta commit, push, deploy do Render e teste real controlado.
- As credenciais vistas no módulo Make devem ser rotacionadas após a
  estabilização; nenhum valor foi registrado.

### Como desfazer

- Antes do deploy, descartar apenas o checkout temporário recuperado.
- Após o deploy, reverter por um novo commit que remova o controle 24 horas e
  os aliases, mantendo as migrations já aplicadas.
- Para desativar o comportamento sem rollback, manter
  `automation_24_hours=false`.

---

## 2026-07-30-010 — Deploy e teste técnico do envio 24 horas

**Etapa relacionada:** Noite 2 — Controle “Envios 24 horas”.

**Objetivo:** publicar a correção, ativar o modo 24 horas e validar um envio
único pelo pipeline sistema → Make → provedor.

### Trabalho realizado

- Commit `e00bfe3` enviado ao branch `piloto-2026`.
- Deploy manual iniciado no Render porque o disparo automático do serviço
  estava desligado.
- Pipeline completa do Render concluída e serviço publicado.
- Controle **Envios 24 horas** confirmado na interface.
- Modo 24 horas ligado e persistido no Supabase.
- Liberada somente a execução controlada criada anteriormente.
- Acompanhados o painel, o banco e o histórico do Make.

### Arquivos alterados

- `docs/PLANO_DIARIO_AUTOMACOES.md`
- `docs/HISTORICO_DE_ALTERACOES.md`

As alterações funcionais e migrations estão relacionadas na entrada
`2026-07-30-009`.

### Banco, hospedagem e serviços externos

- Supabase confirmou `automation_24_hours=true`, mantendo a janela cadastrada
  como 08:00–20:00 para quando o modo for desligado.
- Render publicou o commit `e00bfe3` e permaneceu ativo no plano gratuito.
- Make recebeu exatamente uma execução nova e concluiu seus dois módulos.
- O provedor respondeu HTTP 200.
- Nenhuma alteração foi salva no cenário Make.

### Verificações e resultados

- Build do Render: aprovado.
- Endpoint `/health`: HTTP 200, estado `ok`.
- Fila do sistema: uma execução controlada.
- Tentativas: uma.
- Estado final no sistema: `sucesso`.
- Make: uma execução instantânea, duas operações, estado `Success`.
- Módulo HTTP: status 200.
- Duplicidade técnica: não detectada.

### Riscos, limitações e pendências

- HTTP 200 prova aceitação técnica, não entrega no aparelho.
- A Noite 2 permanece **Implementada** até o responsável confirmar o
  recebimento da mensagem no telefone autorizado.
- O modo 24 horas está ligado para os testes noturnos.
- Credenciais do provedor e hook de deploy devem ser rotacionados após a
  estabilização, pois ficaram visíveis em telas administrativas durante a
  auditoria; nenhum valor foi registrado.

### Como desfazer

- Desligar **Envios 24 horas** e salvar para voltar à janela 08:00–20:00.
- Para reverter o código, publicar um novo commit que reverta `e00bfe3`.
- Não reenviar nem reprocessar a execução desta etapa; ela já terminou com
  sucesso técnico.

## 2026-07-30-011 — Confirmação de entrega no aparelho autorizado

### Tarefa, conversa ou etapa relacionada

- Conclusão da Noite 2 — Controle “Envios 24 horas”.

### Objetivo

- Registrar o recebimento real da mensagem de teste e encerrar a validação de
  ponta a ponta da Noite 2.

### Trabalho realizado

- O usuário confirmou que a mensagem chegou ao aparelho autorizado.
- A Noite 2 foi marcada como **Validada** no cronograma.
- A próxima ação foi atualizada para a Noite 3 — Mensagens imediatas.
- Nenhuma nova mensagem foi enviada nesta etapa.

### Arquivos alterados

- `docs/PLANO_DIARIO_AUTOMACOES.md`
- `docs/HISTORICO_DE_ALTERACOES.md`

### Banco, hospedagem e serviços externos

- Nenhuma alteração adicional foi aplicada ao Supabase, Render ou Make.
- Nenhuma nova publicação funcional foi necessária.

### Verificações e resultados

- Sistema: uma execução concluída com sucesso e uma única tentativa.
- Make: uma única execução concluída com sucesso e dois módulos processados.
- Provedor: resposta HTTP 200.
- Aparelho autorizado: recebimento confirmado pelo usuário.
- Duplicidade: nenhuma segunda execução ou tentativa foi observada.

### Riscos, limitações e pendências

- O modo de envios por 24 horas permanece ligado para os testes noturnos.
- Credenciais que tenham ficado visíveis durante a operação assistida devem ser
  rotacionadas posteriormente; nenhum valor foi registrado.
- Próxima etapa: iniciar e validar a Noite 3 — Mensagens imediatas.

### Como desfazer

- Esta etapa altera somente documentação. Eventuais correções devem ser feitas
  por uma nova entrada, sem apagar esta.
- Não há alteração de banco, hospedagem ou serviço externo a desfazer.

## 2026-07-30-012 — Início da Noite 3 e correções das mensagens imediatas

### Tarefa, conversa ou etapa relacionada

- Noite 3 — Mensagens imediatas.

### Objetivo

- Validar novo cliente, agendamento pelo cliente, agendamento pelo operador,
  serviço iniciado e serviço finalizado, exigindo exatamente uma mensagem para
  cada fato.

### Trabalho realizado

- A auditoria encontrou apenas uma das quatro automações imediatas configurada
  no Supabase.
- Criada migration idempotente que acrescenta somente automações ausentes e
  preserva integralmente qualquer entrada existente.
- O teste real pelo painel administrativo criou um agendamento controlado,
  iniciou o atendimento e tentou finalizá-lo.
- A tentativa inicial de finalização revelou que a interface mostrava sucesso,
  mas enviava ao banco um estado não aceito pelo schema; o erro também era
  absorvido pelo componente superior.
- Corrigido o mapeamento de finalização para o estado persistido aceito pelo
  Supabase e removida a absorção silenciosa das falhas de atualização.
- A correção foi publicada e o mesmo atendimento foi finalizado novamente com
  persistência confirmada.
- Criado um cliente estritamente técnico, usando apenas um telefone autorizado,
  para validar o evento de novo cliente.

### Arquivos criados ou alterados

- Criado:
  `supabase/migrations/20260731001000_automacoes_imediatas_defaults.sql`.
- Alterados: `src/App.tsx`, `src/db/localDb.ts`,
  `tests/stabilization-regressions.test.ts`,
  `tests/db001-baseline.test.ts` e `docs/database/db001-manifest.json`.
- Alterados: `docs/PLANO_DIARIO_AUTOMACOES.md` e
  `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e serviços externos

- Migration `20260731001000` aplicada e registrada no Supabase de laboratório.
- A configuração passou de uma para quatro automações imediatas ativas com
  templates válidos; a entrada preexistente manteve o mesmo tamanho, indicando
  que não foi sobrescrita.
- Um cliente técnico e um agendamento controlado foram criados no Supabase.
- O agendamento controlado terminou persistido como concluído.
- Commits `4f45f31` e `b1c78e1` publicados no branch `piloto-2026`.
- O Render publicou o commit `b1c78e1` com estado `live`.
- O Make não foi configurado nem alterado nesta etapa.

### Verificações e resultados

- Tipagem TypeScript: aprovada.
- Testes de estabilização: 16 de 16 aprovados.
- Testes DB-001: 11 de 11 aprovados.
- Build de produção e validações do artefato: aprovados.
- Supabase: dois gatilhos nativos presentes, modo 24 horas ativo, quatro
  automações imediatas ativas e migration registrada uma vez.
- Novo cliente: um evento processado e uma execução com sucesso.
- Agendamento pelo operador: um evento processado e uma execução com sucesso.
- Serviço iniciado: um evento processado e uma execução com sucesso.
- Serviço finalizado: um evento processado e uma execução com sucesso.
- Duplicidades técnicas: nenhuma nos quatro fatos testados.

### Riscos, limitações e pendências

- O agendamento pelo Portal do Cliente ainda depende de uma conta de cliente
  autenticada; credenciais administrativas não substituem esse teste.
- O recebimento físico das quatro mensagens desta etapa ainda precisa ser
  confirmado pelo responsável.
- A Noite 3 permanece **Em andamento** até concluir o teste do Portal e a
  confirmação física.
- O modo de envios por 24 horas continua ligado para os testes noturnos.

### Como desfazer

- Reverter os commits `b1c78e1` e `4f45f31` por novos commits e publicar
  novamente no Render.
- Para desfazer a migration, remover apenas as três entradas acrescentadas que
  ainda conservem os valores padrão da migration; não substituir o array
  completo nem apagar personalizações.
- Os registros técnicos podem ser removidos por seus identificadores
  específicos após o encerramento dos testes; não executar exclusão ampla.
- Correções deste registro devem ser feitas em nova entrada, sem apagar esta.

## 2026-07-30-013 — Confirmação física parcial das mensagens da Noite 3

### Tarefa, conversa ou etapa relacionada

- Validação de entrega das mensagens imediatas da Noite 3.

### Objetivo

- Distinguir sucesso técnico no provedor de entrega efetivamente confirmada no
  aparelho autorizado.

### Trabalho realizado

- O usuário confirmou o recebimento da mensagem de agendamento e da mensagem de
  serviço iniciado.
- O histórico do Make foi auditado sem reprocessar nenhuma execução.
- Nenhum código, banco, configuração, cenário ou ambiente externo foi alterado.

### Arquivos alterados

- `docs/PLANO_DIARIO_AUTOMACOES.md`
- `docs/HISTORICO_DE_ALTERACOES.md`

### Banco, hospedagem e serviços externos

- Nenhuma alteração adicional foi aplicada ao Supabase, Render, Make ou
  provedor.
- Nenhuma mensagem foi reenviada.

### Verificações e resultados

- Agendamento pelo operador: entrega física confirmada.
- Serviço iniciado: entrega física confirmada.
- Serviço finalizado: Make concluiu uma execução com sucesso, dois módulos e
  resposta HTTP 200, mas a entrega física não foi confirmada.
- Novo cliente: Make concluiu uma execução com sucesso, dois módulos e resposta
  HTTP 200, mas a entrega física não foi confirmada.
- Não foram observadas execuções duplicadas para os quatro fatos.

### Riscos, limitações e pendências

- Resposta HTTP 200 indica aceitação pelo provedor, não prova entrega no
  WhatsApp.
- Novo cliente e serviço finalizado continuam pendentes de nova validação
  controlada de entrega.
- O agendamento pelo Portal do Cliente ainda depende de uma conta autenticada.
- A Noite 3 permanece **Em andamento**.

### Como desfazer

- Esta etapa altera somente documentação. Correções devem ser registradas por
  uma nova entrada, sem apagar esta.
- Não há alteração externa ou reenvio a desfazer.

## 2026-07-30-014 — Confirmação física do serviço finalizado

### Tarefa, conversa ou etapa relacionada

- Validação de entrega das mensagens imediatas da Noite 3.

### Objetivo

- Registrar a confirmação de recebimento da mensagem de serviço finalizado.

### Trabalho realizado

- O usuário confirmou que a mensagem de serviço finalizado chegou ao aparelho
  autorizado.
- O cronograma foi atualizado para refletir três fluxos validados de ponta a
  ponta.
- Nenhuma mensagem foi reenviada.

### Arquivos alterados

- `docs/PLANO_DIARIO_AUTOMACOES.md`
- `docs/HISTORICO_DE_ALTERACOES.md`

### Banco, hospedagem e serviços externos

- Nenhuma alteração foi aplicada ao Supabase, Render, Make ou provedor.

### Verificações e resultados

- Agendamento pelo operador: entrega física confirmada.
- Serviço iniciado: entrega física confirmada.
- Serviço finalizado: entrega física confirmada.
- Duplicidade: não observada.

### Riscos, limitações e pendências

- A mensagem de novo cliente ainda não teve entrega física confirmada.
- O agendamento pelo Portal do Cliente ainda depende de uma conta autenticada.
- A Noite 3 permanece **Em andamento**.

### Como desfazer

- Esta etapa altera somente documentação. Correções devem ser registradas por
  uma nova entrada, sem apagar esta.
- Não há alteração externa a desfazer.

## 2026-08-05-015 — Verificação do ponto de retomada

### Tarefa, conversa ou etapa relacionada

- Retomada da auditoria e implementação das automações.

### Objetivo

- Confirmar, sem modificar a implementação, onde o trabalho foi interrompido
  e quais validações ainda estão pendentes.

### Trabalho realizado

- Lidas as entradas mais recentes deste histórico e o plano diário das
  automações.
- Confirmada a presença local da arquitetura de produtor único via outbox,
  claim atômico, retry explícito, finalização por token e atualização
  concorrente das automações.
- Confirmado que o histórico registra publicação anterior no Render e aplicação
  das migrations de laboratório até a etapa das mensagens imediatas.
- Nenhum código, banco de dados, configuração, hospedagem ou serviço externo
  foi modificado nesta verificação.

### Arquivos criados, alterados ou removidos

- Alterado somente `docs/HISTORICO_DE_ALTERACOES.md` para registrar esta
  verificação obrigatória.
- Nenhum arquivo de execução, migration ou configuração foi alterado.

### Banco, hospedagem e serviços externos

- Nenhuma ação foi executada no Supabase, Render, Make, Z-API ou GitHub.
- Não foi realizado commit, push, deploy, migration ou envio de mensagem.

### Verificações e resultados

- Noite 1: validada.
- Noite 2: validada.
- Noite 3: em andamento.
- Agendamento pelo operador, serviço iniciado e serviço finalizado: recebimento
  físico confirmado sem duplicidade observada.
- Novo cliente: aceito tecnicamente pelo provedor, mas sem confirmação física
  registrada.
- Agendamento pelo Portal do Cliente: ainda não validado por falta de uma conta
  de cliente autenticada.
- A pipeline completa de segurança iniciada na sessão anterior foi interrompida
  antes de produzir resultado final; não deve ser considerada aprovada por essa
  execução incompleta.
- O dry-run PostgreSQL local continua indisponível por ausência de Docker/psql
  utilizável nesta máquina.

### Riscos, limitações e pendências

- Não há repositório Git detectável neste diretório de trabalho; portanto não
  foi possível comparar o conteúdo local com o commit publicado no Render.
- Ainda falta confirmar fisicamente a mensagem de novo cliente.
- Ainda falta testar o agendamento criado pelo Portal do Cliente autenticado.
- Ainda falta reexecutar até o fim a pipeline completa e obter um dry-run real
  das migrations antes de um novo veredito de produção.
- As Noites 4 a 10 permanecem pendentes.

### Como desfazer

- Esta entrada altera somente documentação. Se houver informação incorreta,
  registrar uma nova entrada corretiva sem apagar ou reescrever o histórico.
- Não há alteração funcional ou externa a desfazer.

## 2026-08-05-016 — Confirmação física de cinco mensagens de automação

### Tarefa, conversa ou etapa relacionada

- Continuação da validação das mensagens imediatas e do lembrete de
  agendamento.

### Objetivo

- Registrar as confirmações de recebimento informadas pelo usuário sem inferir
  validações técnicas que não foram explicitamente executadas.

### Trabalho realizado

- Registrada a confirmação física das mensagens de novo cliente, agendamento,
  serviço iniciado, serviço finalizado e lembrete de agendamento.
- Atualizado o ponto de retomada do plano diário.
- Nenhum código, banco de dados, configuração, hospedagem ou serviço externo
  foi modificado.

### Arquivos criados, alterados ou removidos

- Alterados: `docs/PLANO_DIARIO_AUTOMACOES.md` e
  `docs/HISTORICO_DE_ALTERACOES.md`.
- Nenhum arquivo de execução, teste, migration ou configuração foi alterado.

### Banco, hospedagem e serviços externos

- Nenhuma ação foi executada no Supabase, Render, Make, Z-API ou GitHub.
- Nenhuma mensagem foi reenviada nesta etapa.

### Verificações e resultados

- Novo cliente: recebimento físico confirmado.
- Agendamento: recebimento físico confirmado.
- Serviço iniciado: recebimento físico confirmado.
- Serviço finalizado: recebimento físico confirmado.
- Lembrete de agendamento: recebimento físico confirmado.

### Riscos, limitações e pendências

- A confirmação da mensagem de agendamento não identifica sua origem; por isso
  o fluxo específico criado por uma conta autenticada do Portal do Cliente
  continua pendente até confirmação explícita.
- O recebimento do lembrete não valida sozinho antecedências configuráveis,
  persistência das configurações ou cálculos de fuso horário da Noite 4.
- A Noite 3 permanece em andamento e a Noite 4 permanece pendente.
- A pipeline completa e o dry-run PostgreSQL real continuam pendentes conforme
  a entrada anterior.

### Como desfazer

- Esta etapa altera somente documentação. Se alguma confirmação tiver sido
  registrada incorretamente, adicionar uma nova entrada corretiva sem apagar
  esta.
- Não há alteração funcional ou externa a desfazer.

## 2026-08-05-017 — Critérios para validar Portal e Noite 4

### Tarefa, conversa ou etapa relacionada

- Esclarecimento das validações ainda pendentes após a confirmação física das
  mensagens.

### Objetivo

- Definir evidências objetivas para aprovar o agendamento originado pelo Portal
  do Cliente e o lembrete configurável com fuso horário.

### Trabalho realizado

- Auditado o fluxo `createPortalAppointment` até a RPC
  `portal_create_agendamento`.
- Confirmado que agendamentos criados pelo Portal recebem o metadado
  `portalCreated: true`, permitindo comprovar sua origem.
- Auditado o worker de lembretes e constatado que a antecedência permanece
  fixada em 60 minutos no backend e na visualização administrativa.
- Confirmado que os utilitários da janela operacional usam
  `America/Sao_Paulo`, mas a comparação do horário do agendamento no scanner de
  lembretes usa `Date` diretamente, sem conversão explícita do horário local.
- Nenhum código, banco de dados, configuração, hospedagem ou serviço externo
  foi modificado.

### Arquivos criados, alterados ou removidos

- Alterado somente `docs/HISTORICO_DE_ALTERACOES.md` para registrar a decisão
  técnica.
- Nenhum arquivo de execução, migration, configuração ou teste foi alterado.

### Banco, hospedagem e serviços externos

- Nenhuma ação foi executada no Supabase, Render, Make, Z-API ou GitHub.
- Nenhuma mensagem ou migration foi disparada.

### Verificações e resultados

- O Portal exige usuário autenticado vinculado a um cliente por
  `portal_client_identities` e cria o agendamento pela RPC protegida.
- A origem pode ser provada pelo metadado `portalCreated: true` nas observações
  persistidas.
- A Noite 4 não pode ser aprovada no estado atual: ainda não existe parâmetro
  persistido de antecedência consumido pelo worker e o limite continua fixo em
  60 minutos.
- O recebimento de um lembrete comprova entrega daquele caso, mas não comprova
  antecedências de uma, duas e dez horas nem a virada de data no fuso oficial.

### Riscos, limitações e pendências

- Para concluir a Noite 3 ainda é necessário criar um agendamento usando uma
  conta autenticada do Portal e confirmar uma única execução e entrega.
- Para iniciar a validação da Noite 4 é necessário implementar e persistir a
  antecedência configurável e normalizar o instante do agendamento em
  `America/Sao_Paulo`.
- Depois da implementação, devem ser testadas as antecedências de uma, duas e
  dez horas, persistência após reinicialização, virada do dia e ausência de
  disparo antecipado ou duplicado.

### Como desfazer

- Esta entrada altera somente documentação. Correções devem ser feitas por uma
  nova entrada, sem apagar esta.
- Não há alteração funcional ou externa a desfazer.

## 2026-08-05-018 — Validação do agendamento pelo Portal e encerramento da Noite 3

### Tarefa, conversa ou etapa relacionada

- Validação final das mensagens imediatas da Noite 3.

### Objetivo

- Registrar que o agendamento confirmado teve origem no Portal do Cliente e
  encerrar a etapa de mensagens imediatas.

### Trabalho realizado

- O usuário confirmou explicitamente que o agendamento foi criado pelo Portal
  do Cliente.
- O usuário confirmou o recebimento das mensagens de novo cliente e de
  agendamento desse fluxo.
- O plano diário foi atualizado para marcar a Noite 3 como validada e indicar a
  Noite 4 como próxima etapa.
- Nenhum código, banco de dados, configuração, hospedagem ou serviço externo
  foi modificado.

### Arquivos criados, alterados ou removidos

- Alterados: `docs/PLANO_DIARIO_AUTOMACOES.md` e
  `docs/HISTORICO_DE_ALTERACOES.md`.
- Nenhum arquivo de execução, teste, migration ou configuração foi alterado.

### Banco, hospedagem e serviços externos

- Nenhuma ação foi executada no Supabase, Render, Make, Z-API ou GitHub.
- Nenhuma mensagem foi reenviada nesta etapa.

### Verificações e resultados

- Novo cliente pelo fluxo autenticado: recebimento confirmado.
- Agendamento criado pelo Portal do Cliente: recebimento confirmado.
- Agendamento pelo operador, serviço iniciado e serviço finalizado já tinham
  recebimento confirmado nas entradas anteriores.
- Noite 3 — Mensagens imediatas: **Validada**.

### Riscos, limitações e pendências

- A confirmação do lembrete fixo não valida a Noite 4.
- A antecedência permanece fixada em 60 minutos no código atual e ainda precisa
  ser tornada configurável e persistente.
- O cálculo do instante do agendamento ainda precisa ser normalizado
  explicitamente em `America/Sao_Paulo`.
- A pipeline completa e o dry-run PostgreSQL real continuam pendentes conforme
  as entradas anteriores.

### Como desfazer

- Esta etapa altera somente documentação. Se a origem ou a confirmação tiver
  sido registrada incorretamente, adicionar nova entrada corretiva sem apagar
  esta.
- Não há alteração funcional ou externa a desfazer.

## 2026-08-05-019 — Validação parcial do lembrete com uma hora

### Tarefa, conversa ou etapa relacionada

- Noite 4 — Lembrete configurável e fuso horário.

### Objetivo

- Registrar o recebimento do lembrete com uma hora de antecedência e planejar
  os intervalos restantes para a fase de uso diário.

### Trabalho realizado

- O usuário confirmou o recebimento da mensagem de lembrete com uma hora de
  antecedência.
- Os testes de duas e dez horas foram deliberadamente programados para quando o
  sistema começar a ser usado no dia a dia.
- O plano diário foi atualizado para marcar a Noite 4 como em andamento.
- Nenhum código, banco de dados, configuração, hospedagem ou serviço externo
  foi modificado.

### Arquivos criados, alterados ou removidos

- Alterados: `docs/PLANO_DIARIO_AUTOMACOES.md` e
  `docs/HISTORICO_DE_ALTERACOES.md`.
- Nenhum arquivo de execução, teste, migration ou configuração foi alterado.

### Banco, hospedagem e serviços externos

- Nenhuma ação foi executada no Supabase, Render, Make, Z-API ou GitHub.
- Nenhuma mensagem foi reenviada nesta etapa.

### Verificações e resultados

- Lembrete com uma hora de antecedência: recebimento físico confirmado.
- Noite 4: validação parcial, estado **Em andamento**.

### Riscos, limitações e pendências

- As antecedências de duas e dez horas ainda não foram validadas.
- O recebimento de uma hora não comprova sozinho a persistência de diferentes
  configurações nem todos os casos de virada de data em
  `America/Sao_Paulo`.
- A auditoria anterior encontrou o limite de 60 minutos fixado no código local;
  antes de testar duas e dez horas, deve ser confirmado que a versão em uso
  possui configuração persistida realmente consumida pelo worker.
- A pipeline completa e o dry-run PostgreSQL real continuam pendentes.

### Como desfazer

- Esta etapa altera somente documentação. Se a confirmação ou o planejamento
  tiver sido registrado incorretamente, adicionar uma nova entrada corretiva
  sem apagar esta.
- Não há alteração funcional ou externa a desfazer.

## 2026-08-05-020 — Critérios restantes para concluir a Noite 4

### Tarefa, conversa ou etapa relacionada

- Noite 4 — Lembrete configurável e fuso horário.

### Objetivo

- Consolidar os critérios mínimos restantes para declarar a etapa validada.

### Trabalho realizado

- Definidos os critérios de antecedência, persistência, consumo pelo worker,
  fuso horário e deduplicação.
- Nenhum código, banco de dados, configuração, hospedagem ou serviço externo
  foi modificado.

### Arquivos criados, alterados ou removidos

- Alterado somente `docs/HISTORICO_DE_ALTERACOES.md`.
- Nenhum arquivo funcional foi alterado.

### Banco, hospedagem e serviços externos

- Nenhuma ação foi executada no Supabase, Render, Make, Z-API ou GitHub.
- Nenhuma mensagem foi enviada.

### Verificações e resultados

- Uma hora: recebimento já confirmado.
- Duas e dez horas: testes reais ainda pendentes.
- Para cada intervalo, a configuração deve permanecer após recarregar o painel
  e reiniciar o Render.
- O worker deve usar o valor persistido, sem permanecer limitado ao valor fixo
  de 60 minutos.
- Um caso próximo à virada do dia deve confirmar o cálculo em
  `America/Sao_Paulo`, independentemente do UTC do Render.
- Antes da antecedência não deve existir envio; ao entrar na janela deve existir
  exatamente uma execução e uma entrega.

### Riscos, limitações e pendências

- O código local auditado ainda apresenta 60 minutos fixos; duas e dez horas
  não podem ser consideradas confirmadas até a versão efetivamente usada pelo
  worker consumir uma configuração persistida.
- Recebimento físico isolado não comprova persistência, horário correto ou
  ausência de duplicidade.
- A Noite 4 permanece em andamento.

### Como desfazer

- Esta entrada altera somente documentação. Eventuais correções devem ser
  registradas por nova entrada, sem apagar esta.
- Não há alteração funcional ou externa a desfazer.

## 2026-08-05-021 — Validação diferida da Noite 4 e escopo da Noite 5

### Tarefa, conversa ou etapa relacionada

- Planejamento das Noites 4 e 5 das automações.

### Objetivo

- Tornar explícito que os testes restantes da Noite 4 serão realizados durante
  o uso diário e detalhar os casos de segurança do lembrete da Noite 5.

### Trabalho realizado

- Adicionada ao plano a lista de evidências que deverá ser confirmada para os
  lembretes de duas e dez horas.
- Detalhados os casos de cancelamento, reagendamento, estados concluídos,
  concorrência e rastreabilidade que compõem a Noite 5.
- Nenhum código, banco de dados, configuração, hospedagem ou serviço externo
  foi modificado.

### Arquivos criados, alterados ou removidos

- Alterados: `docs/PLANO_DIARIO_AUTOMACOES.md` e
  `docs/HISTORICO_DE_ALTERACOES.md`.
- Nenhum arquivo funcional foi alterado.

### Banco, hospedagem e serviços externos

- Nenhuma ação foi executada no Supabase, Render, Make, Z-API ou GitHub.
- Nenhuma mensagem, migration, commit ou deploy foi realizado.

### Verificações e resultados

- Uma hora permanece confirmada.
- Duas e dez horas permanecem pendentes e serão atualizadas nos documentos
  durante a operação diária.
- A Noite 5 passa a ter critérios explícitos de aprovação no plano.

### Riscos, limitações e pendências

- A Noite 4 continua em andamento até a confirmação das evidências restantes.
- A Noite 5 ainda não foi iniciada nem validada.
- Nenhum dos critérios documentados nesta entrada representa execução real de
  teste.

### Como desfazer

- Esta etapa altera somente documentação. Ajustes devem ser registrados por
  nova entrada sem apagar esta.
- Não há alteração funcional ou externa a desfazer.

## 2026-08-05-022 — Implementação local da Noite 5: segurança do lembrete

### Tarefa, conversa ou etapa relacionada

- Noite 5 do plano diário das automações.

### Objetivo

- Impedir lembretes obsoletos ou duplicados após cancelamento, reagendamento,
  início/finalização do atendimento e ciclos concorrentes do worker.
- Preservar o fluxo unificado existente, sem publicar código nem aplicar
  migration em banco externo.

### Trabalho realizado

- A deduplicação do lembrete passou de `agendamento` para
  `agendamento + data/hora canônica`, permitindo um novo lembrete legítimo após
  reagendamento sem duplicar o mesmo horário.
- O scanner passou a considerar elegíveis somente os estados `agendado` e
  `confirmado`.
- Antes de chamar Make/Z-API, o worker agora consulta diretamente no Supabase o
  estado, a data e a hora atuais. Mudança de horário ou estado inelegível
  cancela a execução; erro de leitura adia sem enviar.
- Criada migration progressiva para cancelar pendências legadas sem horário,
  invalidar lembretes pendentes em cancelamento, reagendamento e estados
  inelegíveis e ampliar o trigger para alterações de data e hora.
- O backfill preserva histórico enviado e coloca somente pendências ambíguas em
  quarentena. Nenhuma mensagem ou execução histórica de sucesso é apagada.
- O dry-run foi ampliado com casos de pendência legada, reagendamento e
  finalização.
- A allowlist e o tipo público receberam a propriedade já usada em runtime
  `automation24Hours`; trata-se de correção de tipagem sem mudança de regra.
- A expectativa de teste do estado `finalizado` foi alinhada ao valor de banco
  já adotado pelo runtime, `Concluído`.

### Arquivos criados, alterados ou removidos

- Criados:
  - `src/db/reminderPolicy.ts`;
  - `supabase/migrations/20260805220000_lembrete_seguranca.sql`.
- Alterados:
  - `src/db/automationEngine.ts`;
  - `src/db/localDb.ts`;
  - `src/types.ts`;
  - `src/security/publicConfig.ts`;
  - `scripts/automations/dry-run-fixture.sql`;
  - `scripts/automations/dry-run-pre-claim.sql`;
  - `scripts/automations/dry-run-assertions.sql`;
  - `scripts/automations/run-dry-run.ps1`;
  - `tests/automation-behavior.test.ts`;
  - `tests/db001-baseline.test.ts`;
  - `tests/stabilization-regressions.test.ts`;
  - `docs/database/db001-manifest.json`;
  - `docs/PLANO_DIARIO_AUTOMACOES.md`;
  - `docs/HISTORICO_DE_ALTERACOES.md`.
- Nenhum arquivo foi removido.

### Banco, hospedagem e serviços externos

- A nova migration existe somente no workspace local e **não foi aplicada**.
- Nenhuma alteração foi executada em Supabase, Render, Make, Z-API ou GitHub.
- Nenhuma mensagem, commit ou deploy foi realizado.
- Para liberar espaço mínimo do executor, dois caches temporários antigos do
  ambiente foram movidos, sem exclusão, para uma pasta de recuperação no disco
  D: fora do projeto.

### Verificações e resultados

- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo validação do artefato de segurança e do
  Portal do Cliente.
- `npm run test:automations`: 14 de 14 aprovados.
- Testes SEC-002, SEC-003, SEC-004 e SEC-005: 44 de 44 aprovados.
- Testes de piloto, Portal e go-live: 29 de 29 aprovados.
- `npm run security:secrets`, `security:lockfile` e `security:unused`:
  aprovados.
- `test:stabilization`: 16 de 17 aprovados. A única falha é preexistente: o
  teste procura a migration ausente
  `20260730233000_automacoes_janela_24h.sql`; o novo teste da Noite 5 passou.
- `test:db001`: 9 de 11 aprovados. As duas falhas são preexistentes: manifesto
  exige a migration 24h ausente e ainda classifica cópias SQL de uma pasta
  temporária que já não existe.
- `security:licenses`: bloqueado porque o verificador não localiza os pacotes
  instalados na pasta compartilhada de dependências; o build usa essas mesmas
  dependências com sucesso.
- Dry-run PostgreSQL: não executado; Docker, Supabase CLI e `psql` não estão
  disponíveis nesta máquina. O script confirmou que nenhuma migration foi
  aplicada.

### Auto-revisão, riscos, limitações e pendências

- A arquitetura de criação da fila permanece unificada por
  `queueAutomation`; não foi reintroduzido produtor SQL de execuções.
- O índice único já existente continua sendo a barreira atômica contra dois
  workers criarem a mesma chave `agendamento + horário`.
- Claims já em processamento não são alterados pelo trigger. A guarda do worker
  faz a revalidação autoritativa antes do provedor e os encerra com o token do
  claim, evitando disputa de propriedade.
- Existe uma janela residual inevitável entre a última leitura do agendamento e
  a aceitação pelo provedor. Eliminar totalmente essa janela exigiria uma
  transação distribuída com o WhatsApp, indisponível na integração atual.
- A migration ainda precisa de dry-run PostgreSQL e backup antes de produção.
- O repositório local está sem a migration 24h que o manifesto e o histórico
  tratam como oficial/aplicada. Esse inventário deve ser reconciliado antes de
  qualquer `supabase db push`, sem fabricar ou reaplicar migration já executada.
- A Noite 5 está **Implementada**, mas não **Validada** nem publicada.

### Como desfazer

- Enquanto a migration não foi aplicada, desfazer consiste em reverter somente
  os arquivos locais desta entrada, preservando o histórico por meio de nova
  entrada corretiva.
- Se a migration vier a ser aplicada, não apagar registros nem reescrever o
  histórico de migrations. Criar uma migration posterior que restaure o trigger
  anterior e definir explicitamente o tratamento das chaves por horário.
- Não há mudança externa atual a desfazer.

## 2026-08-05-023 — Implementação local da Noite 6: cliente inativo

### Tarefa, conversa ou etapa relacionada

- Noite 6 do plano diário das automações.

### Objetivo

- Fazer a automação `cliente_inativo` considerar somente atendimentos
  concluídos, respeitar dias e mínimo de atendimentos, ignorar retorno futuro e
  impedir repetição no mesmo ciclo de inatividade.

### Trabalho realizado

- Criada política isolada para avaliar elegibilidade de cliente inativo.
- Somente agendamentos `finalizado` e `entregue`, ocorridos no passado, contam
  como atendimentos concluídos.
- O cálculo passou a usar o atendimento concluído mais recente, o mínimo
  configurado e a antecedência `inactiveDays`.
- Datas sem offset são convertidas explicitamente pelo fuso
  `America/Sao_Paulo`, independentemente do fuso do processo no Render.
- Retorno futuro, atendimento em andamento, período ainda não atingido e mínimo
  insuficiente impedem a entrada na fila.
- A chave `cliente_inativo:<cliente>:<último atendimento concluído>` limita a
  automação a uma execução por episódio de inatividade e usa o índice único já
  existente como barreira entre workers concorrentes.
- O worker reconsulta todos os agendamentos do cliente imediatamente antes do
  provedor. Falha de leitura gera retry sem envio; mudança dos critérios ou do
  episódio cancela a execução com motivo explícito.
- Criada migration progressiva para associar histórico legado ao episódio atual
  e cancelar pendências antigas ambíguas ou duplicadas. A migration não insere
  execuções e preserva o produtor único da aplicação.
- O dry-run e as suítes comportamentais receberam casos de legado, mínimo,
  período, retorno futuro, atendimento ativo, fuso e ciclos repetidos.
- A regra de repetição adotada é conservadora: um episódio produz no máximo uma
  execução, independentemente do resultado final. Somente um novo atendimento
  concluído cria outro episódio automaticamente.

### Arquivos criados, alterados ou removidos

- Criados:
  - `src/db/inactiveCustomerPolicy.ts`;
  - `supabase/migrations/20260805230000_cliente_inativo_seguranca.sql`.
- Alterados:
  - `src/db/automationEngine.ts`;
  - `src/db/localDb.ts`;
  - `scripts/automations/dry-run-pre-claim.sql`;
  - `scripts/automations/dry-run-assertions.sql`;
  - `scripts/automations/run-dry-run.ps1`;
  - `tests/automation-behavior.test.ts`;
  - `tests/db001-baseline.test.ts`;
  - `tests/stabilization-regressions.test.ts`;
  - `docs/database/db001-manifest.json`;
  - `docs/PLANO_DIARIO_AUTOMACOES.md`;
  - `docs/HISTORICO_DE_ALTERACOES.md`.
- Nenhum arquivo foi removido.

### Banco, hospedagem e serviços externos

- A migration da Noite 6 existe somente no workspace local e **não foi
  aplicada**.
- Nenhuma alteração foi executada em Supabase, Render, Make, Z-API ou GitHub.
- Nenhuma mensagem, publicação, commit ou deploy foi realizado.

### Verificações e resultados

- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo validação do artefato de segurança e do
  Portal do Cliente.
- `npm run test:automations`: 21 de 21 aprovados; sete casos específicos de
  cliente inativo, incluindo repetição de ciclo, ficaram verdes.
- Testes SEC-002, SEC-003, SEC-004 e SEC-005: 44 de 44 aprovados.
- Testes de piloto, Portal e go-live: 29 de 29 aprovados.
- `npm run security:secrets`, `security:lockfile` e `security:unused`:
  aprovados.
- `test:stabilization`: 17 de 18 aprovados. O teste novo da Noite 6 passou; a
  única falha permanece sendo a migration ausente
  `20260730233000_automacoes_janela_24h.sql`.
- `test:db001`: 9 de 11 aprovados. Permanecem as duas inconsistências
  preexistentes do inventário: migration 24h ausente e referências a cópias SQL
  de uma pasta temporária já inexistente.
- Dry-run PostgreSQL: não executado porque Docker, Supabase CLI e `psql` não
  estão disponíveis. O script encerrou antes de aplicar qualquer migration.
- O bloqueio preexistente do verificador de licenças, que não localiza os
  pacotes na pasta compartilhada de dependências, não foi alterado nesta etapa.

### Auto-revisão, riscos, limitações e pendências

- A aplicação continua sendo a única criadora de `automacoes_execucoes`; a nova
  migration somente reconcilia registros existentes.
- A configuração ativa, o template, a janela operacional, o mínimo e os dias
  permanecem respeitados pelo fluxo comum da fila.
- A revalidação autoritativa impede o envio quando o cliente marcou retorno ou
  iniciou atendimento depois de a mensagem entrar na fila.
- Uma execução cancelada ou falha continua ocupando a chave do episódio. Isso é
  intencional para evitar campanhas repetidas; reabrir automaticamente o mesmo
  episódio exigirá uma regra de negócio explícita futura.
- Permanece uma janela residual entre a última consulta ao Supabase e a
  aceitação pelo provedor, impossível de eliminar sem transação distribuída com
  o WhatsApp.
- A migration precisa de backup e dry-run PostgreSQL antes de produção.
- O inventário de migrations deve ser reconciliado antes de `supabase db push`,
  sem fabricar ou reaplicar a migration 24h que o histórico indica como já
  aplicada em ambiente de testes.
- A Noite 6 está **Implementada**, mas não **Validada** nem publicada.

### Como desfazer

- Enquanto a migration não foi aplicada, reverter somente os arquivos locais
  desta entrada e registrar a reversão em uma nova entrada de histórico.
- Se a migration vier a ser aplicada, não apagar execuções nem reescrever o
  histórico. Criar migration posterior que remova ou transforme de forma
  explícita apenas as chaves `cliente_inativo` introduzidas nesta etapa.
- Não há alteração externa atual a desfazer.

## 2026-08-05-024 — Implementação local da Noite 7: aniversários

### Tarefa, conversa ou etapa relacionada

- Noite 7 do plano diário das automações.

### Objetivo

- Fazer a automação `aniversario` usar o calendário de São Paulo, rejeitar
  datas ausentes ou inválidas e produzir no máximo uma execução por cliente e
  ano, sem envio fora do dia correto.

### Trabalho realizado

- Criada política isolada para validar datas de nascimento, avaliar o dia do
  aniversário e construir a chave anual.
- O scanner deixou de usar UTC e ano local do processo; dia e ano agora são
  calculados em `America/Sao_Paulo`.
- Scanner e `queueAutomation` usam a mesma data de referência, evitando chaves
  divergentes durante a virada do ano.
- O formato legado `aniversario:<cliente>:<ano>` foi preservado e continua
  protegido pelo índice único existente em `deduplication_key`.
- Datas futuras, malformadas e datas impossíveis são rejeitadas. A regra para 29 de
  fevereiro é estrita: somente envia no próprio dia em ano bissexto.
- Antes de Make/Z-API, o worker reconsulta diretamente no Supabase a data do
  cliente. Erro de leitura gera retry sem envio; cliente ausente, data
  ausente/inválida, dia divergente ou chave anual incoerente cancelam a
  execução.
- Adicionados testes de fuso, virada de dia/ano, datas inválidas, ano bissexto,
  revalidação e ciclos repetidos.
- A auto-revisão confirmou que `queueAutomation` permanece como produtor único
  e que nenhuma migration é necessária para esta etapa.

### Arquivos criados, alterados ou removidos

- Criado:
  - `src/db/birthdayPolicy.ts`.
- Alterados:
  - `src/db/automationEngine.ts`;
  - `src/db/localDb.ts`;
  - `tests/automation-behavior.test.ts`;
  - `tests/stabilization-regressions.test.ts`;
  - `docs/PLANO_DIARIO_AUTOMACOES.md`;
  - `docs/HISTORICO_DE_ALTERACOES.md`.
- Nenhum arquivo foi removido.

### Banco, hospedagem e serviços externos

- Nenhuma migration, alteração de schema ou backfill foi criado ou aplicado.
- Nenhuma alteração foi executada em Supabase, Render, Make, Z-API ou GitHub.
- Nenhuma mensagem, publicação, commit ou deploy foi realizado.

### Verificações e resultados

- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo validação do artefato de segurança e do
  Portal do Cliente.
- `npm run test:automations`: 27 de 27 aprovados; os cinco novos casos de
  aniversário passaram.
- Testes SEC-002, SEC-003, SEC-004 e SEC-005: 44 de 44 aprovados.
- Testes de piloto, Portal e go-live: 29 de 29 aprovados.
- `security:headers`, `security:secrets`, `security:lockfile` e
  `security:unused`: aprovados.
- `test:stabilization`: 18 de 19 aprovados. O teste novo da Noite 7 passou; a
  única falha continua sendo a migration ausente
  `20260730233000_automacoes_janela_24h.sql`.
- `test:db001`: 9 de 11 aprovados. Permanecem as duas falhas preexistentes do
  inventário: migration 24h ausente e referências a cópias SQL de uma pasta
  temporária inexistente.
- `security:licenses`: permanece bloqueado porque o verificador não localiza os
  pacotes instalados na pasta compartilhada de dependências; o build usa essas
  mesmas dependências com sucesso.

### Auto-revisão, riscos, limitações e pendências

- A aplicação continua sendo a única produtora de execuções; não foi criado
  trigger SQL nem outro caminho de fila.
- Automação ativa, template, telefone, janela operacional e deduplicação
  continuam sendo validados pelo fluxo comum.
- Execuções antigas mantêm chaves compatíveis e bloqueiam corretamente uma
  segunda execução no mesmo ano, independentemente do status final.
- Se uma falha de leitura persistir até o fim do aniversário, a execução será
  cancelada no ciclo seguinte em vez de enviar atrasada. Isso prioriza não
  disparar em dia incorreto.
- Uma alteração da data de nascimento depois de a execução ser criada cancela
  a pendência. A chave anual permanece ocupada para impedir uma segunda
  mensagem no mesmo ano.
- A Noite 7 ainda requer cenário controlado com contato autorizado antes de ser
  marcada como validada ou publicada.
- As inconsistências preexistentes do inventário de migrations devem ser
  reconciliadas antes de qualquer `supabase db push`.

### Como desfazer

- Reverter somente a política de aniversário e as integrações locais desta
  entrada, preservando o histórico por meio de nova entrada corretiva.
- Não há migration, dado externo, mensagem ou publicação a desfazer.

## 2026-08-05-025 — Implementação local e auto-revisão da Noite 8

### Tarefa, conversa ou etapa relacionada

- Noite 8 do plano diário das automações: provedor, tentativas e confirmação.

### Objetivo

- Eliminar sucesso simulado, exigir provedor configurado, impedir retentativas
  que possam duplicar mensagens e apresentar corretamente a diferença entre
  aceitação do provedor e entrega no WhatsApp.

### Trabalho realizado

- Criada política única para classificar respostas do Make e da Z-API como
  aceitas, falhas temporárias comprovadas, falhas permanentes ou resultados
  ambíguos.
- A ausência de provedor deixou de produzir sucesso simulado e agora encerra a
  execução com falha permanente visível.
- Respostas 2xx do Make passaram a significar somente aceitação na fila do Make.
  No envio direto pela Z-API, a resposta 2xx também precisa trazer `messageId`.
- O estado legado `sucesso` foi preservado no banco para não quebrar schema,
  consultas nem dados existentes, mas o painel passou a exibi-lo como
  `aceita pelo provedor`, com entrega explicitamente não confirmada.
- Os dois controles de teste manual agora verificam também `result.success`;
  uma resposta HTTP válida do servidor que relata rejeição do provedor não é
  mais apresentada como execução aceita.
- Retentativas ficaram restritas a HTTP 429 e à resposta exata de fila cheia do
  Make. O intervalo aceita `Retry-After` válido com limite de uma hora; sem ele,
  usa cinco e quinze minutos até o limite existente de três tentativas.
- Timeout, falha de rede, HTTP 5xx e resposta 2xx inválida da Z-API são tratados
  como ambíguos e não são reenviados automaticamente, evitando duplicidade
  quando a aceitação externa é desconhecida.
- Respostas externas continuam limitadas e redigidas. Os resumos controlados de
  aceitação, falha e ambiguidade podem chegar ao painel sem expor conteúdo do
  provedor.
- O trace de confirmação da Z-API só recebe estado de sucesso depois de uma
  resposta 2xx com `messageId`; resposta 2xx inválida fica como ambígua.
- Falha ao finalizar o claim no banco impede o registro compatível de sucesso e,
  no teste manual, devolve orientação explícita para não repetir o disparo.
- Testes de comportamento, saída segura e estabilização receberam cenários da
  Noite 8. O produtor único via outbox, a deduplicação e os logs
  `automation.trace` foram mantidos.

### Arquivos criados, alterados ou removidos

- Criado:
  - `src/db/automationProviderPolicy.ts`.
- Alterados:
  - `src/server/automationTransport.ts`;
  - `src/db/automationEngine.ts`;
  - `src/security/safeOutput.ts`;
  - `src/components/AutomacoesModule.tsx`;
  - `src/components/AutomacoesTab.tsx`;
  - `server.ts`;
  - `tests/automation-behavior.test.ts`;
  - `tests/sec004-safe-outputs.test.ts`;
  - `tests/stabilization-regressions.test.ts`;
  - `docs/PLANO_DIARIO_AUTOMACOES.md`;
  - `docs/HISTORICO_DE_ALTERACOES.md`.
- Nenhum arquivo foi removido.

### Banco, hospedagem e serviços externos

- Nenhuma migration, mudança de schema, backfill ou alteração de dados foi
  criada ou aplicada.
- Nenhuma configuração foi modificada no Supabase, Render, Make, Z-API ou
  GitHub.
- Nenhuma mensagem real, commit, publicação ou deploy foi realizado.
- O blueprint existente do Make foi apenas inspecionado. Ele não contém módulo
  de resposta final nem callback de entrega para a aplicação.

### Verificações e resultados

- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo artefatos de segurança e do Portal.
- `npm run test:automations`: 31 de 31 aprovados.
- Testes SEC-002, SEC-003, SEC-004 e SEC-005: 44 de 44 aprovados.
- Testes de piloto, Portal e go-live: 29 de 29 aprovados.
- `security:headers`, `security:secrets`, `security:lockfile` e
  `security:unused`: aprovados.
- `test:stabilization`: 19 de 20 aprovados. O cenário novo da Noite 8 passou; a
  única falha continua sendo a migration preexistente ausente
  `20260730233000_automacoes_janela_24h.sql`.
- `test:db001`: 9 de 11 aprovados. Persistem as duas falhas preexistentes do
  inventário: a mesma migration 24h ausente e referências a cópias SQL de uma
  pasta temporária inexistente.
- `security:licenses`: permanece bloqueado porque o verificador não encontra os
  pacotes na pasta compartilhada de dependências; build e demais verificações
  usam essas dependências com sucesso.

### Auto-revisão, riscos, limitações e pendências

- Não foi criado produtor, trigger SQL ou caminho paralelo. A aplicação e a
  outbox permanecem como fluxo único.
- O banco ainda usa o nome histórico `sucesso`; trocar esse valor exigiria uma
  migration e compatibilização de dados. A semântica visível foi corrigida sem
  esse risco de migração.
- O Make confirma apenas entrada na fila do webhook. Uma falha posterior no
  cenário não pode ser observada pela aplicação enquanto não existir resposta
  final ou callback autenticado. Portanto, a implementação não afirma entrega.
- Resultados ambíguos são encerrados sem retentativa e continuam ocupando a
  chave de deduplicação. Isso evita duplicidade, mas exige reconciliação manual
  antes de um eventual reenvio e será relevante para o monitoramento da Noite 9.
- Há uma janela inevitável entre a aceitação pelo provedor e a persistência do
  resultado. Se o banco falhar nesse ponto, a aplicação registra a
  inconsistência, mas o claim expirado ainda precisará de uma política de
  reconciliação na Noite 9 para não ser reenviado automaticamente.
- Uma rejeição temporária não reconhecida pela classificação será tratada como
  permanente. Esse comportamento conservador pode reter um evento, mas não o
  perde silenciosamente: ele fica visível como erro definitivo.
- Nenhum teste real de entrega foi feito nesta etapa. A Noite 8 permanece
  **Implementada**, não **Validada** nem publicada.
- As inconsistências preexistentes do inventário de migrations precisam ser
  resolvidas antes de qualquer `supabase db push`.

### Como desfazer

- Reverter somente a política de provedor e suas integrações locais, preservando
  o histórico por meio de uma nova entrada corretiva.
- Como não houve migration, alteração de dados, configuração externa ou deploy,
  não existe mudança externa a desfazer.

## 2026-08-05-026 — Implementação local e auto-revisão da Noite 9

### Tarefa, conversa ou etapa relacionada

- Noite 9 do plano diário: monitoramento, claims abandonados e preparação
  operacional para o piloto.

### Objetivo

- Tornar filas paradas, claims vencidos, resultados ambíguos e erros definitivos
  observáveis, impedindo que um claim abandonado seja reenviado silenciosamente.

### Trabalho realizado

- Criada política pura de monitoramento que separa execução agendada, retry,
  fila atrasada, claim ativo, claim abandonado, resultado ambíguo, erro
  definitivo, cancelamento e aceitação.
- A fila passa a ser considerada atrasada depois de cinco minutos. Claims
  legados sem lease recebem tolerância de quinze minutos antes do alerta.
- A API administrativa e os dois painéis de automações receberam indicadores
  de fila atrasada, retries e reconciliações necessárias. Token, conteúdo da
  mensagem, cliente e telefone não foram acrescentados às respostas.
- O worker registra evento estruturado `background_worker.automation_health`
  quando a situação exige atenção ou está crítica.
- Criada migration que coloca claims vencidos em `erro_definitivo`, remove o
  token de posse, preserva `claimed_at`, `claim_expires_at` e até mil caracteres
  da resposta técnica anterior e impede reenvio automático.
- `fn_claim_automacoes_execucoes` continua atômica, mas passa a selecionar
  exclusivamente execuções `pendente`. Execuções `processando` expiradas são
  colocadas em quarentena na mesma transação.
- O dry-run recebeu cenário que prova que claim expirado não volta à fila e que
  uma pendência legítima continua recebendo claim.
- Criado procedimento operacional com triagem, reconciliação sem reenvio, gates
  do piloto e ordem segura para aplicar migrations.
- Manifesto e inventário de testes foram atualizados para classificar os novos
  artefatos. Nenhum produtor, template ou regra de criação de evento mudou.

### Arquivos criados, alterados ou removidos

- Criados:
  - `src/db/automationMonitoring.ts`;
  - `supabase/migrations/20260805233000_automacoes_monitoramento_operacional.sql`;
  - `scripts/automations/dry-run-monitoring-assertions.sql`;
  - `docs/AUTOMACOES_OPERACAO.md`.
- Alterados:
  - `src/types.ts`;
  - `src/db/localDb.ts`;
  - `src/security/safeOutput.ts`;
  - `src/components/AutomacoesModule.tsx`;
  - `src/components/AutomacoesTab.tsx`;
  - `server.ts`;
  - `scripts/automations/run-dry-run.ps1`;
  - `docs/database/db001-manifest.json`;
  - `tests/automation-behavior.test.ts`;
  - `tests/sec004-safe-outputs.test.ts`;
  - `tests/stabilization-regressions.test.ts`;
  - `tests/db001-baseline.test.ts`;
  - `docs/PLANO_DIARIO_AUTOMACOES.md`;
  - `docs/HISTORICO_DE_ALTERACOES.md`.
- Nenhum arquivo foi removido.

### Banco, hospedagem e serviços externos

- A migration foi criada somente no workspace; não foi aplicada nem ensaiada em
  Supabase, PostgreSQL remoto ou produção.
- Nenhuma linha de banco, configuração, webhook, serviço externo ou ambiente do
  Render foi modificado.
- Nenhuma mensagem, chamada real de provedor, commit, publicação ou deploy foi
  realizado.

### Verificações e resultados

- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo artefatos de segurança e do Portal.
- `npm run test:automations`: 32 de 32 aprovados.
- Testes SEC-002, SEC-003, SEC-004 e SEC-005: 44 de 44 aprovados.
- Testes de piloto, Portal e go-live: 29 de 29 aprovados.
- `security:headers`, `security:secrets`, `security:lockfile` e
  `security:unused`: aprovados.
- `test:stabilization`: 20 de 21 aprovados. O teste novo da Noite 9 passou; a
  única falha continua sendo a migration preexistente ausente
  `20260730233000_automacoes_janela_24h.sql`.
- `test:db001`: 9 de 11 aprovados. A migration nova está classificada; persistem
  a migration 24h ausente e referências a SQL de uma pasta temporária
  inexistente.
- O dry-run encerrou antes de executar SQL porque o comando Docker não está
  instalado. Nenhuma migration foi aplicada.
- `security:licenses` permanece bloqueado pelo resolvedor da pasta compartilhada
  de dependências, sem mudança em relação às noites anteriores.

### Auto-revisão, riscos, limitações e pendências

- A arquitetura continua com produtor único via outbox. A migration altera
  somente aquisição e quarentena de claims, sem criar eventos ou filas.
- Nenhuma chave de deduplicação é apagada. Claim vencido permanece bloqueado até
  reconciliação, priorizando não duplicar mesmo quando isso exige análise manual.
- Claims ativos com lease futuro não são tocados. Registros legados sem lease só
  entram em quarentena após quinze minutos sem atualização.
- A migration preserva evidências forenses e não remove execuções. O único dado
  apagado é o token expirado de posse, que não pode mais autorizar finalização.
- Existe mudança deliberada de disponibilidade: um worker que morrer antes de
  chamar o provedor deixará o evento em quarentena, em vez de reenviá-lo. Isso
  evita duplicidade, mas exige confirmação operacional para determinar se houve
  perda de envio.
- Aplicar com worker ativo pode criar disputa desnecessária. O procedimento exige
  backup, dry-run e janela sem worker antes da migration.
- A migration ainda precisa ser validada sintaticamente e funcionalmente em
  PostgreSQL isolado. Ela não está autorizada para produção neste estado.
- Noite 9 está **Implementada**, não **Validada** nem publicada.

### Como desfazer

- Enquanto não aplicada, reverter apenas os arquivos locais desta entrada e
  registrar a reversão em nova entrada do histórico.
- Se vier a ser aplicada, não restaurar claims expirados nem apagar quarentenas.
  Criar migration corretiva posterior para substituir a função, preservando
  registros e chaves de deduplicação para reconciliação.
- Não existe alteração externa atual a desfazer.

## 2026-08-05-027 — Tratamento das pendências locais antes da Noite 10

### Tarefa, conversa ou etapa relacionada

- Separação entre pendências tratáveis no workspace e validações que dependem
  do uso diário do sistema.

### Objetivo

- Eliminar bloqueios locais de inventário, estabilização e segurança sem
  simular testes reais, aplicar migrations ou publicar o sistema.

### Trabalho realizado

- Localizado o arquivo original
  `20260730233000_automacoes_janela_24h.sql` no checkout Git preservado em
  `.tmp/repo-piloto-2026`.
- Confirmado que o arquivo está rastreado no commit local preservado e não tem
  diff nesse checkout. O SHA-256 da fonte e do arquivo restaurado é
  `838ff2bcddc6666d3a208daea32acc877304f59f87e0a4d2e978201c685f2e6a`.
- A migration foi restaurada byte a byte no diretório oficial; nenhum SQL foi
  reconstruído por hipótese e nenhuma migration foi executada.
- O DB-001 passou a ignorar checkouts temporários ao inventariar SQL e `.tmp/`
  foi explicitamente adicionado ao `.gitignore`, eliminando dependência de
  cópias transitórias sem apagar o checkout usado como evidência.
- A restauração da migration revelou uma regressão real no worker: o
  processamento da fila ignorava `automation24Hours`. A condição comprovada no
  checkout preservado foi restaurada.
- Os aliases `telefone` e `formattedMessage`, ainda exigidos para compatibilidade
  com o cenário Make já publicado, foram restaurados sem remover o contrato
  atual `phone` e `message`.
- O dry-run passou a incluir e reaplicar a migration 24h e ganhou asserções para
  as três colunas, o default desligado e a idempotência.
- O verificador de licenças passou a procurar `node_modules` no workspace e em
  diretórios ancestrais, refletindo a instalação compartilhada realmente usada
  pelo build, sem aceitar dependência global arbitrária.
- O plano e o procedimento operacional agora distinguem claramente o que está
  verde localmente do que será confirmado durante o uso diário.

### Arquivos criados, alterados ou removidos

- Criado por restauração verificável:
  - `supabase/migrations/20260730233000_automacoes_janela_24h.sql`.
- Alterados:
  - `.gitignore`;
  - `src/db/automationEngine.ts`;
  - `src/server/automationTransport.ts`;
  - `scripts/automations/run-dry-run.ps1`;
  - `scripts/automations/dry-run-assertions.sql`;
  - `scripts/security/check-licenses.ts`;
  - `tests/automation-behavior.test.ts`;
  - `tests/stabilization-regressions.test.ts`;
  - `tests/db001-baseline.test.ts`;
  - `docs/PLANO_DIARIO_AUTOMACOES.md`;
  - `docs/AUTOMACOES_OPERACAO.md`;
  - `docs/HISTORICO_DE_ALTERACOES.md`.
- Nenhum arquivo foi removido e o checkout temporário de evidência foi
  preservado.

### Banco, hospedagem e serviços externos

- Nenhuma migration foi aplicada ou marcada no ledger nesta tarefa.
- Nenhuma leitura ou escrita foi feita em Supabase, Render, Make, Z-API ou
  GitHub.
- Nenhuma mensagem real, commit, publicação ou deploy foi realizado.

### Verificações e resultados

- Hash SHA-256 da migration oficial e da fonte preservada: idênticos.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo artefatos de segurança e do Portal.
- `npm run test:automations`: 32 de 32 aprovados.
- `npm run test:stabilization`: 21 de 21 aprovados.
- `npm run test:db001`: 11 de 11 aprovados.
- Testes SEC-002, SEC-003, SEC-004 e SEC-005: 44 de 44 aprovados.
- Testes de piloto, Portal e go-live: 29 de 29 aprovados.
- `security:headers`, `security:secrets`, `security:lockfile`,
  `security:licenses` e `security:unused`: aprovados. Foram verificadas 17
  dependências diretas.
- Dry-run PostgreSQL continua indisponível porque Docker, `psql` e Supabase CLI
  não estão instalados. O procedimento encerra antes de executar SQL.

### Auto-revisão, riscos, limitações e pendências

- O histórico informa que a migration 24h já foi aplicada no Supabase de testes.
  Restaurar o arquivo não autoriza reaplicação; o ledger do ambiente alvo deve
  ser comparado antes de qualquer `db push`.
- A compatibilidade Make foi apenas preservada. Remover os aliases exige primeiro
  migrar e validar o cenário publicado.
- O modo 24 horas agora é respeitado tanto na criação quanto no processamento da
  fila; desligado, a janela operacional continua obrigatória.
- A validação sintática e funcional das migrations das Noites 5, 6 e 9 ainda
  depende de PostgreSQL isolado. Esse é um bloqueio de infraestrutura, não um
  teste de uso diário.
- Lembretes de duas e dez horas, cliente inativo, aniversário, entrega posterior
  do Make e observação contínua da fila dependem de fatos reais e ficam
  conscientemente reservados para o período de testes do sistema.
- Nenhum código ou teste automatizado permanece vermelho no workspace.

### Como desfazer

- Reverter apenas os arquivos desta entrada e registrar uma nova entrada de
  correção; não apagar o histórico nem o checkout de evidência antes de uma
  cópia versionada estar confirmada.
- Como nenhum banco ou serviço externo foi alterado, não há reversão externa.

## 2026-08-05-028 — Registro do intervalo mínimo para cliente inativo

### Tarefa, conversa ou etapa relacionada

- Regra adicional da Noite 6 para impedir mensagens diárias de cliente inativo.

### Objetivo

- Registrar, sem implementar neste momento, que um cliente deve permanecer pelo
  menos sete dias completos sem uma nova mensagem de inatividade depois de um
  envio anterior.

### Trabalho realizado

- O plano diário passou a declarar o intervalo mínimo de sete dias por cliente.
- Foi registrado que o controle deve usar o histórico persistido de execuções e
  continuar válido após novos ciclos do scanner e reinícios do worker.
- Foi esclarecido que completar sete dias não cria direito automático ao envio:
  todos os demais critérios de elegibilidade da automação continuam sendo
  obrigatórios.
- Foram acrescentados casos controlados para provar que ciclos diários e
  reinícios não contornam o intervalo.
- Nenhuma decisão foi tomada sobre periodicidade automática depois do sétimo
  dia; o requisito recebido define somente o intervalo mínimo entre mensagens.

### Arquivos criados, alterados ou removidos

- Alterados:
  - `docs/PLANO_DIARIO_AUTOMACOES.md`;
  - `docs/HISTORICO_DE_ALTERACOES.md`.
- Nenhum arquivo foi criado ou removido.

### Banco, hospedagem e serviços externos

- Nenhum código, migration, dado, configuração ou comportamento foi alterado.
- Nenhuma operação foi realizada em Supabase, Render, Make, Z-API ou GitHub.
- Nenhuma mensagem, commit, publicação ou deploy foi realizado.

### Verificações e resultados

- Revisão documental concluída: a regra está registrada na Noite 6 e em seus
  casos controlados pendentes.
- Testes automatizados não foram executados porque esta tarefa alterou somente
  documentação e não implementou o requisito.

### Riscos, limitações e pendências

- A regra ainda não está implementada nem validada; não deve ser considerada
  disponível no sistema publicado ou no código local.
- Antes da Noite 10, será necessário definir a interação com dados existentes,
  implementar a consulta persistida, cobrir concorrência e executar os testes.

### Como desfazer

- Se o requisito de negócio mudar, registrar uma nova entrada corretiva e
  atualizar o plano sem apagar esta decisão histórica.
- Não existe mudança externa a desfazer.

## 2026-08-05-029 — Registro do módulo futuro de orçamentos

### Tarefa, conversa ou etapa relacionada

- Novo cenário solicitado fora do escopo original das dez noites: criação,
  envio e acompanhamento de orçamentos.

### Objetivo

- Preservar o requisito de uma tela de orçamentos e de uma mensagem automática
  de acompanhamento após sete dias, sem iniciar implementação ou modificar o
  escopo já em validação.

### Trabalho realizado

- Foi acrescentado ao plano um escopo futuro específico para orçamentos.
- O fluxo documentado contempla busca de cliente, cadastro pelo fluxo existente
  quando necessário, criação e persistência do orçamento, envio por WhatsApp e
  exatamente um acompanhamento automático elegível após sete dias.
- Foi registrado que a futura automação deverá usar o produtor único via outbox
  e respeitar template ativo, `isActive`, deduplicação, fila e provedor.
- Foram listadas decisões que ainda precisam de detalhamento: marco inicial dos
  sete dias, campos e estados, condições de cancelamento, permissões, texto da
  mensagem, edição ou reenvio, dados existentes e migration segura.
- A funcionalidade não recebeu número de noite porque ainda exige detalhamento
  e planejamento próprios depois do plano atual.

### Arquivos criados, alterados ou removidos

- Alterados:
  - `docs/PLANO_DIARIO_AUTOMACOES.md`;
  - `docs/HISTORICO_DE_ALTERACOES.md`.
- Nenhum arquivo foi criado ou removido.

### Banco, hospedagem e serviços externos

- Nenhum código, banco, migration, configuração, template ou comportamento foi
  alterado.
- Nenhuma operação foi realizada em Supabase, Render, Make, Z-API ou GitHub.
- Nenhuma mensagem, commit, publicação ou deploy foi realizado.

### Verificações e resultados

- Revisão documental concluída: o fluxo solicitado e as decisões pendentes
  estão registrados em seção própria do plano.
- Testes automatizados não foram executados porque não houve implementação.

### Riscos, limitações e pendências

- A tela, as tabelas, os estados e a automação ainda não existem no sistema.
- O instante que inicia a contagem dos sete dias não foi definido; assumir esse
  marco durante a implementação poderia causar envio antecipado ou atrasado.
- Os estados que devem cancelar o acompanhamento precisam ser definidos para
  evitar contato com cliente que já aceitou, recusou ou agendou.
- A funcionalidade não faz parte da Noite 10 enquanto não houver novo
  planejamento aprovado.

### Como desfazer

- Se o requisito for cancelado ou alterado, registrar uma entrada corretiva e
  atualizar a seção futura do plano, preservando este histórico.
- Não existe mudança externa a desfazer.

## 2026-08-05-030 — Revisão da cadência de cliente inativo

### Tarefa, conversa ou etapa relacionada

- Complemento da regra da Noite 6 após o registro inicial do intervalo mínimo
  de sete dias.

### Objetivo

- Registrar a sequência automática de três mensagens de inatividade e sua
  interrupção imediata quando o cliente realiza um agendamento.

### Trabalho realizado

- A Noite 6 voltou de **Implementada** para **Em andamento**, pois a solução
  local atual cria somente uma mensagem por episódio e não atende à nova
  sequência solicitada.
- Foi registrada a primeira mensagem automática ao alcançar o prazo de
  inatividade configurado.
- Foi registrada a segunda mensagem automática sete dias completos depois da
  primeira, condicionada à permanência da elegibilidade.
- Foi registrada uma terceira mensagem automática no marco informado de 21
  dias. Como a fala não definiu se esse prazo começa na primeira ou na segunda
  mensagem, essa referência ficou explicitamente pendente de confirmação antes
  da implementação.
- Foi registrado que agendamento criado no Portal ou pelo profissional no
  sistema interrompe a sequência e deve invalidar suas pendências.
- Foi registrado que um novo ciclo somente começa depois de novo atendimento e
  quando o cliente alcançar novamente o prazo de inatividade configurado.
- Os casos de validação passaram a cobrir deduplicação de cada etapa,
  persistência, concorrência, reinício e interrupção pelas duas origens de
  agendamento.

### Arquivos criados, alterados ou removidos

- Alterados:
  - `docs/PLANO_DIARIO_AUTOMACOES.md`;
  - `docs/HISTORICO_DE_ALTERACOES.md`.
- Nenhum arquivo foi criado ou removido.

### Banco, hospedagem e serviços externos

- Nenhum código, banco, migration, configuração, template ou comportamento do
  sistema foi alterado.
- Nenhuma operação foi realizada em Supabase, Render, Make, Z-API ou GitHub.
- Nenhuma mensagem, commit, publicação ou deploy foi realizado.

### Verificações e resultados

- Revisão documental concluída: ponto de retomada, cronograma, regra e casos
  controlados da Noite 6 refletem a nova cadência.
- Testes automatizados não foram executados porque não houve implementação.

### Riscos, limitações e pendências

- A sequência de três mensagens ainda não está implementada e não existe no
  sistema publicado.
- É obrigatório confirmar o marco dos 21 dias antes de codificar a terceira
  etapa.
- Ainda deve ser definido o comportamento quando o agendamento que interrompeu
  a sequência for cancelado, não resultar em comparecimento ou não for
  concluído.
- A Noite 10 não deve validar cliente inativo como concluído enquanto esta regra
  não for implementada e testada.

### Como desfazer

- Se a cadência mudar, registrar uma nova entrada corretiva e atualizar o plano
  sem apagar esta decisão histórica.
- Não existe mudança externa a desfazer.

## 2026-08-05-031 — Implementação local da cadência de cliente inativo

### Tarefa, conversa ou etapa relacionada

- Implementação da regra revisada da Noite 6, após documentação e mapeamento do
  fluxo existente.

### Objetivo

- Criar uma sequência automática segura nos dias 0, 7 e 21, interrompida por
  novo agendamento, sem repetição diária, backfill perigoso ou produtor paralelo.

### Trabalho realizado

- O fluxo anterior foi mapeado antes da alteração: sincronização, scanner,
  política de elegibilidade, `queueAutomation`, índice único, claim atômico,
  guarda pré-envio e provedor.
- Criado documento técnico com o trajeto da mudança, compatibilidade, critérios
  de validação, riscos e reversão.
- A política de cliente inativo passou a separar ciclo e etapa. Novos ciclos
  usam chaves `cliente_inativo:<cliente>:<atendimento>:etapa:<1|2|3>`.
- A etapa 1 é criada ao alcançar `inactiveDays`; a etapa 2 somente depois de
  sete dias completos da aceitação da etapa 1; a etapa 3 somente depois de 21
  dias da etapa 1 e de pelo menos sete dias da etapa 2.
- A etapa seguinte depende de a anterior estar em `sucesso`, que no modelo
  atual significa aceitação pelo provedor e não entrega confirmada no WhatsApp.
- Agendamentos posteriores à primeira mensagem interrompem o ciclo usando
  `created_at`, independentemente de terem vindo do Portal ou do sistema
  interno. A guarda consulta novamente o Supabase antes do provedor.
- Um novo atendimento concluído muda a chave do ciclo e volta a aplicar o prazo
  de inatividade configurado antes de qualquer nova etapa 1.
- Chaves da implementação anterior são reconhecidas como ciclos legados
  encerrados. Nenhuma etapa 2 ou 3 é criada retroativamente para esses dados.
- O índice único existente continua garantindo deduplicação. Nenhuma tabela,
  coluna, trigger SQL ou migration nova foi necessária.
- A auto-revisão identificou que uma etapa 2 atrasada poderia aproximar a etapa
  3. A política foi reforçada para preservar sempre sete dias completos entre
  as duas, mantendo 0, 7 e 21 no fluxo normal.
- A Noite 6 voltou ao estado **Implementada**. Ela não foi marcada como
  **Validada** porque a migration anterior ainda aguarda dry-run PostgreSQL e os
  envios reais desta cadência ainda não ocorreram.

### Arquivos criados, alterados ou removidos

- Criado:
  - `docs/CLIENTE_INATIVO_CADENCIA.md`.
- Alterados:
  - `src/db/inactiveCustomerPolicy.ts`;
  - `src/db/automationEngine.ts`;
  - `src/db/localDb.ts`;
  - `tests/automation-behavior.test.ts`;
  - `tests/stabilization-regressions.test.ts`;
  - `docs/PLANO_DIARIO_AUTOMACOES.md`;
  - `docs/HISTORICO_DE_ALTERACOES.md`.
- Nenhum arquivo foi removido.
- O build regenerou somente `dist/`, que permanece ignorado pelo Git e não é
  fonte de publicação versionada.

### Banco, hospedagem e serviços externos

- Nenhuma migration, linha de banco, configuração, template ou trigger foi
  criado ou alterado.
- Nenhuma operação de escrita foi realizada em Supabase, Render, Make, Z-API ou
  GitHub.
- Nenhuma mensagem real, commit, publicação ou deploy foi realizado.
- A única consulta externa foi o `bun audit`, sem alteração de dependências.

### Verificações e resultados

- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo artefatos de segurança e do Portal.
- `npm run test:automations`: 38 de 38 aprovados.
- `npm run test:stabilization`: 21 de 21 aprovados.
- `npm run test:db001`: 11 de 11 aprovados.
- SEC-002, SEC-003, SEC-004 e SEC-005: 44 de 44 aprovados.
- Piloto, Portal e go-live: 29 de 29 aprovados.
- `security:headers`, `security:secrets`, `security:lockfile`,
  `security:licenses` e `security:unused`: aprovados.
- `bun audit --audit-level=high`: aprovado sem vulnerabilidade de nível alto.
- Casos novos aprovados: dias 0, 7 e 21; atraso da etapa 2; ordem; ausência de
  quarta etapa; proteção de histórico legado; interrupção por agendamento;
  guarda pré-envio; repetição do scanner e deduplicação da etapa 2.

### Auto-revisão, riscos, limitações e pendências

- A arquitetura permanece com produtor único via outbox. O scanner seleciona a
  etapa, mas somente `queueAutomation` renderiza e cria a execução.
- Não há perda de chaves existentes nem backfill. Como contrapartida segura,
  execuções legadas não recebem as novas etapas 2 e 3; a cadência completa vale
  somente para novos ciclos identificados com `etapa:1`.
- O marco temporal usa aceitação persistida pelo provedor porque o Make ainda
  não confirma entrega final no WhatsApp.
- Cancelamento preserva o agendamento e mantém a interrupção. Uma exclusão
  física remove a evidência consultada e precisa permanecer auditada.
- A revalidação direta imediatamente antes do provedor reduz a corrida com um
  novo agendamento; uma chamada já aceita pelo provedor não pode ser recolhida.
- A migration anterior da Noite 6 continua sem dry-run PostgreSQL nesta máquina.
  Nenhuma publicação é autorizada até backup, ledger, dry-run e validação
  controlada.

### Como desfazer

- Antes de publicação, reverter somente os arquivos de código e testes desta
  entrada, preservando o documento e registrando a correção em nova entrada.
- Depois de publicação, primeiro desativar a automação de cliente inativo;
  preservar todas as execuções e chaves; então publicar correção posterior sem
  apagar histórico ou liberar deduplicação.
- Como nenhum banco ou ambiente externo foi alterado, não há reversão externa
  nesta tarefa.

---

## 2026-08-05-032 — Módulo de orçamentos e automações de 7 e 14 dias

### Tarefa e objetivo

- Implementar localmente o módulo de orçamentos confirmado pelo usuário, com
  cadastro rápido de cliente, itens, valores, desconto, validade, estados e
  envio por WhatsApp.
- Manter o produtor único de execuções, templates configuráveis, `isActive`,
  deduplicação, claim atômico e guardas pré-envio.
- Criar dois acompanhamentos automáticos: 7 e 14 dias após a aceitação
  persistida do envio inicial pelo provedor.

### Trabalho realizado

- O trajeto existente foi auditado antes da alteração: configuração,
  sincronização, outbox, consumidor, `queueAutomation`, claim, guarda pré-envio
  e integração com o provedor.
- Criada a tela de orçamentos com busca de cliente, cadastro rápido quando ele
  não existe, vínculo opcional de veículo, itens de catálogo ou manuais,
  quantidade, preço por porte, desconto, total, validade, observações e estados.
- Rascunhos podem ser editados. Depois do envio, valores e itens ficam
  imutáveis. O envio exige confirmação explícita na interface.
- Criados os eventos `orcamento_enviado`, `orcamento_followup_7d` e
  `orcamento_followup_14d`, cada um com template, `isActive` e chave de
  deduplicação próprios.
- O envio inicial usa `fn_enviar_orcamento`: template ativo, transição de estado
  e presença do evento no outbox precisam ser confirmados na mesma transação.
  Se o outbox falhar, o orçamento continua em rascunho.
- O trigger SQL registra somente o fato no outbox. Renderização e criação da
  execução continuam exclusivas de `queueAutomation`; nenhum trigger cria
  `automacoes_execucoes`.
- O scanner temporal cria os acompanhamentos a partir da aceitação persistida
  do envio inicial. Uma etapa atrasada não cria mensagens de 7 e 14 dias juntas.
- Estados aceito, recusado, cancelado, vencido e convertido, validade expirada
  ou qualquer agendamento posterior ao envio interrompem os acompanhamentos.
  Portal e sistema interno são tratados igualmente pela tabela de agendamentos.
- O orçamento, seus itens, estado e agendamentos são reconsultados imediatamente
  antes do provedor. A desativação da automação também cancela fila já criada.
- A migration é aditiva, sem backfill e sem mensagens retroativas. Configurações
  e permissões existentes são preservadas; somente chaves ausentes recebem
  defaults.
- A compatibilidade de implantação permite que o código novo continue
  consumindo eventos legados antes da migration; campos novos só são enviados à
  fila quando existe contexto de orçamento.
- Testes manuais usam chave de deduplicação isolada e não colidem com execuções
  reais de orçamento.
- A auto-revisão corrigiu: veículo incorreto em cliente com vários veículos;
  corrida entre envio e agendamento; contatos de 7 e 14 dias simultâneos após
  indisponibilidade; alteração de itens enviados; retorno de estado terminal;
  perda silenciosa do evento inicial; e colisão do teste manual com produção.

### Arquivos criados, alterados ou removidos

- Criados:
  - `src/components/OrcamentosModule.tsx`;
  - `src/db/budgetPolicy.ts`;
  - `supabase/migrations/20260805234000_orcamentos_automacoes.sql`;
  - `docs/MODULO_ORCAMENTOS_AUTOMACAO.md`.
- Alterados:
  - `src/App.tsx`;
  - `src/components/Sidebar.tsx`;
  - `src/components/UsuariosModule.tsx`;
  - `src/db/automationEngine.ts`;
  - `src/db/automationEventPolicy.ts`;
  - `src/db/localDb.ts`;
  - `src/types.ts`;
  - `tests/automation-behavior.test.ts`;
  - `tests/stabilization-regressions.test.ts`;
  - `tests/db001-baseline.test.ts`;
  - `docs/PLANO_DIARIO_AUTOMACOES.md`;
  - `docs/database/db001-manifest.json`;
  - `docs/HISTORICO_DE_ALTERACOES.md`.
- Nenhum arquivo foi removido.
- `dist/` foi regenerado pelo build e continua sendo somente artefato ignorado,
  não uma fonte versionada de publicação.

### Banco, hospedagem e serviços externos

- Foi criada uma migration local; ela **não foi aplicada** ao Supabase ou a
  qualquer outro banco.
- Nenhuma linha, configuração, template ou permissão remota foi alterada.
- Nenhuma mensagem real, commit, push, publicação ou deploy foi realizado.
- Render, Make e Z-API não foram modificados nem acionados com dados reais.
- `bun audit` consultou somente o registro de dependências e não alterou o
  projeto.

### Verificações e resultados

- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo artefatos de segurança e Portal.
- `npm run test:automations`: 41 de 41 aprovados.
- `npm run test:stabilization`: 22 de 22 aprovados.
- `npm run test:db001`: 11 de 11 aprovados.
- SEC-002, SEC-003, SEC-004 e SEC-005: 44 de 44 aprovados.
- Piloto, Portal e go-live: 29 de 29 aprovados.
- `security:headers`, `security:secrets`, `security:lockfile`,
  `security:licenses` e `security:unused`: aprovados.
- `bun audit --audit-level=high`: aprovado sem vulnerabilidade alta reportada.
- Casos novos aprovados: renderização do orçamento; marcos de 7 e 14 dias;
  deduplicação; interrupção por status e agendamento; outbox sem produtor SQL de
  execução; confirmação transacional do evento inicial; e ausência de backfill.

### Auto-revisão, riscos, limitações e pendências

- O código e os testes automatizados estão verdes, mas a migration ainda não
  está liberada para produção: `psql`, Docker e Supabase CLI não existem nesta
  máquina, portanto não foi possível executar o dry-run PostgreSQL.
- Antes de publicação são obrigatórios backup, ledger remoto, dry-run em clone,
  homologação, aplicação da migration antes do código e teste controlado dos
  três eventos com contato autorizado.
- `sucesso` continua significando aceitação pelo provedor, não entrega final no
  WhatsApp. Os dias 7 e 14 são contados desse marco persistido.
- Se o worker ficar indisponível até depois do marco de 14 dias, o contato de 7
  dias vencido não é recriado ao lado do contato de 14 dias. Essa escolha evita
  duas mensagens simultâneas.
- Uma etapa de 7 dias que já estava em retry bloqueia temporariamente a de 14;
  se depois for aceita, preserva-se um intervalo mínimo de sete dias antes da
  próxima mensagem.
- Existe a corrida residual inevitável entre a última revalidação e a aceitação
  do provedor: uma mudança ocorrida nesse intervalo não recolhe uma requisição
  que o provedor já tenha aceitado.
- Clientes com orçamento ficam protegidos contra exclusão física pelo vínculo
  referencial. Exclusão de veículo ou serviço apenas remove o vínculo opcional e
  preserva o conteúdo textual e financeiro já enviado.

### Como desfazer

- Antes de qualquer publicação, reverter somente os arquivos desta entrada e
  registrar a reversão em nova entrada; nenhum ambiente externo exige rollback.
- Depois de aplicar a migration, primeiro desativar as três automações de
  orçamento e preservar outbox e execuções para auditoria.
- Em seguida, retirar a tela e o scanner em publicação posterior. Não apagar
  orçamentos, itens, eventos ou execuções já criados.
- A remoção física das tabelas e colunas não deve fazer parte de rollback
  emergencial; deve ser avaliada separadamente somente depois de backup e
  confirmação de que não existe histórico a preservar.

---

## 2026-08-05-033 — Diagnóstico de bloqueio para commit e push

### Tarefa e objetivo

- Preparar commit e push das alterações do módulo de orçamentos para teste,
  conforme autorização do usuário.

### Trabalho realizado

- Verificada a pasta atual e todos os diretórios pais até a raiz do volume.
- Confirmado que não existe diretório `.git`, branch atual ou remoto Git
  configurado nesta cópia do projeto.
- Verificada a GitHub CLI instalada. A conta registrada localmente não possui
  mais uma autenticação válida.
- Procuradas referências ao repositório de origem nos arquivos do projeto e em
  resultados públicos; nenhuma URL canônica segura foi encontrada.
- Por segurança, não foi executado `git init`, não foi criado remoto por
  suposição e nenhum arquivo foi preparado para commit.

### Arquivos criados, alterados ou removidos

- Alterado somente `docs/HISTORICO_DE_ALTERACOES.md` para registrar o
  diagnóstico.
- Nenhum código, teste, banco ou arquivo de configuração foi alterado.
- Nenhum arquivo foi criado ou removido.

### Banco, hospedagem e serviços externos

- Nenhuma operação foi realizada no Supabase, Render, Make ou Z-API.
- Nenhum commit, push, branch, repositório ou deploy foi criado.
- Nenhuma migration foi aplicada e nenhuma mensagem foi enviada.

### Verificações e resultados

- `git rev-parse --show-toplevel`: reprovado porque a pasta não pertence a um
  repositório Git.
- `git remote -v` e `git branch --show-current`: indisponíveis pelo mesmo motivo.
- `gh auth status`: GitHub CLI presente, porém a autenticação registrada está
  inválida.
- Busca por URL canônica do GitHub no projeto: nenhuma referência encontrada.

### Riscos, limitações e pendências

- É necessário informar ou recuperar a URL exata do repositório GitHub e
  autenticar novamente a conta antes de qualquer publicação.
- Também será necessário comparar esta cópia com o branch remoto antes de
  preparar o commit, evitando substituir trabalho existente ou publicar uma
  árvore sem histórico.

### Como desfazer

- Esta entrada é apenas documental e não possui efeito externo.
- Se alguma informação precisar ser corrigida, registrar nova entrada sem
  apagar este diagnóstico.

---

## 2026-08-05-034 — Commit e push do módulo de orçamentos e automações

### Tarefa e objetivo

- Preparar e publicar no GitHub somente os arquivos obrigatórios para execução
  das mudanças locais de automações e do módulo de orçamentos.
- Excluir do commit testes, documentação, scripts de dry-run, manifests e
  demais arquivos auxiliares que não são necessários à execução no Render.

### Trabalho realizado

- O repositório canônico foi confirmado como
  `senhoralimpezaautomotiva/senhoralimpezasistema`.
- A comparação demonstrou que a base correta era a branch remota
  `piloto-2026`, no commit `f9018bbc0832dac047ac443a8427c4bb61f5a4a8`.
- Foi criada a branch `orcamentos-automacoes-7-14d` a partir dessa base.
- Foram preparados exclusivamente 30 arquivos de execução e migrations.
- Foi criado o commit `128aa17fbfb607af58e11c1ac3940552d4848d93`, com a
  mensagem `feat: adiciona orcamentos e reforca automacoes`.
- A nova branch foi publicada no GitHub. Nenhum pull request ou merge foi
  criado.

### Arquivos criados, alterados ou removidos

- O commit contém exclusivamente os arquivos de servidor, interface em
  execução, políticas do motor de automações e migrations necessários ao
  comportamento publicado.
- Testes, documentação, scripts de dry-run, scripts auxiliares, manifests e
  arquivos de histórico ficaram fora do commit.
- Este arquivo de histórico foi alterado somente localmente após o push e não
  integra o commit publicado.

### Banco, hospedagem e serviços externos

- O GitHub recebeu somente a nova branch
  `orcamentos-automacoes-7-14d` e o commit `128aa17`.
- As branches remotas `main` e `piloto-2026` não foram alteradas.
- Nenhuma migration foi aplicada e nenhum dado foi alterado no Supabase.
- Nenhuma publicação ou configuração foi realizada no Render.
- Make e Z-API não foram modificados e nenhuma mensagem real foi enviada.

### Verificações e resultados

- O escopo preparado foi conferido por `git diff --cached --name-status` e
  continha exatamente 30 arquivos aprovados.
- O commit possui como pai direto o commit remoto `f9018bb` da branch
  `piloto-2026`.
- O push foi confirmado pelo remoto e a branch passou a acompanhar
  `origin/orcamentos-automacoes-7-14d`.
- Permanecem válidos os resultados executados antes do commit: build aprovado,
  147 testes aprovados, verificações de segurança aprovadas e auditoria de
  dependências sem vulnerabilidade alta reportada.
- O dry-run PostgreSQL das migrations continua indisponível nesta máquina por
  ausência de `psql`, Docker e Supabase CLI.

### Riscos, limitações e pendências

- A publicação da branch não equivale a deploy nem autoriza merge.
- As migrations ainda precisam do fluxo seguro já documentado: backup, ledger,
  dry-run em clone, aplicação controlada antes do código e validação posterior.
- O código da branch não deve ser promovido ao ambiente de testes ou produção
  antes dessa validação das migrations.
- Há alterações locais auxiliares fora do commit; elas devem permanecer fora de
  qualquer envio até decisão específica.

### Como desfazer

- Como não houve merge ou deploy, a reversão externa consiste em remover a
  branch remota somente se isso for explicitamente solicitado; o commit pode
  permanecer preservado para auditoria.
- Não há rollback de banco, Render, Make ou Z-API porque nenhum desses ambientes
  foi alterado.

---

## 2026-08-05-035 — Auditoria pré-deploy de Render e Supabase

### Tarefa e objetivo

- Prosseguir com a publicação da branch de orçamentos no Render, respeitando a
  ordem segura de migrations antes do código.
- Confirmar, antes de qualquer mutação, backup, ledger, ferramentas, branch,
  configuração e viabilidade do build remoto.

### Trabalho realizado

- O serviço `senhora-limpeza-piloto` foi inspecionado de forma somente leitura
  no Render.
- Confirmado que o serviço continua configurado para a branch `piloto-2026`,
  com auto-deploy desativado e build por `npm run build:render`.
- Confirmado que o deploy mais recente da branch, no commit `f9018bb`, falhou
  durante o teste DB-001. A versão ativa continua sendo o commit anterior
  `c893fe0`.
- A causa do build remoto foi confirmada: divergência entre arquivos SQL e o
  manifesto versionado.
- A branch `orcamentos-automacoes-7-14d` não contém os arquivos auxiliares de
  build que o próprio `build:render` executa. Publicá-la no estado atual
  repetiria a falha, pois testes, manifesto e scripts foram excluídos do commit
  anterior conforme o escopo então aprovado.
- O ambiente do Render contém as chaves obrigatórias esperadas, incluindo a
  configuração privada de serviço do Supabase, sem que seus valores fossem
  copiados ou alterados.
- O projeto Supabase foi inspecionado de forma somente leitura. O ledger remoto
  registra migrations até `20260731001000_automacoes_imediatas_defaults`.
- As migrations `20260805220000`, `20260805230000`, `20260805233000` e
  `20260805234000` ainda não aparecem no ledger.
- O painel informou que o plano gratuito não inclui backups programados.
- A máquina continua sem Supabase CLI, `psql`, `pg_dump`, Docker, vínculo local
  ou variáveis de conexão ao banco.

### Arquivos criados, alterados ou removidos

- Alterado somente `docs/HISTORICO_DE_ALTERACOES.md` para registrar esta
  auditoria.
- Nenhum código, migration, teste, manifesto ou script foi alterado.
- Nenhum arquivo foi criado ou removido.

### Banco, hospedagem e serviços externos

- Nenhuma migration, consulta SQL de escrita, backfill ou alteração de dados foi
  executada no Supabase.
- Nenhuma configuração, branch, build, deploy, suspensão ou reinicialização foi
  realizada no Render.
- Nenhum commit, push, pull request ou merge adicional foi realizado no GitHub.
- Make e Z-API não foram acionados ou alterados.

### Verificações e resultados

- Render: serviço ativo confirmado no commit `c893fe0`; deploy `f9018bb`
  confirmado como falho no teste DB-001.
- Render: branch configurada `piloto-2026`, auto-deploy desligado, health check
  `/health` e credenciais obrigatórias presentes.
- Supabase: ledger confirmado com onze migrations, da baseline até
  `20260731001000`.
- Supabase: ausência de backup programado confirmada pelo painel do plano Free.
- Local: `supabase`, `psql`, `pg_dump` e Docker indisponíveis; projeto não
  vinculado e sem credenciais de banco no ambiente.
- Nenhum teste foi reexecutado porque nenhum arquivo funcional foi alterado e o
  deploy foi interrompido antes de qualquer mudança.

### Riscos, limitações e pendências

- É necessário autorizar um commit complementar com os arquivos de build que
  haviam sido excluídos, pois o Render os executa obrigatoriamente.
- É necessário gerar e verificar um backup lógico atual antes de aplicar as
  quatro migrations novas.
- Para isso, ainda são necessários binários PostgreSQL, Supabase CLI, vínculo ao
  projeto e entrada segura da senha do banco, sem registrá-la em arquivo ou
  conversa.
- Alterar o build do Render para ignorar testes não é uma alternativa segura e
  não foi realizado.
- Aplicar SQL pelo editor do Dashboard contrariaria a fonte oficial e o runbook;
  essa opção não foi utilizada.

### Como desfazer

- Esta etapa não produziu alteração externa; não há rollback de banco, Render,
  GitHub, Make ou Z-API.
- Para desfazer somente o registro local, criar uma nova entrada corretiva sem
  apagar esta evidência.

---

## 2026-08-05-036 — Aplicação das migrations de automações e orçamentos

### Tarefa e objetivo

- Aplicar no Supabase de testes, pelo navegador e conforme o procedimento já
  utilizado anteriormente no laboratório, as quatro migrations posteriores à
  versão `20260731001000`.
- Manter o Render fora de execução durante a mudança e validar o banco antes de
  reativar o serviço.

### Trabalho realizado

- Reconfirmado no histórico que o responsável declarou este Supabase como
  laboratório descartável, sem dados de negócio que exijam backup, e autorizou
  anteriormente o uso do editor SQL para migrations controladas.
- Executado diagnóstico agregado sem exposição de dados pessoais.
- O serviço `senhora-limpeza-piloto` foi suspenso antes de qualquer SQL de
  escrita.
- Cada arquivo local foi carregado integralmente, normalizado apenas em memória,
  conferido byte a byte após a colagem no editor e executado em transação.
- O registro correspondente no ledger foi incluído na mesma transação de cada
  migration, evitando schema aplicado sem versão registrada.
- Aplicadas e registradas, nesta ordem:
  - `20260805220000_lembrete_seguranca`;
  - `20260805230000_cliente_inativo_seguranca`;
  - `20260805233000_automacoes_monitoramento_operacional`;
  - `20260805234000_orcamentos_automacoes`.
- O editor repetiu o comportamento histórico de reter parte de uma consulta
  diagnóstica. A consulta inválida foi recusada por sintaxe antes de qualquer
  escrita. A partir daí, todo conteúdo foi selecionado, substituído, copiado de
  volta e comparado integralmente antes de executar.
- O serviço antigo foi reativado após as validações. O endpoint público
  `/health` respondeu HTTP 200 com estado `ok`.

### Arquivos criados, alterados ou removidos

- Alterado somente `docs/HISTORICO_DE_ALTERACOES.md` para registrar a operação.
- Nenhum código, teste, migration, manifesto ou script local foi alterado.
- Nenhum arquivo foi criado ou removido.

### Banco, hospedagem e serviços externos

- As quatro migrations foram aplicadas ao projeto Supabase de testes e passaram
  a constar no ledger `supabase_migrations.schema_migrations`.
- A migration de orçamentos criou as tabelas, funções, triggers, policies,
  relacionamentos com outbox/fila, templates e permissões previstos.
- Não houve backfill de orçamento e nenhuma mensagem foi criada ou enviada.
- O Render foi suspenso durante a janela e reativado ao final.
- Nenhum deploy novo foi iniciado; o serviço continua executando a versão
  anterior ativa.
- Nenhuma operação foi realizada no Make, Z-API ou GitHub nesta etapa.

### Verificações e resultados

- Estado anterior: 51 execuções em sucesso, 17 em erro definitivo, zero
  pendências vazias, zero pendências legadas de lembrete, zero inativos
  ambíguos, zero claims expirados e 15 eventos processados no outbox.
- Configuração de automações confirmada como array JSON.
- Migration de lembretes: ledger presente, trigger presente e zero pendências
  legadas.
- Migration de cliente inativo: ledger presente, zero pendências ambíguas e
  zero registros movidos para a quarentena legada.
- Migration de monitoramento: ledger presente, `service_role` com permissão de
  claim, função restrita a status pendente e zero claims expirados.
- Migration de orçamentos: quatro novas versões no ledger, tabelas e RPC de
  envio presentes, vínculos de fila presentes e zero orçamentos retroativos.
- Três templates de orçamento presentes, ativos e com texto não vazio.
- Zero usuários sem a nova permissão e RLS ativo nas duas tabelas.
- Fila preservada depois da mudança: 51 sucessos, 17 erros definitivos e outbox
  com 15 eventos processados.
- Render após reativação: `GET /health` retornou HTTP 200 e `{"status":"ok"}`.

### Riscos, limitações e pendências

- O ambiente permanece no plano gratuito sem backup programado. A aplicação foi
  realizada porque o laboratório descartável já havia sido explicitamente
  autorizado nesse modelo; isso não deve ser repetido em produção.
- O código novo ainda não está publicado no Render. A branch atual precisa de
  um commit complementar com testes, manifesto e scripts exigidos pelo próprio
  `build:render`.
- A versão antiga reativada é compatível com o schema aditivo, mas não oferece a
  tela nem o fluxo de orçamentos.
- Ainda faltam build remoto verde, deploy do commit novo, health check da nova
  versão e teste funcional controlado.

### Como desfazer

- Não remover tabelas, colunas, eventos, execuções ou versões do ledger.
- Em falha funcional, manter as automações de orçamento desativadas e corrigir
  para frente com nova migration e novo commit.
- Como não houve deploy do código novo, não existe rollback de aplicação nesta
  etapa; o serviço já voltou à versão anteriormente ativa.

---

## 2026-08-05-037 — Publicação do módulo de orçamentos e automações no Render

### Tarefa e objetivo

- Completar no GitHub somente os arquivos exigidos pelo `build:render`, apontar
  o serviço piloto para a branch `orcamentos-automacoes-7-14d`, publicar a
  versão validada e executar uma nova revisão operacional pós-deploy.
- Preservar a arquitetura de produtor único via outbox e as migrations já
  aplicadas no laboratório Supabase.

### Trabalho realizado

- A conta proprietária do repositório foi autenticada pelo navegador e a branch
  de implantação recebeu os arquivos complementares exigidos pelas validações
  do Render.
- Os 14 arquivos inicialmente complementados foram comparados por Git blob SHA
  com os arquivos locais e todos ficaram idênticos.
- Os testes obsoletos `tests/night4-reminder.test.ts` e
  `tests/night5-reminder-safety.test.ts` foram removidos da branch.
- O primeiro build remoto foi recusado porque o teste de automações exigia o
  blueprint sanitizado do Make. O arquivo foi incluído e teve seu SHA conferido.
- O segundo build remoto foi recusado porque o teste de estabilização detectou
  que `scripts/automations/run-dry-run.ps1` ainda não referenciava todas as
  migrations atuais. O arquivo local atualizado foi publicado e teve seu SHA
  conferido.
- O terceiro build remoto passou integralmente e o Render promoveu o commit
  `8b4df940a79b959c0664d6e79567ac66dbd315fb` para estado `live`.
- A aplicação pública foi aberta no navegador. Os módulos de Orçamentos e
  Automações carregaram sem erro; Orçamentos informa acompanhamentos automáticos
  em 7 e 14 dias.
- Foi executada uma consulta agregada e somente leitura no Supabase após o
  deploy para conferir a integridade da outbox, da fila e das novas tabelas.

### Arquivos criados, alterados ou removidos

- Alterado localmente apenas `docs/HISTORICO_DE_ALTERACOES.md` para registrar
  esta publicação.
- Na branch remota, foram criados ou atualizados os seguintes arquivos de apoio
  obrigatório ao build:
  - `.gitignore`;
  - `package.json`;
  - `make-blueprints/Integration Webhooks.blueprint.json`;
  - `scripts/pilot/run-render-build.ts`;
  - `scripts/security/check-licenses.ts`;
  - `scripts/automations/dry-run-monitoring-assertions.sql`;
  - `scripts/automations/run-dry-run.ps1`;
  - `docs/database/db001-manifest.json`;
  - `docs/CLIENTE_INATIVO_CADENCIA.md`;
  - `tests/automation-behavior.test.ts`;
  - `tests/db001-baseline.test.ts`;
  - `tests/go-live001-deployment.test.ts`;
  - `tests/pilot-readiness.test.ts`;
  - `tests/sec004-safe-outputs.test.ts`;
  - `tests/sec005-security-baseline.test.ts`;
  - `tests/stabilization-regressions.test.ts`.
- Removidos somente da branch remota os dois testes obsoletos da Noite 4 e da
  Noite 5 citados acima.
- Nenhum arquivo funcional adicional foi alterado durante a correção dos dois
  builds recusados.

### Banco, hospedagem e serviços externos

- GitHub: a branch `orcamentos-automacoes-7-14d` passou a apontar para o commit
  `8b4df940a79b959c0664d6e79567ac66dbd315fb`. `main` e `piloto-2026` não foram
  alteradas e nenhum merge ou pull request foi criado.
- Render: o serviço `senhora-limpeza-piloto` foi reconfigurado da branch
  `piloto-2026` para `orcamentos-automacoes-7-14d`; auto-deploy permaneceu
  desligado. Os dois builds falhos não substituíram a versão ativa. O terceiro
  build foi promovido e está `live`.
- Supabase: nenhuma migration, escrita, backfill ou remoção foi executada nesta
  etapa. Apenas uma consulta agregada e somente leitura foi executada.
- Make e Z-API: nenhuma configuração foi modificada e nenhuma mensagem real foi
  enviada. O cenário do Make havia sido confirmado ativo antes do deploy; a
  sessão web expirou na conferência posterior e não foi reautenticada.

### Verificações e resultados

- Local: `npm run build` aprovado.
- Local: `npm run security:ci` aprovado integralmente após execução fora da
  restrição de cache do sandbox; dois builds, testes SEC-002 a SEC-005, DB-001,
  automações, estabilização, piloto, portal, go-live, varredura de segredos,
  dependências e licenças ficaram verdes.
- GitHub: os 14 arquivos complementares iniciais, o blueprint do Make e o
  `run-dry-run.ps1` foram conferidos por SHA contra os arquivos locais.
- Render: build remoto aprovado, incluindo 41 testes de automações, 22 de
  estabilização, 9 de prontidão do piloto, 11 do portal e 9 de go-live, além das
  verificações de segurança, dependências e licenças.
- Render: deploy final em estado `live` no commit `8b4df94`.
- Endpoint público: `GET /health` retornou HTTP 200, conteúdo JSON e
  `{"status":"ok"}`.
- Aplicação pública: interface administrativa carregada; módulo Orçamentos
  presente e painel de Automações acessível.
- Painel após sincronização: histórico preservado com 51 execuções aceitas pelo
  provedor e 17 erros definitivos históricos, fila pendente zerada e nenhuma
  execução marcada para reconciliação.
- Supabase pós-deploy: zero eventos pendentes na outbox, zero execuções
  pendentes com mensagem vazia, zero claims expirados, zero orçamentos e zero
  itens de orçamento. A ausência de orçamentos confirma que não houve backfill.

### Riscos, limitações e pendências

- A validação técnica não substitui o teste real de uso do orçamento: ainda é
  necessário criar, enviar e acompanhar um orçamento controlado para confirmar
  o WhatsApp imediato e os acompanhamentos de 7 e 14 dias.
- O serviço usa instância gratuita do Render e pode sofrer atraso de cold start.
- O Supabase de laboratório permanece sem backup programado pelo plano gratuito.
- A branch de implantação permanece separada e divergente de `main`; qualquer
  promoção futura deve reconciliar essa divergência sem reintroduzir a
  arquitetura anterior.
- O cenário do Make não foi alterado nesta etapa. Sua atividade havia sido
  confirmada antes do deploy, mas a sessão do painel expirou na checagem final.
- Não foi executado teste que criasse orçamento, evento, execução ou mensagem
  real para evitar efeitos externos e disparos indevidos.

### Como desfazer

- Para rollback da aplicação, reconfigurar o Render para `piloto-2026` e
  publicar manualmente o último commit anteriormente estável; isso não exige
  remoção de tabelas nem perda de dados.
- Não apagar migrations, tabelas, ledger, eventos ou execuções. O schema é
  aditivo e deve permanecer para compatibilidade.
- Se for necessário desfazer os arquivos complementares no GitHub, criar commits
  de reversão na branch de implantação, preservando o histórico; não reescrever
  nem excluir a branch enquanto ela estiver configurada no Render.

## 2026-08-05-038 — Implementação do novo Portal do Cliente

### Tarefa relacionada

- Implantação do layout aprovado do Portal do Cliente, com preservação do fluxo
  de agendamento existente e preparação para commit, push e deploy.

### Objetivo

- Transformar o protótipo aprovado em telas funcionais, manter o agendamento já
  utilizado, adicionar catálogo configurável, cartão fidelidade, histórico e
  consulta somente leitura da agenda, com identidade visual da loja.

### Resumo do que foi feito

- Aplicado o padrão visual aprovado ao login, cabeçalho e páginas do portal,
  incluindo gradiente, bordas, cores suaves e o logotipo fornecido pela loja.
- Criada a tela principal com saudação centralizada, informativos e quatro
  botões simétricos; o botão `Consultar agenda` ocupa a largura das duas colunas
  e possui altura menor.
- Mantido o fluxo anterior de `Agendar serviço`, acessado pela nova navegação.
- Implementadas as telas de catálogo, cartão fidelidade, histórico e consulta
  de disponibilidade.
- Adicionada configuração administrativa para escolher catálogo do sistema ou
  WhatsApp, informar a URL HTTPS e definir a meta do cartão fidelidade.
- Criada migration aditiva para as configurações e para a contagem segura das
  indicações concluídas do cliente autenticado.
- Corrigido o teste DB-001 para ignorar apenas a pasta `.tmp` interna ao projeto,
  em vez de rejeitar caminhos cujo diretório pai tenha esse nome.

### Arquivos criados, alterados ou removidos

- Criados: `public/senhora-limpeza-logo.jpeg`,
  `src/components/ClientPortalHome.tsx`,
  `supabase/migrations/20260805235000_portal_cliente_experiencia.sql` e
  `docs/PORTAL_CLIENTE_IMPLEMENTACAO.md`.
- Alterados: `src/components/ClientPortal.tsx`,
  `src/portal/PortalAuthGate.tsx`, `src/portal/portalSupabase.ts`,
  `src/components/ConfiguracoesModule.tsx`, `src/db/localDb.ts`, `src/types.ts`,
  `tests/portal001-auth-isolation.test.ts`, `tests/db001-baseline.test.ts` e
  `docs/database/db001-manifest.json`.
- Removidos: nenhum arquivo do projeto.

### Banco, hospedagem e serviços externos

- Nesta etapa, a migration foi criada e validada localmente, mas ainda não foi
  aplicada ao Supabase.
- Nenhuma publicação foi executada no Render nesta etapa.
- Nenhum cenário do Make ou provedor de mensagens foi alterado.

### Verificações e resultados

- `npm run lint`: aprovado.
- `npm run test:portal001`: 13 testes aprovados.
- `npm run test:db001`: 11 testes aprovados.
- `npm run build`: aprovado, incluindo política de artefato e presença segura do
  Portal do Cliente no bundle.
- `npm run security:ci`: todas as compilações e suítes executadas foram
  aprovadas; a primeira execução parou somente na consulta externa do `bun audit`
  por conexão recusada no ambiente restrito.
- `npm run security:dependencies`, repetido com acesso de rede: aprovado; 17
  dependências diretas verificadas, sem vulnerabilidade alta reportada.

### Riscos, limitações e pendências

- A experiência autenticada completa depende da aplicação da migration antes da
  publicação da nova interface.
- O catálogo do WhatsApp precisa receber uma URL HTTPS válida nas configurações;
  enquanto isso, o padrão permanece no catálogo interno.
- A validação visual autenticada em produção permanece pendente para a etapa de
  deploy; nenhum dado real foi criado durante os testes locais.

### Como desfazer

- Reverter os arquivos desta implementação por meio de um novo commit, sem
  reescrever o histórico Git.
- Manter a migration aditiva instalada em eventual rollback da interface; ela
  não altera o fluxo anterior e seus campos possuem valores padrão compatíveis.

## 2026-08-05-039 — Publicação e validação do novo Portal do Cliente

### Tarefa relacionada

- Commit, push, aplicação de migration, deploy e validação final da etapa
  registrada em `2026-08-05-038`.

### Objetivo

- Disponibilizar o novo Portal do Cliente no ambiente piloto, mantendo uma
  trilha verificável do código, banco e hospedagem alterados.

### Resumo do que foi feito

- Criado o commit `f892935` (`feat: implantar novo portal do cliente`) e enviada
  a branch `portal-cliente-layout` ao GitHub.
- Aplicada no Supabase a migration
  `20260805235000_portal_cliente_experiencia.sql`.
- Alterada no Render a branch do serviço `senhora-limpeza-piloto`, de
  `orcamentos-automacoes-7-14d` para `portal-cliente-layout`.
- Executado deploy manual do commit `f892935`, confirmado no estado `live`.
- Validada a experiência publicada com uma sessão de portal já existente, sem
  cadastrar, alterar ou cancelar agendamentos.

### Arquivos criados, alterados ou removidos

- Alterado somente `docs/HISTORICO_DE_ALTERACOES.md` nesta etapa de registro
  pós-publicação.
- Os arquivos funcionais publicados estão listados na entrada
  `2026-08-05-038`.
- Nenhum arquivo foi removido.

### Banco, hospedagem e serviços externos

- Supabase: migration registrada na versão `20260805235000`; três colunas de
  configuração confirmadas e permissão de execução da RPC confirmada para o
  papel `authenticated`.
- Render: serviço `senhora-limpeza-piloto` publicado na branch
  `portal-cliente-layout`, commit funcional `f892935`.
- GitHub: branch `portal-cliente-layout` criada e enviada ao repositório remoto.
- Make e provedor de mensagens: nenhuma configuração ou execução foi alterada.

### Verificações e resultados

- Verificação pós-migration: `migration_registrada=true`,
  `colunas_configuracao=3` e `rpc_autenticada=true`.
- Render: deploy do commit `f892935` confirmado como `live`.
- Health check público: HTTP 200 com `{"status":"ok"}`.
- Portal publicado: tela principal autenticada carregou com os cinco acessos;
  os quatro botões superiores mediram igualmente 211 × 142 px e o botão
  `Consultar agenda` mediu 435 × 64 px.
- Cartão fidelidade: logotipo, dez marcações e progresso agregado carregados.
- Consulta de agenda: horários exibidos com o aviso explícito de que nenhum
  horário é reservado; nenhuma ação mutável foi apresentada ou executada.

### Riscos, limitações e pendências

- O serviço permanece no plano gratuito do Render e pode sofrer cold start.
- O catálogo permanece no modo `system` até que o administrador escolha
  `whatsapp` e informe uma URL HTTPS válida.
- Não foi criado um agendamento de teste para evitar efeitos externos; o fluxo
  anterior foi preservado no código e coberto pelas suítes automatizadas.
- Este commit documental é posterior ao commit funcional publicado; a branch
  será atualizada sem necessidade de nova publicação, pois não altera runtime.

### Como desfazer

- Aplicação: reconfigurar o Render para `orcamentos-automacoes-7-14d` e publicar
  novamente o commit estável anterior `8b4df94`.
- Banco: manter a migration aditiva para compatibilidade. Se uma reversão de
  schema for indispensável, criar uma migration corretiva após confirmar que a
  aplicação anterior está ativa; não apagar o ledger nem a migration aplicada.
- GitHub: usar um novo commit de reversão na branch, preservando todo o histórico.

## 2026-08-05-040 — Alinhamento do Render ao commit documental final

### Tarefa relacionada

- Complemento da publicação registrada em `2026-08-05-039`.

### Objetivo

- Garantir que o serviço publicado também apontasse para o commit que contém o
  registro completo da implantação.

### Resumo do que foi feito

- Após o push do commit documental `068220c`, foi executado um segundo deploy
  manual no Render.
- O serviço `senhora-limpeza-piloto` foi confirmado como `live` no commit
  `068220c`.

### Arquivos criados, alterados ou removidos

- Alterado somente `docs/HISTORICO_DE_ALTERACOES.md` para registrar esta
  confirmação posterior.
- Nenhum arquivo funcional foi criado, alterado ou removido nesta etapa.

### Banco, hospedagem e serviços externos

- Render: commit `068220c` publicado e confirmado como `live`.
- Supabase, Make e provedor de mensagens: nenhuma alteração adicional.

### Verificações e resultados

- Build remoto aprovado, incluindo validação de artefato e presença do portal.
- Estado final do deploy no painel do Render: `live`.

### Riscos, limitações e pendências

- O commit gerado por esta própria entrada é exclusivamente documental e não
  precisa de novo deploy para alterar o comportamento em execução.
- Permanecem apenas as limitações operacionais registradas em
  `2026-08-05-039`.

### Como desfazer

- Aplicar as mesmas orientações de rollback descritas em `2026-08-05-039`.

## 2026-08-06-041 — Indicações integradas ao cartão fidelidade

### Tarefa relacionada

- Substituição integral do desconto por indicação por marcações no cartão
  fidelidade, com controle manual e histórico no perfil do cliente.

### Objetivo

- Fazer a primeira finalização de um cliente indicado gerar exatamente uma
  marcação para quem indicou, sem percentual, desconto ou duplicidade.

### Resumo do que foi feito

- Removidos do runtime, tipos, configurações e interfaces os campos e cálculos de
  desconto por indicação.
- Criado ledger auditável de fidelidade com movimentações `+1` e `-1`, origem,
  cliente indicado, agendamento, responsável, observação e data.
- Criado trigger de banco para a primeira transição do indicado a `finalizado` ou
  `entregue`; índice único parcial e `ON CONFLICT DO NOTHING` garantem uma única
  marcação automática por indicado.
- Adicionado backfill das indicações antigas já concluídas, preservando uma única
  marcação por indicado.
- Criada RPC transacional para adição e remoção manual por funcionário ativo,
  com trava contra saldo negativo e histórico imutável.
- Incluída no perfil do cliente a seção `Cartão fidelidade`, com saldo, marcações,
  botões de adicionar/remover e histórico de alterações.
- Atualizado o painel de indicações para exibir conversões e marcações, sem
  créditos monetários ou percentuais.
- Atualizado o Portal do Cliente para explicar a nova regra e consultar o saldo
  agregado no ledger.
- Removida, com autorização explícita, somente a pasta temporária `.tmp` do
  projeto para recuperar espaço em disco; continha caches, builds e uma cópia
  temporária de trabalho, sem arquivos funcionais do projeto principal.

### Arquivos criados, alterados ou removidos

- Criados: `supabase/migrations/20260806150000_referral_loyalty_ledger.sql` e
  `tests/referral-loyalty.test.ts`.
- Alterados: `src/types.ts`, `src/security/publicConfig.ts`,
  `src/db/localDb.ts`, `src/App.tsx`, `src/components/ClientPortal.tsx`,
  `src/components/ClientesModule.tsx`, `src/components/IndicacoesModule.tsx`,
  `src/components/ConfiguracoesModule.tsx`, `package.json`,
  `tests/db001-baseline.test.ts`, `docs/database/db001-manifest.json` e este
  histórico.
- Removidos: `.tmp` (somente artefatos temporários locais autorizados).

### Banco, hospedagem e serviços externos

- Migration criada e validada localmente, mas não aplicada ao Supabase nesta
  etapa.
- Nenhuma publicação foi realizada no Render ou GitHub.
- Make e provedores de mensagens não foram modificados.

### Verificações e resultados

- `npm run lint`: aprovado.
- `npm run test:referral-loyalty`: 4 testes aprovados.
- `npm run test:portal001`: 13 testes aprovados.
- `npm run test:db001`: 11 testes aprovados.
- `npm run test:stabilization`: 22 testes aprovados.
- `npm run test:sec002`: 8 testes aprovados.
- `npm run build`: aprovado, incluindo políticas de artefato e presença segura
  do Portal do Cliente.
- Busca estática no runtime confirmou ausência de campos e cálculos antigos de
  desconto por indicação.
- A validação visual pelo navegador integrado não pôde ser concluída porque o
  controlador do navegador falhou ao inicializar seus arquivos internos; o
  servidor local iniciou e a compilação das telas foi aprovada.

### Riscos, limitações e pendências

- A nova migration precisa ser aplicada ao Supabase antes de publicar o código;
  publicar somente a interface antes do banco fará a sincronização do ledger e a
  RPC manual falharem.
- O backfill deve ser conferido em ambiente de homologação ou transação controlada
  antes da aplicação em produção.
- A inspeção visual autenticada das telas permanece pendente por indisponibilidade
  do controlador do navegador desta sessão.

### Como desfazer

- Reverter os arquivos de interface e runtime por novo commit, preservando este
  histórico.
- Se a migration já tiver sido aplicada, desabilitar primeiro o trigger
  `trg_award_referral_loyalty_mark` por migration corretiva e manter a tabela de
  ledger para auditoria; não apagar movimentações.
- Não restaurar os campos de desconto sem uma nova decisão de produto e migration
  explícita.

## 2026-08-06-042 — Commit e push da fidelidade; deploy aguardando acesso aos painéis

### Tarefa relacionada

- Publicação da alteração registrada em `2026-08-06-041` para testes.

### Objetivo

- Versionar e enviar a implementação ao repositório canônico, aplicar a migration
  antes da aplicação e publicar no Render.

### Resumo do que foi feito

- Reconstruídos os metadados Git locais a partir da branch remota
  `portal-cliente-layout`, sem sobrescrever o workspace.
- Alterações antigas e não relacionadas de automações foram mantidas fora do
  stage e do commit.
- Criado o commit `17fa2d0` (`feat: integrar indicacoes ao cartao fidelidade`) e
  realizado push para `senhoralimpezaautomotiva/senhoralimpezasistema` na branch
  `portal-cliente-layout`.
- O commit remoto foi confirmado pela API do GitHub.
- A migration e o deploy não foram executados: não há CLI/token do Supabase ou
  Render neste terminal, e o controlador do navegador autenticado falhou ao
  inicializar seus arquivos internos. O deploy foi interrompido deliberadamente
  para não publicar o runtime novo antes do schema necessário.

### Arquivos criados, alterados ou removidos

- Alterado somente `docs/HISTORICO_DE_ALTERACOES.md` nesta etapa documental.
- Os 14 arquivos do commit funcional estão registrados em `2026-08-06-041`.

### Banco, hospedagem e serviços externos

- GitHub: commit `17fa2d0` publicado em `portal-cliente-layout`.
- Supabase: nenhuma migration aplicada nesta etapa.
- Render: nenhum deploy iniciado nesta etapa.

### Verificações e resultados

- Repositório canônico e permissão de push confirmados.
- `git diff --cached --check`: aprovado antes do commit.
- Push confirmado de `07df5c4` para `17fa2d0`.
- Consulta do commit pela API do GitHub retornou o SHA completo
  `17fa2d0946f9151b4b3e6598ea6dfb2ea9b06345`.

### Riscos, limitações e pendências

- Aplicar `20260806150000_referral_loyalty_ledger.sql` no Supabase e validar seus
  objetos antes de qualquer deploy no Render.
- Após a migration, publicar a branch e confirmar health check, commit ativo e
  telas autenticadas.

### Como desfazer

- Enquanto não houver migration ou deploy, criar um commit de reversão na branch
  caso seja necessário retirar a implementação do GitHub; não reescrever o
  histórico remoto.

## 2026-08-06-043 — Retomada do deploy bloqueada no editor SQL

### Tarefa relacionada

- Continuação da publicação registrada em `2026-08-06-042`.

### Objetivo

- Aplicar a migration de fidelidade no Supabase antes de publicar o runtime no
  Render.

### Resumo do que foi feito

- A sessão autenticada do Supabase voltou a funcionar no navegador integrado.
- Foram confirmados a organização, o projeto de produção e o estado saudável do
  banco.
- A migration local foi carregada e conferida, mas o editor SQL do painel não
  aceitou digitação nem colagem pelo controlador do navegador.
- O botão de execução não chegou a executar SQL; a área de resultados permaneceu
  no estado inicial, solicitando a execução da consulta.
- O deploy no Render não foi iniciado para preservar a ordem segura banco antes
  de aplicação.

### Arquivos criados, alterados ou removidos

- Alterado somente `docs/HISTORICO_DE_ALTERACOES.md` para registrar esta tentativa.
- Nenhum arquivo funcional foi criado, alterado ou removido.

### Banco, hospedagem e serviços externos

- Supabase: acesso e saúde confirmados; nenhuma migration ou consulta foi
  executada nesta etapa.
- Render: nenhum deploy iniciado.
- GitHub, Make e provedores de mensagens: nenhuma alteração.

### Verificações e resultados

- Projeto Supabase `ansrnnydksrjwefnntaw` confirmado como `Healthy`.
- Última migration exibida pelo painel ainda era `portal_cliente_experiencia`.
- Editor SQL permaneceu com a mensagem `Click Run to execute your query`, sem
  resultado de sucesso ou erro de execução.

### Riscos, limitações e pendências

- Permanece obrigatório aplicar e validar
  `20260806150000_referral_loyalty_ledger.sql` antes do deploy no Render.
- A aplicação depende de entrada manual no editor SQL ou de outro meio
  autenticado para aplicar a migration.

### Como desfazer

- Esta etapa não modificou código funcional, banco, hospedagem ou serviços
  externos; não há reversão operacional a realizar.
- Para desfazer apenas este registro, criar uma nova entrada corretiva; não
  apagar nem reescrever o histórico.

## 2026-08-06-044 — Migration da fidelidade aplicada; deploy aguarda login no Render

### Tarefa relacionada

- Continuação operacional das etapas `2026-08-06-042` e `2026-08-06-043`.

### Objetivo

- Aplicar e validar a migration de fidelidade no banco de produção antes de
  publicar o runtime correspondente no Render.

### Resumo do que foi feito

- O conteúdo integral da migration foi conferido no editor SQL do Supabase,
  incluindo `begin;`, 152 linhas úteis e `commit;` final.
- A execução foi confirmada no aviso de operação destrutiva do painel e concluiu
  com `Success. No rows returned`.
- O ledger da migration passou a constar como a entrada mais recente do histórico
  de migrations do Supabase.
- A nova tabela `loyalty_card_entries` foi confirmada no catálogo com nove
  colunas e zero registros; o backfill não encontrou indicação antiga elegível.
- O painel do Render foi aberto para iniciar o deploy, mas a sessão não estava
  autenticada. Nenhuma publicação foi iniciada.

### Arquivos criados, alterados ou removidos

- Alterado somente `docs/HISTORICO_DE_ALTERACOES.md` nesta etapa documental.
- Nenhum arquivo funcional foi criado, alterado ou removido.

### Banco, hospedagem e serviços externos

- Supabase de produção: migration `20260806150000_referral_loyalty_ledger.sql`
  aplicada e registrada como `20260806150000` / `referral_loyalty_ledger`.
- Render: nenhuma alteração; deploy aguardando autenticação do usuário.
- GitHub, Make e provedores de mensagens: nenhuma alteração nesta etapa.

### Verificações e resultados

- Editor SQL: `Success. No rows returned`.
- Ledger de migrations: `20260806150000 referral_loyalty_ledger` confirmado como
  registro mais recente.
- Catálogo do banco: tabela `public.loyalty_card_entries` confirmada com nove
  colunas, zero linhas e RLS habilitada no schema, embora a tela de listagem do
  painel represente a exposição pela Data API como `Disabled`.
- Render: tela de login exibida; serviço e deploy ainda não inspecionados nesta
  etapa.

### Riscos, limitações e pendências

- O runtime novo ainda não está publicado; até o deploy, o banco contém objetos
  compatíveis adicionais que não são usados pela versão ativa da aplicação.
- É necessário autenticar no Render, publicar a branch
  `portal-cliente-layout` e confirmar commit ativo, health check e telas.
- Não houve indicação histórica elegível para validar visualmente o backfill com
  saldo positivo.

### Como desfazer

- Enquanto o runtime novo não for publicado, manter a migration aditiva é a
  opção de menor risco.
- Se a reversão do banco se tornar indispensável, criar migration corretiva para
  desabilitar `trg_award_referral_loyalty_mark` e revogar a RPC; preservar a
  tabela e eventuais movimentações para auditoria.
- Não apagar o registro do ledger de migrations nem reescrever o histórico.

## 2026-08-06-045 — Fidelidade publicada no Render

### Tarefa relacionada

- Conclusão do deploy iniciado após a migration registrada em `2026-08-06-044`.

### Objetivo

- Publicar a implementação da fidelidade integrada às indicações somente após a
  preparação bem-sucedida do banco de produção.

### Resumo do que foi feito

- O serviço `senhora-limpeza-piloto` foi confirmado na branch
  `portal-cliente-layout`.
- Foi iniciado pelo painel um deploy manual do commit mais recente da branch,
  `9950d47`, que contém o commit funcional `17fa2d0`.
- O build concluiu com sucesso e o Render marcou o deploy
  `dep-d9qh40pt0dsc73823ob0` como `live`.
- A tentativa posterior de abrir a aplicação pública para health check e inspeção
  visual foi impedida pela política de navegação da sessão; não foi utilizado
  meio alternativo para contornar o bloqueio.

### Arquivos criados, alterados ou removidos

- Alterado somente `docs/HISTORICO_DE_ALTERACOES.md` nesta etapa documental.
- Nenhum arquivo funcional foi criado, alterado ou removido.

### Banco, hospedagem e serviços externos

- Render: deploy manual do commit `9950d47b413546df28916f969f87e9f57348074a`
  concluído como `live` no serviço de produção.
- Supabase: nenhuma alteração adicional após a migration confirmada em
  `2026-08-06-044`.
- GitHub, Make e provedores de mensagens: nenhuma alteração nesta etapa.

### Verificações e resultados

- Render: `Build successful` confirmado nos logs.
- Render: processo iniciou com `npm start` e `node dist/server.cjs`.
- Render: estado final do deploy confirmado como `live`.
- Health check público e inspeção visual autenticada: não executados porque a
  navegação para a URL pública foi bloqueada pela política da sessão.

### Riscos, limitações e pendências

- Falta confirmar externamente a resposta HTTP de `/health` e fazer a inspeção
  visual das telas de fidelidade e indicações na versão publicada.
- O serviço permanece no plano gratuito e pode sofrer cold start.
- A tabela de fidelidade iniciou sem registros de backfill; a primeira marcação
  real deverá ser acompanhada operacionalmente para confirmar o fluxo ponta a
  ponta com dados de produção.

### Como desfazer

- Render: executar rollback pelo painel para o deploy estável anterior do commit
  `068220c`, caso seja necessário retirar o runtime novo.
- Banco: manter o schema aditivo para auditoria. Se uma reversão funcional for
  indispensável, criar migration corretiva que desabilite o trigger e revogue a
  RPC, sem apagar a tabela nem suas movimentações.
- GitHub: realizar reversão por novo commit; não reescrever o histórico remoto.

---

## 2026-08-07-001 — Correção da validação de código de indicação no Portal do Cliente

**Etapa relacionada:** Correção da validação de código de indicação.

**Objetivo:** Corrigir a validação do código de indicação no Portal do Cliente para que códigos válidos existentes no banco de dados sejam reconhecidos corretamente, suportando maiúsculas, minúsculas e espaços acidentais.

### Trabalho realizado

- Analisada a validação do código de indicação no Portal do Cliente (`src/components/ClientPortal.tsx`, `src/portal/portalSupabase.ts`).
- Identificada a causa exata no banco de dados: a função SQL `portal_validate_referral_code` (e `portal_create_cliente`) utilizava a expressão regular `[^A-Z0-9-]` aplicada *antes* do `upper()`, o que removia todas as letras minúsculas (ex: `sl-abc123` virava `-123`), além de fazer busca sensível à caixa via `LIKE` em formato JSON.
- Criada nova migration `supabase/migrations/20260807213000_fix_referral_code_validation.sql` para atualizar com `CREATE OR REPLACE FUNCTION` as funções `portal_validate_referral_code` e `portal_create_cliente`:
  1. Alterada a regex para `[^a-zA-Z0-9-]`, preservando letras em minúsculas/maiúsculas antes da conversão para maiúsculas.
  2. Atualizada a consulta para comparar `upper(public.portal_customer_metadata(nome)->>'referralCode')` com o valor digitado normalizado em maiúsculas, tornando a validação case-insensitive.
  3. Mantidas todas as demais regras do cadastro/portal e a proteção contra autoindicação (`id is distinct from public.portal_current_cliente_id()`).
- Atualizado o manifesto do banco (`docs/database/db001-manifest.json`) e adicionados testes unitários em `tests/referral-loyalty.test.ts` e `tests/db001-baseline.test.ts`.

### Arquivos criados, alterados ou removidos

- Criado: `supabase/migrations/20260807213000_fix_referral_code_validation.sql`
- Alterados: `docs/database/db001-manifest.json`, `tests/db001-baseline.test.ts`, `tests/referral-loyalty.test.ts`, `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e serviços externos

- Supabase: criada nova migration `20260807213000_fix_referral_code_validation.sql` com `CREATE OR REPLACE FUNCTION` para atualização do banco existente. Nenhuma migration antiga foi alterada.

### Verificações e resultados

- `npx tsx --test tests/db001-baseline.test.ts tests/referral-loyalty.test.ts`: 16 testes aprovados sem falhas.

### Como desfazer

- Remover o arquivo `supabase/migrations/20260807213000_fix_referral_code_validation.sql` e restaurar o manifesto e arquivos de teste para a versão anterior.

---

## 2026-08-15-001 - Correcao minima da RPC `portal_create_cliente`

**Etapa relacionada:** Correcao do erro Supabase `42703` no cadastro do cliente pelo Portal do Cliente.

**Objetivo:** Corrigir a funcao `public.portal_create_cliente` para parar de consultar a coluna inexistente `cliente_id` em `public.clientes`.

### Trabalho realizado

- Criada nova migration com `CREATE OR REPLACE FUNCTION public.portal_create_cliente(...)`.
- Mantida a funcao semanticamente igual a versao anterior, alterando somente as duas consultas de cliente existente:
  - `select cliente_id from public.clientes` para `select id from public.clientes` no caminho de identidade por e-mail.
  - `select cliente_id from public.clientes` para `select id from public.clientes` no caminho de identidade por telefone.
- Nenhuma migration antiga foi reescrita.
- Nenhum deploy foi executado.

### Arquivos criados, alterados ou removidos

- Criado: `supabase/migrations/20260815120000_fix_portal_create_cliente_customer_lookup.sql`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Supabase: nenhuma alteracao remota aplicada nesta etapa; a migration foi criada apenas localmente.
- Hospedagem e servicos externos: nenhuma alteracao.

### Verificacoes e resultados

- `rg -n "select\s+cliente_id|from public\.clientes|select\s+id" supabase\migrations\20260815120000_fix_portal_create_cliente_customer_lookup.sql` confirmou que a nova migration consulta `public.clientes` usando `select id`.

### Riscos, limitacoes e pendencias

- A migration ainda precisa ser aplicada no Supabase de producao para corrigir a RPC ativa.
- Nao foram executados testes de integracao contra o Supabase remoto nesta etapa.

### Como desfazer

- Antes de aplicar no banco: remover o arquivo `supabase/migrations/20260815120000_fix_portal_create_cliente_customer_lookup.sql`.
- Depois de aplicar no banco: criar nova migration com `CREATE OR REPLACE FUNCTION` restaurando a versao anterior da RPC, se uma reversao for indispensavel.

---

## 2026-08-15-002 - Atualizacao automatica do portal administrativo

**Etapa relacionada:** Atualizacao automatica dos dados do portal administrativo sem F5.

**Objetivo:** Fazer o painel administrativo recarregar os dados do Supabase a cada 60 segundos, sem alterar banco de dados, migrations ou regras de negocio.

### Trabalho realizado

- Alterado somente o frontend em `src/App.tsx`.
- A sincronizacao administrativa que ja ocorria apos validacao do usuario autenticado passou a executar tambem em intervalo de 60 segundos.
- Adicionada trava em memoria com `useRef` para evitar chamadas sobrepostas caso uma sincronizacao demore mais que o intervalo.
- O intervalo roda apenas para usuario administrativo autenticado, fora da rota do Portal do Cliente, e somente quando `useRealSupabase` esta ativo.
- Nenhuma regra de negocio, schema, migration ou servico externo foi alterado.

### Arquivos criados, alterados ou removidos

- Alterado: `src/App.tsx`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma alteracao.
- Hospedagem, Supabase remoto e demais servicos externos: nenhuma alteracao ou deploy executado.

### Verificacoes e resultados

- `git diff -- src\App.tsx`: confirmou alteracao limitada ao hook de sincronizacao administrativa.
- `npm run lint`: nao concluiu por erros de sintaxe ja presentes em `src/db/localDb.ts` na regiao da linha 1669, fora do escopo desta alteracao.

### Riscos, limitacoes e pendencias

- A atualizacao automatica depende da mesma funcao existente `dbInstance.syncWithSupabase()`.
- O typecheck completo permanece bloqueado ate corrigir os erros preexistentes em `src/db/localDb.ts`.

### Como desfazer

- Reverter em `src/App.tsx` a importacao de `useRef`, a constante `adminAutoRefreshInFlightRef` e restaurar o `useEffect` de sincronizacao administrativa para uma chamada unica a `dbInstance.syncWithSupabase()`.

---

## 2026-08-15-003 - Correcao de sintaxe em `localDb.ts` e ajuste do teste do portal

**Etapa relacionada:** Correção da falha da suíte `portal001-auth-isolation` após a atualização automática do painel administrativo.

**Objetivo:** Corrigir apenas o erro de sintaxe que impedia a compilação dos testes e alinhar o teste estático do portal ao comportamento atual do painel administrativo.

### Trabalho realizado

- Restaurado o fechamento estrutural do bloco assíncrono em `src/db/localDb.ts`, incluindo o registro de falha de enfileiramento, o método `addLog` e o início de `validateReferralCode`.
- Atualizado somente o teste `tests/portal001-auth-isolation.test.ts` para refletir a guarda atual da sincronização administrativa:
  `!user || isClientPortal || !config.useRealSupabase`.
- Nenhuma regra de negócio, banco de dados, migration ou funcionalidade não relacionada foi alterada.

### Arquivos criados, alterados ou removidos

- Alterado: `src/db/localDb.ts`.
- Alterado: `tests/portal001-auth-isolation.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma alteração.
- Hospedagem, Supabase remoto e demais serviços externos: nenhuma alteração ou deploy executado.

### Verificacoes e resultados

- `npx tsx --test tests\portal001-auth-isolation.test.ts`: 13 testes aprovados.
- Suíte de testes do projeto via scripts `test:*`: parou em `test:db001` após `test:sec002`, `test:sec003`, `test:sec004` e `test:sec005` aprovarem.
- Falhas em `test:db001`: migrations locais novas `20260815120000_fix_portal_create_cliente_customer_lookup.sql` e `20260815123000_fix_referral_loyalty_completed_status.sql` aparecem no diretório oficial, mas ainda não estão refletidas nas expectativas DB-001.

### Riscos, limitacoes e pendencias

- A suíte completa permanece bloqueada por divergência DB-001 não relacionada à correção de sintaxe nem ao teste do portal.
- Não foi feita classificação/manifesto das migrations novas nesta etapa para não alterar escopo.

### Como desfazer

- Reverter a restauração estrutural em `src/db/localDb.ts` apenas se uma versão correta equivalente já tiver sido aplicada por outro commit.
- Reverter as três expectativas atualizadas em `tests/portal001-auth-isolation.test.ts` caso a sincronização administrativa volte ao comportamento antigo.

---

## 2026-08-15-004 - Atualizacao do baseline DB-001 para migrations corretivas

**Etapa relacionada:** Correcao da falha da suite `test:db001` apos criacao de migrations corretivas locais.

**Objetivo:** Refletir no baseline DB-001 as migrations oficiais presentes no diretorio `supabase/migrations`.

### Trabalho realizado

- Confirmado que as migrations `20260815120000_fix_portal_create_cliente_customer_lookup.sql` e `20260815123000_fix_referral_loyalty_completed_status.sql` existem no diretorio oficial de migrations do projeto.
- Atualizada a lista esperada em `tests/db001-baseline.test.ts`.
- Atualizado `docs/database/db001-manifest.json` para classificar as duas migrations como oficiais, com proposito, risco e recomendacao.
- Nenhuma regra de negocio, banco de dados, migration SQL ou funcionalidade nao relacionada foi alterada.

### Arquivos criados, alterados ou removidos

- Alterado: `tests/db001-baseline.test.ts`.
- Alterado: `docs/database/db001-manifest.json`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma alteracao.
- Hospedagem, Supabase remoto e demais servicos externos: nenhuma alteracao ou deploy executado.

### Verificacoes e resultados

- `npm run test:db001`: 11 testes aprovados.
- Suite `test:*` do projeto executada em sequencia: `test:sec002`, `test:sec003`, `test:sec004`, `test:sec005`, `test:db001`, `test:automations`, `test:stabilization`, `test:pilot`, `test:portal001`, `test:referral-loyalty` e `test:go-live001` aprovados.

### Riscos, limitacoes e pendencias

- As migrations foram refletidas no baseline local; a aplicacao remota dessas migrations continua dependendo de execucao controlada no Supabase quando solicitada.
- Esta etapa nao valida o estado remoto do ledger de migrations.

### Como desfazer

- Remover as duas migrations das listas em `docs/database/db001-manifest.json` e `tests/db001-baseline.test.ts` somente se os arquivos SQL forem retirados do diretorio oficial por decisao explicita.

---

## 2026-08-15-005 - Correcao da auditoria de dependencias do Render

**Etapa relacionada:** Falha de deploy no Render apos `bun audit --audit-level=high` detectar vulnerabilidade alta em `nanoid` abaixo de 3.3.18.

**Objetivo:** Preservar a auditoria de dependencias no build e corrigir minimamente a versao transitiva vulneravel.

### Trabalho realizado

- Adicionado override de dependencias em `package.json` para forcar `nanoid` em `3.3.18`.
- Regenerado `bun.lock` para resolver a dependencia transitiva usada por `postcss` como `nanoid@3.3.18`.
- Mantido o comando `bun audit --audit-level=high` no fluxo de seguranca, sem relaxar a verificacao.
- Nenhuma regra de negocio, banco de dados, migration ou funcionalidade de aplicacao foi alterada.

### Arquivos criados, alterados ou removidos

- Alterado: `package.json`.
- Alterado: `bun.lock`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma alteracao.
- Hospedagem e Render: nenhum deploy executado nesta etapa; alteracao apenas versionada no repositorio.
- Servicos externos: `bun audit` consultou o registro de vulnerabilidades, sem alterar servicos externos.

### Verificacoes e resultados

- `bun pm why nanoid`: confirmou `nanoid@3.3.18` como dependencia transitiva de `postcss`.
- `bun audit --audit-level=high`: aprovado sem vulnerabilidades altas reportadas.
- Suite `test:*` do projeto executada em sequencia: `test:sec002`, `test:sec003`, `test:sec004`, `test:sec005`, `test:db001`, `test:automations`, `test:stabilization`, `test:pilot`, `test:portal001`, `test:referral-loyalty` e `test:go-live001` aprovados.

### Riscos, limitacoes e pendencias

- A correcao depende do Render respeitar `bun install --frozen-lockfile` com o `bun.lock` atualizado.
- Nao foi executado deploy remoto nesta etapa.

### Como desfazer

- Remover o bloco `overrides` de `package.json` e regenerar `bun.lock` somente se uma atualizacao de `postcss` ou `vite` resolver `nanoid` para versao segura sem override.

---

## 2026-08-15-006 - Reorganizacao responsiva do Portal do Cliente

**Etapa relacionada:** Melhoria da experiencia do Portal do Cliente em celular, tablet e desktop.

**Objetivo:** Tornar o codigo de indicacao sempre visivel na tela inicial e reduzir a rolagem da etapa de agendamento sem mudar regras de negocio ou fluxo.

### Trabalho realizado

- Movido o codigo de indicacao para a saudacao da tela inicial do Portal do Cliente.
- Adicionada copia automatica ao tocar no codigo, com confirmacao discreta de sucesso.
- Removido o card de codigo de indicacao da area de agendamento e removida a acao de compartilhamento.
- Reposicionado o painel de resumo da selecao para o topo da etapa de escolha de servicos, mantendo os mesmos dados de servicos selecionados, tempo total, valor estimado e navegacao.
- Mantidas as regras atuais de selecao, calculo de preco, validacao e fluxo de agendamento.

### Arquivos criados, alterados ou removidos

- Alterado: `src/components/ClientPortal.tsx`.
- Alterado: `src/components/ClientPortalHome.tsx`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma alteracao.
- Hospedagem, Supabase remoto e demais servicos externos: nenhuma alteracao ou deploy executado.

### Verificacoes e resultados

- `npm run test:portal001`: 13 testes aprovados.
- `npm run lint`: aprovado sem erros de TypeScript.

### Riscos, limitacoes e pendencias

- A copia do codigo depende da API de clipboard disponivel no navegador do cliente.
- Nao foi feita validacao visual em navegador real nesta etapa.

### Como desfazer

- Reverter as alteracoes em `src/components/ClientPortal.tsx` e `src/components/ClientPortalHome.tsx` para restaurar o card antigo de indicacao e a posicao anterior do resumo.

---

## 2026-08-15-007 - Padronizacao da selecao de data e horario do Portal

**Etapa relacionada:** Reorganizacao da etapa de agendamento do Portal do Cliente com base na tela Consultar agenda.

**Objetivo:** Usar o mesmo padrao visual de calendario e horarios disponiveis nas telas de consulta e agendamento, preservando regras de negocio.

### Trabalho realizado

- Criado painel reutilizavel `PortalAvailabilityPanel` para escolha de data e exibicao de horarios.
- Atualizada a tela Consultar agenda para usar o painel compartilhado.
- Atualizada a etapa de data e horario do agendamento para usar o mesmo painel visual, mantendo `selectedDate`, `selectedTime`, `timeSlots` e `takenSlots` existentes.
- Mantido o campo de observacao logo abaixo da selecao de horario e antes do botao de revisao.
- Ajustadas as grades e controles com quebras responsivas para evitar overflow horizontal em celular, tablet e desktop.
- Nenhuma regra de negocio, calculo, validacao de disponibilidade ou fluxo de confirmacao foi alterado.

### Arquivos criados, alterados ou removidos

- Alterado: `src/components/ClientPortal.tsx`.
- Alterado: `src/components/ClientPortalHome.tsx`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma alteracao.
- Hospedagem, Supabase remoto e demais servicos externos: nenhuma alteracao ou deploy executado.

### Verificacoes e resultados

- `npm run lint`: aprovado sem erros de TypeScript.
- `npm run test:portal001`: 13 testes aprovados.

### Riscos, limitacoes e pendencias

- Nao foi feita validacao visual em navegador real nesta etapa.
- Datas fora do intervalo ativo continuam sem horario selecionavel, preservando a restricao operacional existente.

### Como desfazer

- Reverter as alteracoes em `src/components/ClientPortal.tsx` e `src/components/ClientPortalHome.tsx` para restaurar a selecao horizontal anterior da etapa de agendamento e a implementacao local antiga da consulta de agenda.

---

## 2026-08-16-001 - Provisionamento de acesso do cliente cadastrado pelo administrativo

**Etapa relacionada:** Cadastro administrativo de clientes com acesso inicial ao Portal do Cliente.

**Objetivo:** Criar automaticamente usuario no Supabase Auth para clientes cadastrados pelo sistema administrativo, exigir troca da senha temporaria no primeiro acesso e liberar o portal somente apos a redefinicao segura.

### Trabalho realizado

- Criada a Edge Function `admin-create-client-user` para uso administrativo autenticado, com validacao de perfil ativo e permissao de criacao em `clientes`.
- O cadastro administrativo de cliente passou a chamar a funcao apos salvar o cliente e o codigo de indicacao, usando a senha temporaria padrao `123456`.
- A funcao cria ou atualiza o usuario do Supabase Auth com e-mail confirmado, grava `app_metadata.force_password_change` e vincula o usuario ao cliente em `portal_client_identities`.
- Criada a Edge Function autenticada `portal-clear-password-change` para limpar a marcacao administrativa apos a troca de senha bem-sucedida.
- O Portal do Cliente passou a verificar imediatamente a metadata `force_password_change` ao restaurar sessao ou ao fazer login.
- Quando a flag esta ativa, o portal nao carrega dados, nao executa claim do cliente e exibe somente a tela de definicao de nova senha.
- A redefinicao reaproveita a validacao existente de senha forte do portal, atualiza a senha via Supabase Auth e limpa a flag `force_password_change` via Edge Function antes de liberar o acesso normal.
- Nao foi implementada opcao de alterar senha no portal, nem fluxo de esqueci minha senha novo, nem alteracao no cadastro existente feito pelo proprio Portal do Cliente.

### Arquivos criados, alterados ou removidos

- Criado: `supabase/functions/admin-create-client-user/index.ts`.
- Criado: `supabase/functions/portal-clear-password-change/index.ts`.
- Alterado: `src/db/localDb.ts`.
- Alterado: `src/portal/PortalAuthGate.tsx`.
- Alterado: `src/portal/auth/emailPasswordAuthProvider.ts`.
- Alterado: `src/portal/auth/portalAuthProvider.ts`.
- Alterado: `tests/portal001-auth-isolation.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma migration criada ou aplicada.
- Supabase Auth: nenhuma alteracao remota executada nesta etapa; foi criado apenas o codigo da Edge Function local.
- Hospedagem, deploy e servicos externos: nenhuma alteracao executada.

### Verificacoes e resultados

- `npm run test:portal001`: 14 testes aprovados.
- `npm run lint`: aprovado sem erros de TypeScript.
- `npm run build`: aprovado, incluindo validacoes `security:artifact` e `pilot:artifact`.
- `npm run test:sec002`: 8 testes aprovados.
- `npm run test:sec003`: 9 testes aprovados.
- `npm run test:sec004`: 11 testes aprovados.
- `npm run test:sec005`: 16 testes aprovados.
- `npm run test:go-live001`: 9 testes aprovados.

### Riscos, limitacoes e pendencias

- A Edge Function precisa ser publicada no Supabase antes de o fluxo funcionar no ambiente remoto.
- Se a criacao do usuario Auth falhar depois de o cliente ser salvo, o cadastro do cliente permanece no banco e a interface retorna erro para o operador provisionar novamente apos a correcao.
- A senha temporaria `123456` e aceita apenas para o primeiro login; a nova senha continua seguindo a politica forte do portal.

### Como desfazer

- Remover a chamada a `admin-create-client-user` em `src/db/localDb.ts`.
- Reverter as alteracoes de flag em `src/portal/PortalAuthGate.tsx`, `src/portal/auth/emailPasswordAuthProvider.ts` e `src/portal/auth/portalAuthProvider.ts`.
- Remover `supabase/functions/admin-create-client-user/index.ts` e o teste adicionado em `tests/portal001-auth-isolation.test.ts`.
- Se a funcao ja tiver sido publicada, despublicar/remover a Edge Function pelo processo operacional do Supabase, sem apagar usuarios Auth existentes sem auditoria previa.

---

## 2026-08-16-002 - Correcao final de atomicidade e guarda backend da troca obrigatoria

**Etapa relacionada:** Revisao final do cadastro administrativo de clientes com acesso ao Portal.

**Objetivo:** Corrigir riscos finais do fluxo: cadastro parcial quando o Auth falha, mensagem incorreta para e-mail ja existente, bloqueio apenas frontend de `force_password_change` e sessao/JWT stale apos troca de senha.

### Trabalho realizado

- O cadastro administrativo agora valida e-mail antes de inserir cliente quando `useRealSupabase` esta ativo.
- Se a Edge Function de provisionamento do Auth falhar apos a criacao do cliente novo, o cliente recem-criado e removido por rollback pontual antes de retornar erro.
- O erro retornado pela Edge Function passa a ser preservado pelo fluxo e exibido pelo modulo de clientes.
- A Edge Function `admin-create-client-user` retorna mensagem especifica quando o Supabase Auth recusa criacao por e-mail ja cadastrado: `Ja existe um acesso ao Portal do Cliente cadastrado para este e-mail.`
- A Edge Function `portal-clear-password-change` passou a aceitar somente sessoes ainda marcadas com `app_metadata.force_password_change = true`.
- Criada a migration `20260816143000_portal_force_password_change_backend_guard.sql` com funcoes centrais `portal_password_change_required` e `portal_password_change_allowed`.
- A migration reforca RLS e RPCs do Portal para bloquear usuario marcado em leituras de cliente, vinculo, veiculos, agendamentos, catalogos autenticados, configuracoes autenticadas e RPCs normais do Portal.
- A troca de senha agora chama `auth.refreshSession()` apos limpar a flag e o gate usa a sessao atual do cliente Supabase antes de carregar dados normais.
- Atualizados testes e manifesto DB-001 para cobrir a migration, Edge Functions, mensagens, rollback, guarda backend e renovacao do JWT.

### Arquivos criados, alterados ou removidos

- Criado: `supabase/migrations/20260816143000_portal_force_password_change_backend_guard.sql`.
- Alterado: `src/db/localDb.ts`.
- Alterado: `src/components/ClientesModule.tsx`.
- Alterado: `src/portal/PortalAuthGate.tsx`.
- Alterado: `src/portal/auth/emailPasswordAuthProvider.ts`.
- Alterado: `supabase/functions/admin-create-client-user/index.ts`.
- Alterado: `supabase/functions/portal-clear-password-change/index.ts`.
- Alterado: `tests/portal001-auth-isolation.test.ts`.
- Alterado: `tests/db001-baseline.test.ts`.
- Alterado: `docs/database/db001-manifest.json`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma migration aplicada remotamente nesta etapa; a migration foi criada apenas localmente.
- Supabase Auth e Edge Functions: nenhuma alteracao remota executada.
- Hospedagem, deploy e demais servicos externos: nenhuma alteracao executada.

### Verificacoes e resultados

- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.
- `npm run test:portal001`: 15 testes aprovados.
- `npm run test:db001`: 11 testes aprovados.
- `npm run test:sec002`: 8 testes aprovados.
- `npm run test:sec003`: 9 testes aprovados.
- `npm run test:sec004`: 11 testes aprovados.
- `npm run test:sec005`: 16 testes aprovados.
- `npm run test:go-live001`: 9 testes aprovados.

### Riscos, limitacoes e pendencias

- A migration e as Edge Functions precisam ser publicadas/aplicadas juntas para que o reforco backend funcione em ambiente remoto.
- O rollback de cadastro parcial cobre o cliente novo criado por este fluxo; se a exclusao de rollback falhar por erro remoto, o sistema retorna erro explicito informando que nao conseguiu desfazer automaticamente.
- Nao foi executado teste de integracao contra Supabase remoto nesta etapa.

### Como desfazer

- Reverter a chamada de rollback e leitura de erro em `src/db/localDb.ts`.
- Reverter a preservacao de erro em `src/components/ClientesModule.tsx`.
- Remover `supabase/migrations/20260816143000_portal_force_password_change_backend_guard.sql` antes de aplicar no banco.
- Reverter a checagem restritiva em `portal-clear-password-change` e a mensagem especifica em `admin-create-client-user`.
- Reverter os testes e o manifesto DB-001 adicionados nesta etapa.

---

## 2026-08-16-003 - Alteracao de senha no Portal do Cliente

**Etapa relacionada:** Implementacao da opcao Alterar Senha para clientes ja autenticados no Portal.

**Objetivo:** Permitir que o cliente logado altere sua senha pelo Portal, usando as mesmas regras do primeiro acesso, e ajustar mensagens/redirecionamento do fluxo de nova senha.

### Trabalho realizado

- Adicionado contrato `changePassword` ao provedor de autenticacao do Portal.
- Implementada alteracao de senha com validacao forte, reautenticacao pela senha atual e atualizacao no Supabase Auth.
- Criada navegacao de perfil no Portal com botao `Alterar senha`.
- Criada tela dedicada de alteracao de senha com campos de senha atual, nova senha e confirmacao, sem modal.
- Apos alteracao bem-sucedida, o Portal exibe mensagem em portugues, encerra a sessao e retorna ao login.
- O gate de autenticacao passa a preservar aviso de sucesso apos logout e a traduzir erros tecnicos de rede/sessao para mensagens em portugues.
- Atualizados testes do Portal para cobrir a alteracao de senha autenticada, reautenticacao, logout e aviso pos-redirecionamento.

### Arquivos criados, alterados ou removidos

- Alterado: `src/portal/auth/portalAuthProvider.ts`.
- Alterado: `src/portal/auth/emailPasswordAuthProvider.ts`.
- Alterado: `src/portal/PortalAuthGate.tsx`.
- Alterado: `src/components/ClientPortal.tsx`.
- Alterado: `src/components/ClientPortalHome.tsx`.
- Alterado: `tests/portal001-auth-isolation.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma migration criada ou aplicada.
- Supabase Auth e Edge Functions: nenhuma alteracao remota executada.
- Hospedagem, deploy e demais servicos externos: nenhuma alteracao executada.

### Verificacoes e resultados

- `npm run test:portal001`: 16 testes aprovados.
- `npm run test:sec003`: 9 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- Nao foi executado teste manual contra Supabase remoto nesta etapa.
- Existem alteracoes locais antigas fora desta funcionalidade no working tree; elas nao foram modificadas por esta etapa.

### Como desfazer

- Remover `changePassword` do contrato e do provider em `src/portal/auth`.
- Remover `handlePortalPasswordChange` e a prop `onChangePassword` no Portal.
- Remover as secoes `profile` e `change-password` adicionadas em `ClientPortalHome`.
- Reverter o aviso `sl_portal_auth_notice` e as mensagens novas em `PortalAuthGate`.
- Remover o teste `portal permite alterar senha logado com reautenticacao e logout obrigatorio`.

---

## 2026-08-17-001 - Correcao de logout indevido apos login

**Etapa relacionada:** Correcao da validacao pos-login no sistema administrativo e no Portal do Cliente.

**Objetivo:** Impedir que falhas temporarias no carregamento do perfil ou dos dados do portal encerrem automaticamente uma sessao autenticada valida, preservando o bloqueio para usuarios administrativos inexistentes, divergentes ou inativos.

### Trabalho realizado

- Separada a falha definitiva de perfil administrativo invalido/inativo das falhas transitorias ao consultar `public.usuarios`.
- O fluxo administrativo passou a executar `signOut` somente quando o perfil autenticado e definitivamente invalido, divergente ou inativo.
- Em erro temporario de consulta do perfil administrativo, a sessao Supabase e preservada e a interface exibe uma tela de sessao autenticada com opcao de tentar novamente ou sair manualmente.
- O Portal do Cliente passou a aplicar a sessao antes de executar `claimExistingPortalCustomer` e `loadPortalData`.
- Em falha temporaria ao carregar dados do portal, a sessao do cliente e preservada e a interface exibe opcao de retentativa ou saida manual.
- O fluxo de troca obrigatoria de senha por `force_password_change` foi preservado sem alteracao de regra.
- Nao foi alterado o erro independente de `vehicle-models`/`PGRST205`.
- Adicionado teste de regressao cobrindo que falha temporaria de perfil/dados nao dispara logout automatico.

### Arquivos criados, alterados ou removidos

- Alterado: `src/App.tsx`.
- Alterado: `src/portal/PortalAuthGate.tsx`.
- Alterado: `tests/portal001-auth-isolation.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma migration criada ou aplicada.
- Supabase Auth, Edge Functions e servicos remotos: nenhuma alteracao remota executada.
- Hospedagem e deploy: nenhuma publicacao executada.

### Verificacoes e resultados

- `npm run test:portal001`: 17 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- Nao foi executado teste manual contra Supabase remoto nesta etapa.
- A tela de retentativa depende de nova tentativa do usuario quando a consulta de perfil/dados falha; nao foi adicionado retry automatico em loop.
- Existem alteracoes locais antigas fora desta tarefa no working tree; elas nao foram modificadas por esta etapa.

### Como desfazer

- Em `src/App.tsx`, remover `InvalidAdministrativeProfileError`, os estados de retentativa e a tela de sessao autenticada, restaurando o tratamento anterior de erro pos-login.
- Em `src/portal/PortalAuthGate.tsx`, remover `portalDataLoadError`, a aplicacao antecipada da sessao e a tela de retentativa do portal.
- Em `tests/portal001-auth-isolation.test.ts`, remover o teste `falha temporaria ao carregar perfil nao encerra sessao autenticada`.

---

## 2026-08-17-002 - Redefinicao de senha por token do Supabase

**Etapa relacionada:** Tela de redefinicao de senha do Portal do Cliente e orientacao de e-mail do Supabase Auth.

**Objetivo:** Permitir que o cliente redefina a senha pelo token enviado pelo Supabase, reaproveitando a validacao de senha existente, exibindo mensagens em portugues e retornando ao login apos sucesso; documentar separadamente a configuracao necessaria no painel do Supabase.

### Trabalho realizado

- Separado o fluxo de redefinicao por token de recuperacao do fluxo de troca obrigatoria por `force_password_change`.
- A tela do Portal identifica eventos `PASSWORD_RECOVERY` e URLs `?portal=true&recovery=true` como redefinicao por token.
- A redefinicao por token usa a mesma validacao existente de senha forte do Portal.
- Apos redefinir a senha por token, o Portal remove o parametro de recuperacao, encerra a sessao tecnica criada pelo Supabase e volta ao login com mensagem de sucesso em portugues.
- A troca obrigatoria de senha continua chamando a Edge Function `portal-clear-password-change` somente quando necessario, sem alterar a regra ja validada.
- Documentada a configuracao externa do Supabase Auth para remetente, Redirect URLs e template de e-mail de recuperacao em portugues com o nome `Senhora Limpeza Estetica Automotiva`.
- Nenhuma configuracao foi aplicada no painel do Supabase nesta etapa.

### Arquivos criados, alterados ou removidos

- Criado: `docs/SUPABASE_AUTH_EMAILS.md`.
- Alterado: `src/portal/PortalAuthGate.tsx`.
- Alterado: `src/portal/auth/portalAuthProvider.ts`.
- Alterado: `src/portal/auth/emailPasswordAuthProvider.ts`.
- Alterado: `tests/portal001-auth-isolation.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma migration criada ou aplicada.
- Supabase Auth: nenhuma configuracao remota aplicada; a personalizacao de e-mail exige configuracao manual no painel do Supabase.
- Edge Functions: nenhuma publicacao executada.
- Hospedagem e deploy: nenhuma publicacao executada.

### Verificacoes e resultados

- `npm run test:portal001`: 19 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- A personalizacao do e-mail so tera efeito apos configurar o painel do Supabase conforme `docs/SUPABASE_AUTH_EMAILS.md`.
- Nao foi executado teste real de recebimento de e-mail nem validacao contra Supabase remoto.
- Existem alteracoes locais antigas fora desta tarefa no working tree; elas nao foram modificadas por esta etapa.

### Como desfazer

- Reverter a opcao `clearForcePasswordChange` em `src/portal/auth/portalAuthProvider.ts` e `src/portal/auth/emailPasswordAuthProvider.ts`.
- Remover `passwordResetFromRecovery` e o redirecionamento para login em `src/portal/PortalAuthGate.tsx`.
- Remover `docs/SUPABASE_AUTH_EMAILS.md`.
- Remover os testes `redefinicao por token usa validacao existente e volta ao login` e `personalizacao de e-mail do Supabase Auth fica documentada como configuracao externa`.

---

## 2026-08-17-003 - Correcao do exchange do codigo de recuperacao do Portal

**Etapa relacionada:** Ajuste do fluxo de redefinicao de senha por link do Supabase.

**Objetivo:** Corrigir o caso em que o link de recuperacao do Supabase chega correto, mas a tela do Portal exibe link invalido por consultar a sessao antes de trocar o codigo de recuperacao.

### Trabalho realizado

- O Portal passou a detectar `?portal=true&recovery=true` e ler o `code` enviado pelo Supabase antes de chamar `auth.getSession`.
- Quando ha `code` de recuperacao, o Portal chama `auth.exchangeCodeForSession(code)` e usa a sessao retornada para abrir a tela de redefinicao.
- A mensagem de link invalido ou expirado passa a ser exibida somente quando `exchangeCodeForSession` retorna erro real.
- O cliente Supabase administrativo deixou de processar parametros de sessao na URL quando a rota atual e callback de recuperacao do Portal, evitando interferencia entre os clientes.
- Atualizados testes para garantir a ordem `exchangeCodeForSession` antes de `getSession` e a separacao do processamento de URL entre Portal e administrativo.

### Arquivos criados, alterados ou removidos

- Alterado: `src/portal/PortalAuthGate.tsx`.
- Alterado: `src/db/supabaseClient.ts`.
- Alterado: `tests/portal001-auth-isolation.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma migration criada ou aplicada.
- Supabase Auth: nenhuma configuracao remota aplicada.
- Edge Functions: nenhuma publicacao executada.
- Hospedagem e deploy: nenhuma publicacao executada.

### Verificacoes e resultados

- `npm run test:portal001`: 20 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- Nao foi executado teste real contra link de e-mail em ambiente remoto.
- O tratamento cobre `code` em query string e hash; tokens em formatos adicionais do Supabase deverao ser avaliados caso a configuracao remota use outro padrao.
- Existem alteracoes locais antigas fora desta tarefa no working tree; elas nao foram modificadas por esta etapa.

### Como desfazer

- Em `src/portal/PortalAuthGate.tsx`, remover `getRecoveryUrlState` e a chamada a `auth.exchangeCodeForSession(code)`.
- Em `src/db/supabaseClient.ts`, restaurar `detectSessionInUrl: isBrowser`.
- Em `tests/portal001-auth-isolation.test.ts`, remover o teste `portal troca codigo de recuperacao antes de restaurar sessao` e as expectativas de `isPortalRecoveryCallback`.

---

## 2026-08-17-004 - Layout da tela de sugestao de servicos do Portal

**Etapa relacionada:** Reproducao visual da tela de sugestao de servicos conforme referencia aprovada.

**Objetivo:** Atualizar somente a apresentacao da tela de sugestao de servicos do Portal, mantendo tempo e valor dinamicos vindos das tabelas existentes, sem alterar regras de negocio nem a atualizacao automatica do resumo.

### Trabalho realizado

- A tela de sugestao passou a exibir um card promocional unico com selo `Sugestões Exclusivas`, imagem visual de para-brisa sob chuva, divisao antes/depois, icone de protecao, headline e CTA amarelo.
- O servico sugerido principal continua vindo dinamicamente da lista de servicos com `portalVisibility = 'sugestao'` ou destaque, ordenado por `displayOrder`.
- O tempo e o valor exibidos no card usam `primarySuggestion.estimatedTime` e `primarySuggestion.basePrice`, ja ajustados pelo porte/tabelas existentes.
- O botao de aceite passou a exibir o texto `🛡️ Sim, quero essa proteção`.
- A selecao continua atualizando `selectedServiceIds`, preservando a atualizacao automatica de `totalTime` e `totalValue` no resumo inferior.
- A lista antiga de sugestoes foi mantida oculta para preservar referencia de estrutura sem alterar regras de negocio.

### Arquivos criados, alterados ou removidos

- Alterado: `src/components/ClientPortal.tsx`.
- Alterado: `tests/portal001-auth-isolation.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma migration criada ou aplicada.
- Supabase Auth e Edge Functions: nenhuma alteracao remota executada.
- Hospedagem e deploy: nenhuma publicacao executada.

### Verificacoes e resultados

- `npm run test:portal001`: 21 testes aprovados.
- `npm run test:stabilization`: 22 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- A arte do para-brisa foi reproduzida em CSS dentro do componente; nao foi criado asset externo.
- Se houver multiplas sugestoes, o card visual usa a primeira por `displayOrder`, mantendo o comportamento de resumo dinamico para o servico exibido.
- Existem alteracoes locais antigas fora desta tarefa no working tree; elas nao foram modificadas por esta etapa.

### Como desfazer

- Em `src/components/ClientPortal.tsx`, remover `suggestionServices`, `primarySuggestion`, `toggleSuggestedService` e o card promocional inserido na tela de sugestao.
- Restaurar a lista visivel de sugestoes, removendo `className="hidden"` da lista antiga e do cabecalho antigo.
- Remover o teste `tela de sugestao usa card visual e mantem resumo dinamico` de `tests/portal001-auth-isolation.test.ts`.

---

## 2026-08-17-005 - Estilo premium da tela de selecao de servicos do Portal

**Etapa relacionada:** Ajuste visual da tela de selecao de servicos anterior a tela de sugestoes.

**Objetivo:** Aplicar a mesma linguagem visual premium da tela de sugestoes exclusivas na selecao de servicos, usando dourado nos nomes dos servicos, icones e estado selecionado do card, sem alterar layout, regras de negocio, valores ou tempos dinamicos.

### Trabalho realizado

- A tela de selecao de servicos recebeu destaques em dourado no seletor de veiculo, no quadro de resumo, nos cards de servico, nos icones, nos nomes dos servicos, nos precos e no CTA de avancar.
- O estado selecionado do card passou a usar borda, fundo e sombra em dourado, mantendo o mesmo clique e a mesma fonte de dados.
- Foram preservados os calculos existentes de `totalTime` e `totalValue`, alem das chamadas a `formatDuration` e `formatBRL`.
- Foi adicionado teste de regressao para garantir o estilo dourado e a permanencia dos valores e tempos dinamicos.

### Arquivos criados, alterados ou removidos

- Alterado: `src/components/ClientPortal.tsx`.
- Alterado: `tests/portal001-auth-isolation.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma migration criada ou aplicada.
- Supabase Auth e Edge Functions: nenhuma alteracao remota executada.
- Hospedagem e deploy: nenhuma publicacao executada.

### Verificacoes e resultados

- `npm run test:portal001`: 22 testes aprovados.
- `npm run test:stabilization`: 22 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- Nao foi executada validacao visual manual em navegador; a verificacao foi feita por testes automatizados, lint e build.
- Existem alteracoes locais antigas fora desta tarefa no working tree; elas nao foram modificadas por esta etapa.

### Como desfazer

- Em `src/components/ClientPortal.tsx`, restaurar as classes visuais anteriores da tela de selecao de servicos.
- Remover o teste `tela de selecao de servicos usa destaque dourado sem alterar resumo dinamico` de `tests/portal001-auth-isolation.test.ts`.

---

## 2026-08-17-006 - Evolucao da regra do cartao fidelidade

**Etapa relacionada:** Regra completa de acumulacao por limpezas elegiveis, indicacoes e credito automatico.

**Objetivo:** Permitir duas formas independentes de marcacao no cartao fidelidade, preservando a regra atual de indicacao: marcacao por primeiro servico valido do indicado para quem indicou, e marcacao por servico proprio concluido apenas para limpezas elegiveis. Ao atingir 10 marcacoes, gerar credito automatico somente de Limpeza de manutencao e protecao, disponivel no Portal com valor zerado, reiniciando o ciclo.

### Trabalho realizado

- Criada migration local para adicionar a origem `own_service`, a baixa `reward_redeem`, a tabela `loyalty_reward_credits`, funcoes auxiliares de elegibilidade e o gatilho de emissao de credito ao completar 10 marcacoes.
- A regra de indicacao existente foi preservada: o indicado continua concedendo 1 marcacao para quem indicou somente na primeira conclusao valida, com idempotencia por indicado.
- Adicionada marcacao independente para agendamentos concluidos/finalizados/entregues do proprio cliente quando houver servico elegivel.
- Foram bloqueados para marcacao propria os servicos de polimento, higienizacao, motor, cristalizacao/vidros, plasticos, farois e vitrificacao.
- O Portal passou a carregar creditos disponiveis por RPC e zerar dinamicamente o valor apenas do servico vinculado ao credito de fidelidade.
- A RPC de criacao de agendamento passou a consumir um credito disponivel somente quando o servico selecionado corresponde ao credito permitido, registrando o agendamento com desconto equivalente e marcando o credito como usado.
- O espelho local da regra em `localDb` passou a conceder marcacao por servico proprio elegivel quando nao estiver usando Supabase real.

### Arquivos criados, alterados ou removidos

- Criado: `supabase/migrations/20260817173000_loyalty_service_rewards.sql`.
- Alterado: `src/types.ts`.
- Alterado: `src/portal/portalSupabase.ts`.
- Alterado: `src/components/ClientPortal.tsx`.
- Alterado: `src/db/localDb.ts`.
- Alterado: `tests/referral-loyalty.test.ts`.
- Alterado: `tests/db001-baseline.test.ts`.
- Alterado: `docs/database/db001-manifest.json`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: migration criada apenas localmente; nenhuma migration remota aplicada.
- Supabase Auth e Edge Functions: nenhuma alteracao remota executada.
- Hospedagem e deploy: nenhuma publicacao executada.

### Verificacoes e resultados

- `npx tsx --test tests/referral-loyalty.test.ts tests/db001-baseline.test.ts`: 20 testes aprovados.
- `npm run test:portal001`: 22 testes aprovados.
- `npm run test:stabilization`: 22 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- A nova regra depende da aplicacao posterior da migration `20260817173000_loyalty_service_rewards.sql` no Supabase para funcionar em ambiente remoto.
- O credito automatico exige que exista servico ativo cujo nome corresponda a Limpeza de manutencao e protecao.
- Nao foi executado teste real contra banco remoto nem deploy.
- Existem alteracoes locais antigas fora desta tarefa no working tree; elas nao foram modificadas por esta etapa.

### Como desfazer

- Remover a migration `supabase/migrations/20260817173000_loyalty_service_rewards.sql` antes de aplica-la no banco.
- Reverter os ajustes de credito em `src/portal/portalSupabase.ts`, `src/components/ClientPortal.tsx`, `src/types.ts` e `src/db/localDb.ts`.
- Remover os testes adicionados em `tests/referral-loyalty.test.ts` e a inclusao da migration em `tests/db001-baseline.test.ts` e `docs/database/db001-manifest.json`.

---

## 2026-08-18-001 - Revisao segura da migration de fidelidade

**Etapa relacionada:** Auditoria da migration `20260817173000_loyalty_service_rewards.sql` antes de aplicacao em producao.

**Objetivo:** Confirmar se a migration de fidelidade poderia ser aplicada com seguranca sobre o estado atual esperado do banco de producao, sem remover regras existentes da RPC `portal_create_agendamento`, e gerar uma migration corretiva em caso de risco.

### Trabalho realizado

- Revisada a migration `20260817173000_loyalty_service_rewards.sql` com foco em RPCs, RLS, grants, triggers e compatibilidade com as migrations anteriores do Portal.
- Identificado risco operacional: a migration original reescreve a RPC critica `portal_create_agendamento` e nao explicita a guarda `PASSWORD_CHANGE_REQUIRED` dentro da propria funcao recompilada.
- Criada a migration corretiva `20260818120000_fix_loyalty_rewards_safe_portal_rpc.sql`, posterior e idempotente, para recompor o estado final seguro sem editar a migration ja versionada.
- A migration corretiva recompila `portal_available_loyalty_credits` e `portal_create_agendamento` com guarda explicita de troca obrigatoria de senha, grants finais e `notify pgrst, 'reload schema'`.
- Atualizado o manifesto DB-001 para registrar que `20260817173000` nao deve ser aplicada isoladamente em producao; a recomendacao passa a ser aplicar junto/depois da corretiva `20260818120000`.
- Atualizados testes para exigir a migration corretiva e suas garantias de seguranca.

### Arquivos criados, alterados ou removidos

- Criado: `supabase/migrations/20260818120000_fix_loyalty_rewards_safe_portal_rpc.sql`.
- Alterado: `docs/database/db001-manifest.json`.
- Alterado: `tests/db001-baseline.test.ts`.
- Alterado: `tests/referral-loyalty.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma migration remota aplicada; apenas criada migration local corretiva.
- Supabase Auth e Edge Functions: nenhuma alteracao remota executada.
- Hospedagem e deploy: nenhuma publicacao executada.

### Verificacoes e resultados

- `npx tsx --test tests/referral-loyalty.test.ts tests/db001-baseline.test.ts`: 21 testes aprovados.
- `npm run test:portal001`: 22 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- Nao houve verificacao direta no banco remoto, pois esta sessao nao possui credenciais ou conector Supabase ativo.
- A aplicacao em producao deve considerar a ordem: `20260817173000_loyalty_service_rewards.sql` seguida de `20260818120000_fix_loyalty_rewards_safe_portal_rpc.sql`, ou aplicar ambas no mesmo lote.
- Apos aplicar, confirmar no painel Supabase que a RPC `portal_available_loyalty_credits` existe e que o schema cache foi recarregado.
- Existem alteracoes locais antigas fora desta tarefa no working tree; elas nao foram modificadas por esta etapa.

### Como desfazer

- Antes de aplicar em banco remoto, remover `supabase/migrations/20260818120000_fix_loyalty_rewards_safe_portal_rpc.sql` e reverter as referencias a ela em `docs/database/db001-manifest.json`, `tests/db001-baseline.test.ts` e `tests/referral-loyalty.test.ts`.
- Se ja aplicada remotamente, criar migration de reversao especifica para remover a RPC/tabela de creditos ou restaurar a versao anterior de `portal_create_agendamento`; nao executar rollback manual destrutivo sem backup.

---

## 2026-08-18-002 - Preservacao completa do contrato de portal_create_agendamento

**Etapa relacionada:** Revisao adicional de idempotencia e preservacao integral das regras existentes antes de aplicar migrations de fidelidade em producao.

**Objetivo:** Confirmar se a sequencia `20260817173000` + `20260818120000` preservava 100% das regras existentes da RPC `portal_create_agendamento` e se era segura/idempotente para um banco de producao. Em caso de incompatibilidade, gerar migration corretiva adicional sem alterar migrations existentes e sem aplicar nada remotamente.

### Trabalho realizado

- Comparada a RPC historica `portal_create_agendamento` da migration `20260724213000` com a versao recompilada na corretiva `20260818120000`.
- Identificada incompatibilidade de preservacao total: a corretiva anterior mantinha validacoes, guarda de senha e credito fidelidade, mas nao restaurava explicitamente a logica legada de `referralDiscountAvailable`/`referralDiscountUsed` dentro da RPC.
- Criada a migration adicional `20260818130000_preserve_portal_create_agendamento_contract.sql`, posterior as duas anteriores, para recompor o contrato completo da RPC.
- A nova migration preserva validacoes existentes, guarda `PASSWORD_CHANGE_REQUIRED`, calculo por porte/tabela de precos, limite de servicos, disponibilidade do horario, metadados do agendamento, desconto legado por indicacao se ainda existir no banco, consumo de credito fidelidade e `notify pgrst, 'reload schema'`.
- A nova migration tambem reforca idempotencia de tabela/colunas/constraint de `loyalty_reward_credits` para cenarios de aplicacao parcial.
- Atualizados manifesto DB-001 e testes para exigir que `20260818130000` seja a ultima migration do lote de fidelidade.

### Arquivos criados, alterados ou removidos

- Criado: `supabase/migrations/20260818130000_preserve_portal_create_agendamento_contract.sql`.
- Alterado: `docs/database/db001-manifest.json`.
- Alterado: `tests/db001-baseline.test.ts`.
- Alterado: `tests/referral-loyalty.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma migration remota aplicada; apenas criada migration local corretiva adicional.
- Supabase Auth e Edge Functions: nenhuma alteracao remota executada.
- Hospedagem e deploy: nenhuma publicacao executada.

### Verificacoes e resultados

- `npx tsx --test tests/referral-loyalty.test.ts tests/db001-baseline.test.ts`: 22 testes aprovados.
- `npm run test:portal001`: 22 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- Nao houve verificacao direta contra banco remoto, pois esta sessao nao possui credenciais ou conector Supabase ativo.
- A sequencia recomendada para producao passa a ser `20260817173000`, `20260818120000` e `20260818130000`, nesta ordem, ou no mesmo lote.
- A validade final ainda deve ser confirmada em ambiente remoto/homologacao antes de producao, especialmente existencia do servico ativo de Limpeza de manutencao e protecao.

### Como desfazer

- Antes de aplicar em banco remoto, remover `supabase/migrations/20260818130000_preserve_portal_create_agendamento_contract.sql` e reverter as referencias a ela em `docs/database/db001-manifest.json`, `tests/db001-baseline.test.ts`, `tests/referral-loyalty.test.ts` e nesta entrada do historico por nova entrada corretiva.
- Se ja aplicada remotamente, criar migration de reversao especifica para restaurar a versao anterior de `portal_create_agendamento`; nao executar rollback manual destrutivo sem backup.

---

## 2026-08-18-003 - Auditoria do fluxo de marcacao por servico proprio elegivel

**Etapa relacionada:** Analise solicitada sem alteracao de codigo sobre ausencia de marcacao no cartao fidelidade quando servico elegivel e concluido.

**Objetivo:** Verificar trigger, funcao chamada, condicoes de elegibilidade, atualizacao de status do agendamento, gravacao da marca e diferencas entre desenvolvimento e producao para identificar onde o fluxo para.

### Trabalho realizado

- Revisadas as migrations de fidelidade `20260806150000`, `20260815123000`, `20260817173000`, `20260818120000` e `20260818130000`.
- Confirmado que a marcacao por servico proprio depende do trigger `trg_award_own_service_loyalty_mark`, criado em `20260817173000` e recriado em `20260818120000`.
- Confirmado que a funcao `award_own_service_loyalty_mark` so grava a marca se o status novo normalizado for `finalizado`, `entregue` ou `concluido`, se o status antigo ainda nao era final, e se algum servico em `observacoes[meta.serviceIds]` ou em `servico_id` passar em `loyalty_is_eligible_own_service`.
- Identificado que a migration final `20260818130000_preserve_portal_create_agendamento_contract.sql` preserva apenas o contrato de `portal_create_agendamento` e creditos, mas nao recria a funcao/trigger de marcacao propria; portanto ela so e suficiente quando `20260817173000` ou `20260818120000` ja foram aplicadas antes.
- Confirmada diferenca de desenvolvimento/producao: no modo local, `awardOwnServiceLoyaltyMark` em TypeScript cria a marca; com Supabase real, essa funcao retorna cedo e a responsabilidade passa integralmente ao trigger do banco.

### Arquivos criados, alterados ou removidos

- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.
- Nenhum codigo, migration, teste, banco, configuracao de ambiente ou comportamento funcional foi alterado.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma consulta remota e nenhuma migration aplicada.
- Supabase Auth, Edge Functions, hospedagem e deploy: nenhuma alteracao executada.

### Verificacoes e resultados

- Verificacao estatica por leitura e busca textual com `rg`, `Get-Content` e `Select-String`.
- Nao foram executados testes automatizados, pois a tarefa era auditoria sem alteracao de codigo.
- Resultado da auditoria: o ponto mais provavel de parada em producao e ausencia do trigger/funcoes de `20260817173000`/`20260818120000`, ou aplicacao incompleta do lote antes de `20260818130000`.

### Riscos, limitacoes e pendencias

- Nao houve acesso direto ao banco de producao; a conclusao depende da comparacao entre migrations locais e comportamento esperado.
- Ainda falta confirmar no Supabase remoto se existem `trg_award_own_service_loyalty_mark`, `award_own_service_loyalty_mark`, `loyalty_is_eligible_own_service`, o indice parcial de `own_service` e as constraints atualizadas de `loyalty_card_entries`.
- Tambem deve ser validado se os servicos cadastrados em producao possuem nomes/categorias/observacoes que passam na elegibilidade.

### Como desfazer

- Como nao houve alteracao funcional, basta adicionar nova entrada corretiva ao historico se esta auditoria for substituida por verificacao remota ou por decisao tecnica diferente.

---

## 2026-08-18-004 - Elegibilidade explicita do cartao fidelidade por servico

**Etapa relacionada:** Correcao da elegibilidade do cartao fidelidade para nao depender de nome ou descricao do servico.

**Objetivo:** Adicionar um campo administravel no cadastro de servicos para indicar se o servico conta para o cartao fidelidade e alterar a funcao de elegibilidade para consultar apenas esse campo.

### Trabalho realizado

- Criada migration `20260818143000_loyalty_service_explicit_flag.sql`.
- A migration adiciona `servicos_disponiveis.conta_cartao_fidelidade boolean not null default false`.
- Os servicos existentes sao inicializados pela regra anterior, chamando `public.loyalty_is_eligible_own_service(service.id)` antes da recompilacao da funcao.
- A funcao `public.loyalty_is_eligible_own_service(uuid)` passa a retornar somente `conta_cartao_fidelidade`, sem analisar nome, categoria ou observacao.
- O cadastro de servicos passou a exibir e salvar o campo "Conta para o cartão fidelidade".
- O mapeamento local de servicos passou a ler e gravar `conta_cartao_fidelidade`, e a simulacao local de marcacao propria passou a usar apenas esse booleano.
- Atualizados manifesto DB-001 e testes de contrato para incluir a nova migration e a nova regra de elegibilidade.

### Arquivos criados, alterados ou removidos

- Criado: `supabase/migrations/20260818143000_loyalty_service_explicit_flag.sql`.
- Alterado: `src/types.ts`.
- Alterado: `src/db/localDb.ts`.
- Alterado: `src/components/ServicosModule.tsx`.
- Alterado: `docs/database/db001-manifest.json`.
- Alterado: `tests/db001-baseline.test.ts`.
- Alterado: `tests/referral-loyalty.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma migration remota aplicada; apenas criada migration local.
- Supabase Auth, Edge Functions, hospedagem e deploy: nenhuma alteracao executada.

### Verificacoes e resultados

- `npx tsx --test tests/referral-loyalty.test.ts tests/db001-baseline.test.ts`: 22 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- A migration ainda precisa ser aplicada no banco remoto para a producao usar o campo novo.
- A inicializacao dos servicos existentes preserva a regra anterior no momento da aplicacao; ajustes manuais posteriores devem ser feitos no cadastro de servicos pelo novo campo.
- A funcao de recompensa `loyalty_reward_service_id` ainda usa nome do servico para localizar o premio de manutencao e protecao; isso nao foi alterado porque a tarefa pediu apenas a elegibilidade da marcacao.

### Como desfazer

- Antes de aplicar no banco remoto, remover `supabase/migrations/20260818143000_loyalty_service_explicit_flag.sql` e reverter as alteracoes nos arquivos listados nesta entrada.
- Se ja aplicada remotamente, criar uma migration de reversao especifica para restaurar a versao anterior de `loyalty_is_eligible_own_service` e, somente se seguro para o ambiente, remover ou ignorar a coluna `conta_cartao_fidelidade`.

---

## 2026-08-18-005 - Imagem de oferta e layout compacto no cadastro de servicos

**Etapa relacionada:** Melhorias visuais do cadastro de servicos, sugestoes exclusivas do portal e sinalizacao de fidelidade.

**Objetivo:** Reaproveitar o texto atual de oferta upsell nas sugestoes exclusivas, adicionar imagem de oferta via Supabase Storage, sinalizar servicos que contam para o cartao fidelidade e reduzir a altura do cadastro de servicos.

### Trabalho realizado

- Adicionado suporte ao metadado `offerImageUrl` em servicos, preservando o campo existente `offerText` para o texto da oferta upsell.
- O cadastro de servicos ganhou upload de imagem da oferta para o bucket `service-offers` do Supabase Storage, salvando a URL publica no metadado do servico.
- A tela de sugestoes exclusivas do Portal do Cliente passou a usar diretamente `offerText` como chamada principal e a exibir `offerImageUrl` quando existir.
- Os cards de servicos no modulo administrativo e no Portal do Cliente passaram a mostrar badge visual quando `countsForLoyaltyCard` estiver ativo.
- Os modais de cadastro/edicao de servico foram reorganizados com altura maxima, conteudo rolavel e rodape de acoes fixo para manter botoes acessiveis, especialmente no mobile.
- Atualizada a politica CSP de imagens para permitir URLs publicas de Supabase Storage.

### Arquivos criados, alterados ou removidos

- Alterado: `src/types.ts`.
- Alterado: `src/db/localDb.ts`.
- Alterado: `src/components/ServicosModule.tsx`.
- Alterado: `src/components/ClientPortal.tsx`.
- Alterado: `src/server/securityHeaders.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.
- Nenhuma migration foi criada nesta etapa.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma migration remota aplicada.
- Supabase Storage: nenhum bucket criado e nenhum arquivo enviado por esta sessao; o codigo passa a usar o bucket publico `service-offers` quando o usuario fizer upload pela interface.
- Hospedagem e deploy: nenhuma publicacao executada.

### Verificacoes e resultados

- `npx tsx --test tests/referral-loyalty.test.ts tests/db001-baseline.test.ts`: 22 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- O bucket `service-offers` precisa existir no Supabase Storage com politica compativel para upload por usuarios autorizados e leitura publica das imagens.
- Se o bucket ou a politica de Storage nao estiverem configurados, o upload exibira erro e nao alterara o servico.
- O build recriou a pasta local `dist/`; ela permanece artefato local de verificacao.

### Como desfazer

- Reverter as alteracoes nos arquivos listados nesta entrada.

---

## 2026-08-19-013 - Persistencia dos links sociais nas configuracoes

**Etapa relacionada:** Correcao dos campos Instagram e Google Maps na tela de Configuracoes.

**Objetivo:** Garantir que `instagram_url` e `google_maps_url` carreguem, sejam enviados ao salvar e permanecam visiveis apos atualizar a pagina.

### Trabalho realizado

- Confirmado que a query de carregamento ja selecionava `instagram_url` e `google_maps_url`.
- Confirmado que `saveConfigToSupabase` ja enviava `instagram_url` e `google_maps_url` para `public.configuracoes_empresa`.
- Identificada a causa: o formulario de Configuracoes copiava `config` para `formData` apenas no mount. Quando a configuracao remota chegava depois, os campos continuavam com o estado anterior e podiam aparentar nao ter sido salvos ou sobrescrever o remoto com vazio.
- Sincronizado `formData` sempre que `config` muda, preservando os valores carregados ao atualizar a pagina.
- Ajustado o submit para aguardar `onUpdateConfig` e o handler do App para aguardar `dbInstance.updateConfig`, evitando mostrar sucesso antes da persistencia remota terminar.
- Atualizado o teste Portal-001 para cobrir a leitura dos campos, o envio aguardado e a sincronizacao do formulario.

### Arquivos criados, alterados ou removidos

- Alterado: `src/components/ConfiguracoesModule.tsx`.
- Alterado: `src/App.tsx`.
- Alterado: `tests/portal001-auth-isolation.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma alteracao.
- Supabase Storage e policies: nenhuma alteracao.
- Migrations: nenhuma migration criada ou alterada.
- Hospedagem e deploy: nenhuma publicacao executada.

### Verificacoes e resultados

- `npm run test:portal001`: 24 testes aprovados.
- `npm run test:db001`: 11 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- Nao foi executado teste manual em navegador conectado ao Supabase; a validacao foi feita por contrato de codigo, testes automatizados, lint e build.

### Como desfazer

- Reverter as alteracoes nos arquivos listados nesta entrada.

---

## 2026-08-18-011 - Atalhos sociais e rota no Portal do Cliente

**Etapa relacionada:** Melhorias visuais e configuraveis na tela principal do Portal do Cliente.

**Objetivo:** Padronizar o espacamento dos cards finais da home, adicionar atalhos sutis para Instagram e rota da loja, e tornar editaveis os links/dados usados pelo portal.

### Trabalho realizado

- Ajustado o grid da home para que os cards "Perfil" e "Consultar agenda" sigam o mesmo padrao de tamanho e espacamento dos demais cards.
- Adicionados atalhos discretos abaixo da saudacao do portal para Instagram e "Como chegar".
- O atalho "Como chegar" usa o link configurado de navegacao quando existir; caso contrario, abre uma busca no Google Maps com o endereco da loja.
- A tela de configuracoes da empresa passou a editar Instagram, endereco da loja e link de navegacao para Google Maps ou Waze.
- O carregamento do Portal do Cliente passou a buscar esses campos nas configuracoes publicas.
- Criada migration local para adicionar `instagram_url` e `google_maps_url` em `configuracoes_empresa`.

### Arquivos criados, alterados ou removidos

- Criado: `supabase/migrations/20260818193000_portal_social_location_links.sql`.
- Alterado: `src/components/ClientPortalHome.tsx`.
- Alterado: `src/components/ConfiguracoesModule.tsx`.
- Alterado: `src/portal/portalSupabase.ts`.
- Alterado: `src/db/localDb.ts`.
- Alterado: `src/security/publicConfig.ts`.
- Alterado: `src/types.ts`.
- Alterado: `tests/portal001-auth-isolation.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma alteracao aplicada por esta sessao.
- Migrations: criada migration local, ainda nao aplicada remotamente por esta sessao.
- Supabase Storage e policies: nenhuma alteracao.
- Hospedagem e deploy: nenhuma publicacao executada.

### Verificacoes e resultados

- `npm run test:portal001`: 24 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- Os atalhos so aparecem quando houver Instagram, link de navegacao ou endereco configurado.
- O link de navegacao aceita URLs HTTPS e pode apontar para Google Maps ou Waze.

### Como desfazer

- Reverter os arquivos listados nesta entrada e nao aplicar a migration local.

---

## 2026-08-18-006 - Ajuste de teste para oferta upsell dinamica

**Etapa relacionada:** Correcao de falha de deploy causada por teste que ainda esperava texto fixo na tela de sugestoes exclusivas.

**Objetivo:** Atualizar apenas o contrato de teste para validar que a chamada da sugestao usa dinamicamente `primarySuggestion.offerText || primarySuggestion.name`.

### Trabalho realizado

- Ajustado `tests/portal001-auth-isolation.test.ts` para remover a expectativa dos textos fixos "Dirija com mais segurança" e "em dias de chuva".
- O teste agora valida o comportamento dinamico implementado para a oferta upsell.
- Nenhuma funcionalidade, banco, Storage, policy ou migration foi alterada.

### Arquivos criados, alterados ou removidos

- Alterado: `tests/portal001-auth-isolation.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma alteracao.
- Supabase Storage e policies: nenhuma alteracao.
- Hospedagem e deploy: nenhuma publicacao executada.

### Verificacoes e resultados

- `npm run test:portal001`: 22 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- Nenhuma pendencia funcional identificada; trata-se apenas de alinhamento de teste ao comportamento dinamico ja implementado.

### Como desfazer

- Reverter a alteracao em `tests/portal001-auth-isolation.test.ts` e esta entrada do historico caso o comportamento volte a exigir texto fixo.

---

## 2026-08-18-007 - Remocao de arte fixa sobre imagem de oferta

**Etapa relacionada:** Ajuste visual da tela de sugestoes exclusivas quando a oferta upsell possui imagem cadastrada.

**Objetivo:** Remover a arte fixa do card de sugestao sempre que houver `offerImageUrl`, preservando o fallback visual existente para servicos sem imagem.

### Trabalho realizado

- Ajustada a tela de sugestoes exclusivas do Portal do Cliente para renderizar os elementos decorativos fixos apenas quando nao existir imagem cadastrada na oferta.
- Quando `offerImageUrl` existe, a area visual passa a exibir somente a imagem cadastrada.
- Nenhuma outra logica do sistema foi alterada.

### Arquivos criados, alterados ou removidos

- Alterado: `src/components/ClientPortal.tsx`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma alteracao.
- Supabase Storage e policies: nenhuma alteracao.
- Migrations: nenhuma migration criada ou alterada.
- Hospedagem e deploy: nenhuma publicacao executada.

### Verificacoes e resultados

- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- Nao foram executados testes visuais em navegador; a validacao foi feita por revisao do diff e build.

### Como desfazer

- Reverter a alteracao em `src/components/ClientPortal.tsx` e esta entrada do historico.

---

## 2026-08-18-008 - Ajuste de encaixe da imagem de oferta

**Etapa relacionada:** Ajuste visual da tela de sugestoes exclusivas para imagens cadastradas em ofertas upsell.

**Objetivo:** Fazer a imagem cadastrada da oferta aparecer inteira, sem corte na parte inferior e sem distorcao.

### Trabalho realizado

- Ajustada a renderizacao da imagem da oferta em `offerImageUrl` para usar encaixe proporcional sem corte.
- Nenhuma regra de negocio, fluxo, texto, banco, Storage, policy ou migration foi alterado.

### Arquivos criados, alterados ou removidos

- Alterado: `src/components/ClientPortal.tsx`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma alteracao.
- Supabase Storage e policies: nenhuma alteracao.
- Migrations: nenhuma migration criada ou alterada.
- Hospedagem e deploy: nenhuma publicacao executada.

### Verificacoes e resultados

- `npm run test:portal001`: 22 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- Nao foram executados testes visuais em navegador nesta etapa.

### Como desfazer

- Reverter a alteracao em `src/components/ClientPortal.tsx` e esta entrada do historico.

---

## 2026-08-18-009 - Destaque de recompensa Protect no portal

**Etapa relacionada:** Melhoria visual e de fluxo na tela principal do Portal do Cliente para recompensa de limpeza Protect gratuita.

**Objetivo:** Exibir um card de destaque quando houver recompensa Protect disponivel e permitir iniciar o agendamento ja com a limpeza Protect aplicada com valor zero.

### Trabalho realizado

- A tela principal do Portal do Cliente passa a exibir um card de beneficio quando existir credito de fidelidade `available` para um servico Protect.
- O botao "Agendar minha Limpeza Protect" seleciona o servico da recompensa, abre o fluxo de agendamento diretamente na tela de sugestoes exclusivas e preserva o preco zero ja calculado pelos creditos disponiveis.
- O card deixa de aparecer automaticamente quando o credito deixa de estar `available`, pois usa a lista atual de `loyaltyRewardCredits`.
- Adicionada verificacao de teste para o contrato visual e de fluxo da recompensa Protect.

### Arquivos criados, alterados ou removidos

- Alterado: `src/components/ClientPortal.tsx`.
- Alterado: `src/components/ClientPortalHome.tsx`.
- Alterado: `tests/portal001-auth-isolation.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma alteracao.
- Supabase Storage e policies: nenhuma alteracao.
- Migrations: nenhuma migration criada ou alterada.
- Hospedagem e deploy: nenhuma publicacao executada.

### Verificacoes e resultados

- `npm run test:portal001`: 23 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- O card depende de a recompensa disponivel estar associada a um servico cujo nome contenha "Protect".
- Nao foram executados testes visuais em navegador nesta etapa.

### Como desfazer

- Reverter as alteracoes nos arquivos listados nesta entrada.

---

## 2026-08-19-012 - Correcao de registro duplicado da migration de links do portal

**Etapa relacionada:** Investigacao da falha da migration `20260818193000_portal_social_location_links.sql`.

**Objetivo:** Identificar por que a migration falhava com `duplicate key value violates unique constraint "schema_migrations_pkey"` e corrigir sem aplicar novas alteracoes no banco remoto.

### Trabalho realizado

- Verificado localmente que a migration inseria manualmente a propria versao em `supabase_migrations.schema_migrations`.
- Consultado o Supabase remoto via CLI somente leitura: a versao `20260818193000` ja consta como aplicada e as colunas `instagram_url` e `google_maps_url` existem em `public.configuracoes_empresa`.
- Removido da migration local o `insert into supabase_migrations.schema_migrations`, pois o Supabase CLI registra a versao automaticamente.
- Atualizado teste do Portal para impedir que essa migration volte a registrar manualmente `schema_migrations`.
- Atualizado o manifesto DB-001 para incluir a migration oficial ja existente no catalogo auditado.

### Arquivos criados, alterados ou removidos

- Alterado: `supabase/migrations/20260818193000_portal_social_location_links.sql`.
- Alterado: `tests/portal001-auth-isolation.test.ts`.
- Alterado: `tests/db001-baseline.test.ts`.
- Alterado: `docs/database/db001-manifest.json`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma alteracao aplicada por esta sessao.
- Supabase remoto: apenas consultas de leitura (`migration list` e `information_schema.columns`).
- Migrations: nenhuma nova migration criada; ajustado apenas o registro manual indevido da migration local.
- Hospedagem e deploy: nenhuma publicacao executada.

### Verificacoes e resultados

- `npm run test:portal001`: 24 testes aprovados.
- `npm run test:db001`: 11 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- A migration `20260818193000` ja aparece como aplicada no remoto; a correcao evita o conflito de duplo registro em execucoes futuras do arquivo.

### Como desfazer

- Reverter as alteracoes nos arquivos listados nesta entrada.

---

## 2026-08-18-010 - Correcao do card de recompensa Protect

**Etapa relacionada:** Investigacao do card de recompensa da Limpeza Protect no Portal do Cliente.

**Objetivo:** Identificar por que o card nao aparecia mesmo com recompensa ativa e corrigir apenas a condicao que bloqueava a exibicao.

### Trabalho realizado

- Diagnosticado que `loyaltyRewardCredits` era carregado, mas o card dependia de o nome do servico conter literalmente `protect`.
- A recompensa gerada pelo banco aponta para o servico "Limpeza de manutencao e protecao", que nao passava no filtro por `protect`.
- Ajustada apenas a condicao de identificacao do servico da recompensa para normalizar acentos e aceitar `protect` ou `protecao`.
- Atualizado o teste do Portal do Cliente para cobrir a condicao correta.

### Arquivos criados, alterados ou removidos

- Alterado: `src/components/ClientPortal.tsx`.
- Alterado: `tests/portal001-auth-isolation.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma alteracao.
- Supabase Storage e policies: nenhuma alteracao.
- Migrations: nenhuma migration criada ou alterada.
- Hospedagem e deploy: nenhuma publicacao executada.

### Verificacoes e resultados

- `npm run test:portal001`: 23 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- A exibicao continua dependendo de existir credito `available` e do servico referenciado estar presente no catalogo ativo carregado pelo portal.

### Como desfazer

- Reverter as alteracoes nos arquivos listados nesta entrada.

---

## 2026-08-22-001 - Agenda inteligente com intervalos dinamicos

**Etapa relacionada:** Melhoria da disponibilidade no Portal do Cliente e no painel administrativo.

**Objetivo:** Usar os horarios base apenas como referencia e exibir, no portal e no administrativo, somente inicios reais em que o servico selecionado caiba integralmente no intervalo livre.

### Trabalho realizado

- Mapeada a arquitetura atual da agenda antes das alteracoes: o administrativo calculava ocupacao em `AgendaModule.tsx`, enquanto o portal calculava slots ocupados separadamente em `ClientPortal.tsx`.
- Criada uma funcao compartilhada de disponibilidade em `src/utils/agendaAvailability.ts`.
- A nova regra considera expediente, almoco, antecedencia minima, capacidade por referencia de slot, agendamentos nao cancelados e duracao real do servico.
- Os terminos de servicos existentes passam a entrar como possiveis novos inicios, por exemplo `08:40` ou `11:30`, desde que o servico escolhido caiba integralmente no intervalo livre.
- O Portal do Cliente agora renderiza apenas os horarios validos retornados pela funcao compartilhada e revalida a disponibilidade antes da confirmacao.
- O painel administrativo agora usa a mesma funcao para preencher o seletor de horario e bloquear salvamento de horario invalido.

### Arquivos criados, alterados ou removidos

- Criado: `src/utils/agendaAvailability.ts`.
- Criado: `tests/agenda-availability.test.ts`.
- Alterado: `src/components/AgendaModule.tsx`.
- Alterado: `src/components/ClientPortal.tsx`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma alteracao.
- Migrations: nenhuma migration criada ou alterada.
- Hospedagem, deploy e servicos externos: nenhuma publicacao ou chamada externa executada.

### Verificacoes e resultados

- `npx tsx --test tests/agenda-availability.test.ts`: aprovado, cobrindo servicos de 40 minutos, 1h30, 2h e 3h.
- `npm run test:portal001`: 24 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- A validacao final de conflito no banco remoto nao foi alterada nesta etapa.
- Nenhuma pendencia de validacao local identificada apos liberar espaco em disco.

### Como desfazer

- Reverter as alteracoes nos arquivos listados nesta entrada.

---

## 2026-08-22-002 - Dashboard com cards cronologicos da agenda

**Etapa relacionada:** Ajuste visual da agenda no dashboard administrativo.

**Objetivo:** Exibir os agendamentos do dia como cards dinamicos em ordem cronologica, sem cards gerados por horarios fixos.

### Trabalho realizado

- Alterada apenas a apresentacao da agenda no dashboard.
- A grade visual deixou de gerar cards a partir dos horarios base.
- Cada agendamento do dia agora renderiza um card na sequencia cronologica real.
- Mantido um card final para iniciar novo agendamento de cliente.
- Mantidos os mesmos dados, handlers, drawer de edicao e fluxo de criacao existentes.

### Arquivos criados, alterados ou removidos

- Alterado: `src/components/DashboardModule.tsx`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma alteracao.
- RLS, Auth, migrations, hospedagem e deploy: nenhuma alteracao.

### Verificacoes e resultados

- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- O card final usa o fluxo atual de novo agendamento; nenhuma regra de disponibilidade foi modificada.

### Como desfazer

- Reverter as alteracoes nos arquivos listados nesta entrada.

---

## 2026-08-22-003 - Agenda com cards dinamicos e horario inicial inteligente

**Etapa relacionada:** Ajuste visual da tela Agenda administrativa.

**Objetivo:** Usar na tela Agenda o mesmo padrao de cards dinamicos do Dashboard, sem cards de horarios fixos, e iniciar o formulario no primeiro horario livre apos o ultimo agendamento do dia.

### Trabalho realizado

- A visualizacao diaria da Agenda deixou de renderizar cards vazios baseados em horarios fixos.
- Os agendamentos reais do dia selecionado agora sao exibidos em ordem cronologica.
- A fila lateral do modo mensal tambem passou a usar a mesma ordenacao cronologica.
- O formulario de novo agendamento passa a ser pre-preenchido com o primeiro horario livre apos o fim do ultimo agendamento ativo do dia, com fallback para o primeiro horario valido disponivel.
- O campo de horario do formulario foi mantido totalmente editavel por meio de input de hora.
- A validacao existente de disponibilidade no envio do formulario foi preservada.

### Arquivos criados, alterados ou removidos

- Alterado: `src/components/AgendaModule.tsx`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma alteracao.
- RLS, Auth, migrations, hospedagem, deploy e servicos externos: nenhuma alteracao.

### Verificacoes e resultados

- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- O horario sugerido usa a duracao do primeiro servico padrao do formulario; se o usuario selecionar outro servico, a validacao final existente continua impedindo horarios invalidos.

### Como desfazer

- Reverter as alteracoes nos arquivos listados nesta entrada.

---

## 2026-08-22-004 - Linha do tempo vertical na agenda administrativa

**Etapa relacionada:** Redesenho visual da agenda no sistema administrativo.

**Objetivo:** Substituir a visualizacao por cards soltos no Dashboard e na Agenda por uma linha do tempo vertical compartilhada, com horarios de referencia e agendamentos posicionados por inicio e duracao reais.

### Trabalho realizado

- Criado o componente reutilizavel `DailyTimeline` para uso no Dashboard e na tela Agenda.
- A coluna de horarios passa a ser derivada das configuracoes atuais da agenda, usando expediente do dia e intervalo calculado a partir dos `timeSlots`.
- Os agendamentos reais sao posicionados verticalmente pelo horario de inicio e recebem altura proporcional a duracao real (`durationTotal` ou tempo estimado do servico).
- Os espacos livres permanecem vazios e clicaveis; ao clicar, o formulario existente de novo agendamento abre com o horario da posicao clicada.
- O Dashboard passou a usar a linha do tempo em "Agenda de Hoje" preservando o drawer lateral atual.
- A tela Agenda passou a usar a mesma linha do tempo no modo de dia selecionado, preservando o formulario/modal atual.

### Arquivos criados, alterados ou removidos

- Criado: `src/components/DailyTimeline.tsx`.
- Alterado: `src/components/DashboardModule.tsx`.
- Alterado: `src/components/AgendaModule.tsx`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Banco de dados: nenhuma alteracao.
- Portal do Cliente, RLS, Auth, migrations, hospedagem, deploy e servicos externos: nenhuma alteracao.

### Verificacoes e resultados

- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- Agendamentos simultaneos sao distribuidos em colunas para evitar sobreposicao visual.
- A linha do tempo e um atalho visual; as validacoes existentes de conflito/disponibilidade continuam sendo aplicadas no salvamento.

### Como desfazer

- Reverter as alteracoes nos arquivos listados nesta entrada.

---

## 2026-08-22-005 - Orcamento vivo com itens rastreaveis

**Etapa relacionada:** Evolucao do modulo de Orcamentos para acompanhar conversao parcial e execucao por item.

**Objetivo:** Manter o orcamento vinculado ao cliente apos o envio, com acompanhamento individual dos itens orcados, convertidos, agendados, concluidos, cancelados ou pendentes.

### Trabalho realizado

- Mapeada a arquitetura existente: `OrcamentosModule`, tabelas `orcamentos` e `orcamento_itens`, criacao/finalizacao de agendamentos em `localDb`, templates de WhatsApp e automacoes `orcamento_enviado`, `orcamento_followup_7d` e `orcamento_followup_14d`.
- Criado helper de ciclo de vida para calcular status geral e pendencias a partir dos itens, preservando compatibilidade com orcamentos antigos.
- O item de orcamento passou a suportar status proprio e vinculo por ID com agendamento.
- A conversao parcial foi adicionada ao modulo de Orcamentos, permitindo selecionar somente itens pendentes, escolher data/hora e criar agendamento pelo fluxo central existente.
- A criacao/finalizacao/cancelamento de agendamento vinculado atualiza os itens do orcamento e recalcula o status geral.
- A policy de follow-up de orcamento agora considera itens pendentes; orcamentos totalmente resolvidos nao seguem no acompanhamento comercial.
- A ficha do cliente passou a exibir sinalizacao discreta dos orcamentos e itens pendentes.

### Arquivos criados, alterados ou removidos

- Criado: `src/utils/budgetLifecycle.ts`.
- Criado: `tests/budget-lifecycle.test.ts`.
- Criado: `supabase/migrations/20260822203000_orcamento_vivo_itens_agendamentos.sql`.
- Alterado: `src/types.ts`.
- Alterado: `src/db/localDb.ts`.
- Alterado: `src/db/budgetPolicy.ts`.
- Alterado: `src/App.tsx`.
- Alterado: `src/components/OrcamentosModule.tsx`.
- Alterado: `src/components/ClientesModule.tsx`.
- Alterado: `docs/database/db001-manifest.json`.
- Alterado: `tests/db001-baseline.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Criada migration local aditiva, ainda nao aplicada em producao.
- A migration adiciona colunas opcionais/compativeis em `orcamento_itens` e `agendamentos`; nao remove dados nem altera RLS.
- Portal do Cliente, Auth, RLS, disponibilidade dinamica da agenda, Dashboard e `DailyTimeline`: nenhuma alteracao intencional.
- Deploy, push e commit: nao executados nesta etapa.

### Verificacoes e resultados

- `npx tsx --test tests/budget-lifecycle.test.ts`: aprovado, cobrindo conversao parcial, conclusao total, follow-up com item pendente e orcamento antigo.
- `npx tsx --test tests/automation-behavior.test.ts`: aprovado, preservando automacoes existentes de orcamento em 7 e 14 dias.
- `npm run test:db001`: aprovado apos classificar a nova migration no manifesto.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- A migration precisa ser aplicada no ambiente alvo antes de usar a conversao em producao.
- Itens manuais sem `servico_id` continuam exibidos e rastreados, mas nao sao convertidos automaticamente em agendamento porque a agenda exige um servico cadastrado.
- A conversao usa o fluxo central de criacao de agendamento e a validacao compartilhada de disponibilidade; nao substitui validacoes finais existentes.
- A interface de ficha do cliente exibe acompanhamento e pendencias, mas nao cria um relatorio comercial novo nesta etapa.

### Como desfazer

- Reverter os arquivos listados nesta entrada.
- Caso a migration ja tenha sido aplicada em algum banco, deixar as colunas aditivas sem uso ou planejar rollback controlado apos backup; nao ha exclusao automatica de dados nesta entrega.

---

## 2026-08-22-006 - Correcoes de bloqueadores do Orcamento Vivo

**Etapa relacionada:** Revisao tecnica final da implementacao de Orcamento Vivo.

**Objetivo:** Corrigir cancelamento/reagendamento, atomicidade, duplicidade concorrente e tratamento de itens manuais antes de commit, push ou aplicacao em producao.

### Trabalho realizado

- Ajustada a migration local do Orcamento Vivo para incluir uma RPC transacional `fn_converter_itens_orcamento_em_agendamento`.
- A RPC valida usuario administrativo ativo, orcamento, cliente, veiculo, itens pertencentes ao orcamento, status pendente e existencia de `servico_id`.
- Os itens selecionados sao bloqueados com `FOR UPDATE` antes da conversao, reduzindo risco de conversao concorrente duplicada.
- A criacao do agendamento, o vinculo `orcamento_id`/`orcamento_item_ids`, a atualizacao dos itens e o recalculo do orcamento passam a ocorrer na mesma transacao da RPC no Supabase.
- No runtime local, a conversao passou por metodo dedicado `convertBudgetItemsToAppointment`, com as mesmas validacoes de itens pendentes e itens manuais.
- Ao cancelar um agendamento vinculado antes da conclusao, o item do orcamento volta para `pendente`, limpa o agendamento ativo do item e fica disponivel para reagendamento; o agendamento cancelado preserva o vinculo historico.
- Itens manuais sem `servico_id` continuam visiveis no orcamento, mas ficam desabilitados na conversao automatica e recebem mensagem explicativa.

### Arquivos criados, alterados ou removidos

- Alterado: `supabase/migrations/20260822203000_orcamento_vivo_itens_agendamentos.sql`.
- Alterado: `src/db/localDb.ts`.
- Alterado: `src/App.tsx`.
- Alterado: `src/components/OrcamentosModule.tsx`.
- Alterado: `tests/budget-lifecycle.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Nenhuma migration foi aplicada em producao.
- Nenhuma alteracao de RLS, Auth, service role, credenciais, deploy, push ou commit.
- A migration segue local e aditiva, aguardando revisao/aplicacao manual futura.

### Verificacoes e resultados

- `npx tsx --test tests/budget-lifecycle.test.ts`: aprovado com cenarios de cancelamento/reagendamento, segunda conversao, duplicidade, itens manuais e evidencia da RPC transacional.
- `npx tsx --test tests/automation-behavior.test.ts`: aprovado, preservando automacoes existentes e follow-ups de orcamento.
- `npm run test:db001`: aprovado.
- `npm run lint`: aprovado.
- `npm run build`: pendente nesta entrada ate a validacao final.

### Riscos, limitacoes e pendencias

- A validacao local de concorrencia e uma aproximacao; a protecao persistente real esta na RPC por lock de linhas no banco.
- A RPC ainda depende das validacoes existentes de disponibilidade de agenda feitas no aplicativo antes da chamada.
- Itens manuais precisam ser vinculados a um servico cadastrado antes de conversao automatica.

### Como desfazer

- Reverter os arquivos listados nesta entrada.
- Como nenhuma migration foi aplicada em ambiente externo, nao ha rollback de banco nesta etapa.

---

## 2026-08-22-007 - Endurecimento de seguranca da RPC do Orcamento Vivo

**Etapa relacionada:** Correcao dos bloqueadores de seguranca identificados na RPC transacional de conversao.

**Objetivo:** Impedir que usuarios autenticados sem permissao adequada chamem diretamente a RPC de conversao e impedir controle arbitrario do status inicial do agendamento.

### Trabalho realizado

- Revisado o modelo atual de permissoes: `permissions` por modulo/acao, com fallback por `perfil` conforme defaults do sistema.
- A RPC `fn_converter_itens_orcamento_em_agendamento` passou a validar explicitamente `auth.uid()`.
- A RPC consulta `public.usuarios` e exige usuario com `auth_user_id = auth.uid()`, `status = 'ativo'`, permissao efetiva para `orcamentos.create` ou `orcamentos.edit`, e permissao efetiva para `agenda.create`.
- Mantido `SECURITY DEFINER` com `SET search_path = ''`, objetos qualificados com schema `public` e sem SQL dinamico.
- Removido `p_status` da assinatura da RPC; o agendamento criado por conversao nasce sempre com status persistido `Agendado`.
- Atualizada a chamada da RPC no runtime para a nova assinatura.
- Adicionados testes estaticos de seguranca para autorizacao interna, menor privilegio de `EXECUTE` e neutralizacao de status arbitrario.

### Arquivos criados, alterados ou removidos

- Alterado: `supabase/migrations/20260822203000_orcamento_vivo_itens_agendamentos.sql`.
- Alterado: `src/db/localDb.ts`.
- Alterado: `tests/budget-lifecycle.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Nenhuma migration foi aplicada em producao.
- Nenhuma policy RLS, Auth, credencial, service role, deploy, push ou commit foi alterado/executado.

### Verificacoes e resultados

- `npx tsx --test tests/budget-lifecycle.test.ts`: aprovado, incluindo testes de seguranca da RPC.
- `npx tsx --test tests/automation-behavior.test.ts`: aprovado.
- `npm run test:db001`: aprovado.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- A validacao de seguranca da RPC ainda nao foi executada contra um banco real nesta etapa; a migration permanece local e nao aplicada.
- A permissao efetiva replica o modelo do frontend com fallback por perfil e overrides em `permissions`.

### Como desfazer

- Reverter os arquivos listados nesta entrada.
- Como nada foi aplicado em ambiente externo, nao ha rollback de banco nesta etapa.

---

## 2026-08-22-008 - Finalizacao local do Orcamento Vivo para commit e push

**Etapa relacionada:** Finalizacao da implementacao aprovada do Orcamento Vivo.

**Objetivo:** Consolidar a funcionalidade em um commit unico, apos validar ciclo de vida, conversao parcial, cancelamento, atomicidade, concorrencia, seguranca da RPC e preservacao das areas fora do escopo.

### Trabalho realizado

- Reexecutadas as validacoes finais solicitadas antes do commit.
- Revisado o status e o diff do worktree para separar somente os arquivos pertencentes ao Orcamento Vivo.
- Confirmado que `ClientPortal`, `agendaAvailability`, `DailyTimeline`, `DashboardModule` e `AgendaModule` nao possuem alteracoes nesta etapa.
- Mantida a migration local sem aplicacao em producao.
- Mantido deploy manual pendente para etapa posterior.

### Arquivos criados, alterados ou removidos

- Criado: `src/utils/budgetLifecycle.ts`.
- Criado: `tests/budget-lifecycle.test.ts`.
- Criado: `supabase/migrations/20260822203000_orcamento_vivo_itens_agendamentos.sql`.
- Alterado: `src/types.ts`.
- Alterado: `src/db/localDb.ts`.
- Alterado: `src/db/budgetPolicy.ts`.
- Alterado: `src/App.tsx`.
- Alterado: `src/components/OrcamentosModule.tsx`.
- Alterado: `src/components/ClientesModule.tsx`.
- Alterado: `docs/database/db001-manifest.json`.
- Alterado: `tests/db001-baseline.test.ts`.
- Alterado: `docs/HISTORICO_DE_ALTERACOES.md`.

### Banco, hospedagem e servicos externos

- Nenhuma migration foi aplicada em producao.
- Nenhuma alteracao foi feita em RLS existente, Auth, service role, credenciais ou configuracoes externas.
- Nenhum deploy foi executado nesta etapa.

### Verificacoes e resultados

- `npx tsx --test tests/budget-lifecycle.test.ts`: aprovado, 12 testes.
- `npx tsx --test tests/automation-behavior.test.ts`: aprovado, 41 testes.
- `npm run test:db001`: aprovado, 11 testes.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo `security:artifact` e `pilot:artifact`.

### Riscos, limitacoes e pendencias

- A migration ainda precisa ser aplicada e validada no banco de producao antes do deploy do codigo.
- A RPC foi validada por testes locais/estaticos nesta etapa; a validacao contra o banco real fica pendente para a etapa controlada de migration.
- Alteracoes antigas e nao relacionadas permanecem no worktree fora do commit.

### Como desfazer

- Reverter o commit desta funcionalidade.
- Caso a migration venha a ser aplicada no futuro, planejar rollback controlado apos backup; nesta etapa nao houve alteracao externa de banco.
