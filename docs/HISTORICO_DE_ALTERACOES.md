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

## 2026-07-30-015 — Agendamento autenticado pelo Portal do Cliente

### Tarefa, conversa ou etapa relacionada

- Validação do agendamento pelo cliente na Noite 3 das mensagens imediatas.

### Objetivo

- Comprovar que um agendamento criado por uma conta autenticada do Portal do
  Cliente produz exatamente uma mensagem automática.

### Trabalho realizado

- Foi criado um único agendamento controlado pelo Portal do Cliente para o
  contato autorizado de teste.
- O registro foi acompanhado no Supabase até o processamento do evento e a
  conclusão da execução.
- O histórico do cenário no Make foi conferido sem repetir ou reprocessar a
  execução.
- O ponto de retomada do cronograma foi atualizado.

### Arquivos alterados

- `docs/PLANO_DIARIO_AUTOMACOES.md`
- `docs/HISTORICO_DE_ALTERACOES.md`

### Banco, hospedagem e serviços externos

- Supabase: criado somente o agendamento de teste e os registros automáticos
  associados a ele.
- Make/provedor: uma nova execução automática foi realizada pelo fluxo já
  publicado.
- Render e configurações externas: nenhuma alteração.

### Verificações e resultados

- Portal do Cliente: criação concluída com tela de sucesso.
- Outbox: exatamente um evento `novo_agendamento`, com processamento concluído.
- Fila: exatamente uma execução `novo_agendamento`, estado `sucesso` e uma
  tentativa.
- Deduplicação: chave única correspondente ao agendamento.
- Make: exatamente uma execução nova no horário do teste, estado `Success`, com
  dois módulos e duas operações.
- Não foi observado envio duplicado.

### Riscos, limitações e pendências

- O sucesso técnico e a aceitação pelo provedor não substituem a confirmação de
  chegada no aparelho.
- Permanecem pendentes as confirmações físicas da mensagem deste agendamento e
  da mensagem de boas-vindas do novo cliente.
- A Noite 3 permanece **Em andamento** até essas confirmações.

### Como desfazer

- Se for necessário limpar o laboratório, remover somente o agendamento de
  teste criado nesta etapa; os registros automáticos associados seguem as
  regras de relacionamento do banco.
- Não remover registros de outros agendamentos e não reprocessar mensagens.
- Para desfazer apenas a documentação, criar uma nova entrada corretiva e
  restaurar o ponto de retomada, sem apagar este histórico.

## 2026-07-30-016 — Não entrega da mensagem de boas-vindas

### Tarefa, conversa ou etapa relacionada

- Validação física da mensagem de novo cliente na Noite 3.

### Objetivo

- Registrar o resultado real da entrega e diferenciar execução técnica de
  recebimento no WhatsApp.

### Trabalho realizado

- O usuário informou que a mensagem de boas-vindas não chegou ao aparelho
  autorizado.
- A execução correspondente foi inspecionada no Make sem reprocessamento.
- O cronograma foi corrigido para tratar o fluxo como não entregue.
- Nenhuma mensagem foi reenviada.

### Arquivos alterados

- `docs/PLANO_DIARIO_AUTOMACOES.md`
- `docs/HISTORICO_DE_ALTERACOES.md`

### Banco, hospedagem e serviços externos

- Nenhuma alteração foi aplicada ao Supabase, Render, Make, cenário ou
  provedor.
- Nenhuma nova execução ou mensagem foi criada.

### Verificações e resultados

- Make: execução concluída com dois módulos e duas operações.
- Provedor: resposta HTTP 200 com identificadores de mensagem.
- Entrega física: não recebida no aparelho autorizado.
- Diagnóstico: o estado `Success` comprova a conclusão da chamada HTTP, mas não
  comprova entrega no WhatsApp.

### Riscos, limitações e pendências

- O fluxo atual não consulta nem persiste confirmação de entrega do provedor.
- Um reenvio automático poderia produzir duplicidade tardia e não foi
  realizado.
- É necessário diagnosticar a entrega e combinar um novo teste controlado.
- A confirmação física da mensagem do agendamento criado pelo Portal do Cliente
  também permanece pendente.
- A Noite 3 permanece **Em andamento**.

### Como desfazer

- Esta etapa altera somente documentação. Correções devem ser registradas em uma
  nova entrada, sem apagar esta.
- Não há mensagem, banco ou configuração externa a desfazer.
