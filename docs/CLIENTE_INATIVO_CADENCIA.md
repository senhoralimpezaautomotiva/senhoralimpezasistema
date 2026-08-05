# Cadência da automação de cliente inativo

Documento técnico da revisão da Noite 6. Ele descreve o fluxo verificado antes
da implementação e os critérios de validação da sequência automática.

## Regra de negócio confirmada

- Etapa 1: automática quando o cliente alcançar o prazo de inatividade
  configurado no painel.
- Etapa 2: automática sete dias completos depois da primeira mensagem.
- Etapa 3: automática 21 dias completos depois da primeira mensagem.
- A etapa 3 somente avança depois da aceitação da etapa 2, preservando a ordem
  mesmo se houver indisponibilidade temporária do provedor.
- Se a etapa 2 atrasar, a etapa 3 respeita também sete dias completos depois da
  aceitação da etapa 2. No fluxo normal, os marcos continuam sendo 0, 7 e 21;
  esse limite adicional impede duas mensagens em intervalo menor que uma semana.
- Um agendamento criado pelo Portal do Cliente ou pelo profissional interrompe
  o ciclo atual.
- Um novo ciclo somente pode começar a partir de um novo atendimento concluído
  e depois do novo prazo de inatividade configurado.
- A sequência termina na terceira etapa e nunca se repete diariamente.

O estado histórico `sucesso` comprova aceitação pelo provedor, não entrega no
WhatsApp. Por isso, a contagem técnica dos dias 7 e 21 usa o `updated_at` da
primeira execução aceita pelo provedor, que é a evidência persistida disponível.

## Fluxo encontrado antes da mudança

1. `AutomationEngine.runCycle`, em `src/db/automationEngine.ts`, sincroniza
   configurações, clientes, agendamentos e execuções.
2. `AutomationEngine.scanAndGenerateExecutions` encontra o trigger
   `cliente_inativo`, confere `isActive` e chama `evaluateInactiveCustomer`.
3. `evaluateInactiveCustomer`, em `src/db/inactiveCustomerPolicy.ts`, considera
   somente serviços finalizados ou entregues, aplica `inactiveDays` e
   `minServices` e bloqueia retorno futuro ou serviço ativo.
4. O código anterior produzia uma única chave
   `cliente_inativo:<cliente>:<último atendimento concluído>` por episódio.
5. `LocalDatabase.queueAutomation`, em `src/db/localDb.ts`, localiza novamente o
   trigger ativo, renderiza o template, valida telefone e mensagem e insere na
   outbox `automacoes_execucoes` com deduplicação única.
6. `AutomationEngine.processQueue` usa claim atômico e, antes do provedor, chama
   `validateInactiveCustomerBeforeSend`.
7. A guarda pré-envio consulta diretamente todos os agendamentos atuais do
   cliente no Supabase e cancela ou adia sem enviar quando a elegibilidade não
   pode ser comprovada.
8. Portal e sistema interno persistem na mesma tabela `agendamentos`. Portanto,
   a política não depende da origem e ambos interrompem a automação pela mesma
   consulta.

## Trajeto da mudança

1. Preservar o produtor único: somente `queueAutomation` cria execuções.
2. Manter a chave legada somente para reconhecer dados existentes e impedir
   backfill de mensagens antigas.
3. Novos ciclos usam chaves explícitas por etapa:
   `cliente_inativo:<cliente>:<atendimento>:etapa:<1|2|3>`.
4. A política pura seleciona no máximo uma próxima etapa por ciclo:
   - sem histórico novo: etapa 1;
   - etapa 1 aceita e sete dias completos: etapa 2;
   - etapas 1 e 2 aceitas, 21 dias completos desde a etapa 1 e pelo menos sete
     dias completos desde a etapa 2: etapa 3;
   - etapa 3 já existente: ciclo encerrado.
5. Qualquer chave legada já existente encerra o ciclo legado sem criar etapas 2
   ou 3. Assim, a publicação não envia acompanhamentos retroativos a clientes
   que receberam mensagens antes desta mudança.
6. Um agendamento posterior à primeira mensagem interrompe o ciclo,
   independentemente de ter sido criado no Portal ou no sistema interno. A
   evidência é o `created_at` persistido do agendamento, não texto ou metadado da
   origem.
7. A guarda pré-envio revalida ciclo, etapa, prazos, ordem e agendamentos usando
   o estado mais recente antes de chamar o provedor.
8. Nenhum template, texto, interface, layout, Make ou Z-API é alterado.

## Compatibilidade e banco

- Nenhuma coluna ou tabela nova é necessária.
- O índice único existente de `deduplication_key` garante uma execução por
  cliente, ciclo e etapa, inclusive com workers concorrentes.
- A migration anterior da Noite 6 e suas chaves legadas permanecem válidas.
- Não haverá backfill nem atualização destrutiva de execuções existentes.
- Falha ao consultar agendamentos continua adiando a execução sem chamar o
  provedor.

## Critérios de validação

- exatamente uma etapa 1 quando o prazo configurado for alcançado;
- nenhuma etapa 2 antes de sete dias completos da etapa 1 aceita;
- exatamente uma etapa 2 a partir do dia 7;
- nenhuma etapa 3 antes de 21 dias completos da etapa 1 aceita;
- etapa 3 somente depois da etapa 2 aceita;
- etapa 3 nunca ocorre antes de sete dias completos da etapa 2 aceita;
- exatamente uma etapa 3 a partir do dia 21;
- nenhum quarto envio;
- chave legada não produz acompanhamento retroativo;
- agendamento posterior interrompe a sequência;
- Portal e sistema interno seguem a mesma política;
- novo atendimento concluído inicia outro ciclo somente depois de `inactiveDays`;
- automação desativada, template vazio, telefone inválido ou falha de leitura
  continuam bloqueando o envio;
- ciclos repetidos, reinícios e concorrência não duplicam nenhuma etapa.

## Riscos e reversão

- Um agendamento removido fisicamente deixa de existir na consulta. Exclusões
  devem permanecer auditadas; cancelamento preserva o registro e interrompe o
  ciclo.
- Se a mudança precisar ser revertida antes da publicação, remover somente a
  seleção das etapas novas e manter as execuções já registradas. Nunca apagar
  chaves de deduplicação.
- Se já publicada, desativar a automação antes de uma correção posterior e
  preservar todas as execuções para impedir reenvios.

## Validação local concluída em 05/08/2026

- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo artefatos de segurança e do Portal.
- `npm run test:automations`: 38 de 38 aprovados.
- `npm run test:stabilization`: 21 de 21 aprovados.
- `npm run test:db001`: 11 de 11 aprovados.
- SEC-002, SEC-003, SEC-004 e SEC-005: 44 de 44 aprovados.
- Piloto, Portal e go-live: 29 de 29 aprovados.
- Headers, segredos, lockfile, licenças e dependências não utilizadas: aprovados.
- `bun audit --audit-level=high`: aprovado sem vulnerabilidade de nível alto.

A cadência está **Implementada** localmente, mas a Noite 6 ainda não está
**Validada** nem publicada. Permanecem obrigatórios o dry-run PostgreSQL da
migration anterior da Noite 6, backup, comparação do ledger e validação em uso
real com contatos autorizados.
