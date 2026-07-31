# Plano diário das automações

Documento operacional para acompanhar as correções das automações da Senhora
Limpeza Estética Automotiva.

## Ponto de retomada

**Próxima ação:** obter acesso a uma conta autenticada do Portal do Cliente e
validar um agendamento feito pelo próprio cliente.
**Estado atual:** Noite 3 em andamento; agendamento pelo operador e serviço
iniciado foram confirmados no aparelho. Novo cliente e serviço finalizado foram
aceitos pelo provedor, mas não tiveram entrega física confirmada. Falta também o
agendamento pelo Portal.
**Última noite validada:** Noite 2 — Controle “Envios 24 horas”.
**Render:** publicado e ativo no plano gratuito.
**Bloqueios conhecidos:** o dry-run Docker permanece indisponível nesta máquina;
o Supabase descartável foi usado como laboratório com autorização explícita.
O provedor configurado no Render é o Make e o telefone autorizado está
confirmado, mantendo-se mascarado na documentação.

Este bloco deve ser atualizado ao final de cada sessão. Uma noite seguinte só
pode começar quando a anterior estiver validada ou tiver um bloqueio registrado.

## Estados

- **Pendente:** ainda não iniciada.
- **Em andamento:** trabalho iniciado.
- **Bloqueada:** depende de ação ou decisão externa.
- **Implementada:** alteração pronta, mas ainda não validada.
- **Validada:** alteração concluída e testes aprovados.

## Organização de cada sessão

| Horário | Atividade |
| --- | --- |
| 19h00–19h20 | Ler histórico e confirmar o objetivo |
| 19h20–21h30 | Executar a alteração planejada |
| 21h30–22h30 | Testar e corrigir |
| 22h30–23h00 | Registrar resultados e preparar a retomada |

Uma noite só pode ser marcada como **Validada** quando o objetivo estiver
concluído, os testes relacionados estiverem aprovados, o sistema estiver
estável, nenhuma migration estiver aplicada pela metade e o histórico e o ponto
de retomada estiverem atualizados.

## Cronograma

| Noite | Etapa | Objetivo | Estado |
| --- | --- | --- | --- |
| 1 | Etapa 1 | Verificação do ambiente real | **Validada** |
| 2 | Etapa 1 | Controle “Envios 24 horas” | **Validada** |
| 3 | Etapa 2 | Mensagens imediatas | **Em andamento** |
| 4 | Etapa 2 | Lembrete configurável e fuso horário | **Pendente** |
| 5 | Etapa 2 | Segurança do lembrete | **Pendente** |
| 6 | Etapa 2 | Cliente inativo | **Pendente** |
| 7 | Etapa 2 | Aniversários | **Pendente** |
| 8 | Etapa 3 | Provedor, tentativas e confirmação | **Pendente** |
| 9 | Etapa 4 | Monitoramento e preparação operacional | **Pendente** |
| 10 | Etapa 5 | Validação integrada | **Pendente** |

## Noite 1 — Verificação do ambiente real

**Objetivo:** conferir migrations, filas e gatilhos no Supabase; confirmar
Make/Z-API sem expor credenciais; definir telefone autorizado; não enviar
mensagens para clientes.

**Validação:** ambiente real documentado, provedor identificado, telefone de
teste confirmado e nenhuma mensagem acidental.

## Noite 2 — Controle “Envios 24 horas”

**Objetivo:** criar e persistir um botão **Envios 24 horas**. Ligado, ele ignora
completamente a janela 08h–20h. Desligado, os horários configurados voltam a
valer. Durante testes noturnos, permanecerá ligado.

**Validação:** configuração permanece após reiniciar o servidor, interface
mostra o modo ativo e teste autorizado funciona depois das 20h.

## Noite 3 — Mensagens imediatas

**Objetivo:** validar novo cliente, agendamento pelo cliente, agendamento pelo
operador, serviço iniciado e serviço finalizado.

**Validação:** cada fato gera exatamente uma mensagem, sem ausência ou
duplicidade.

## Noite 4 — Lembrete configurável e fuso horário

**Objetivo:** permitir antecedência configurável, salvar a escolha e padronizar
os cálculos em `America/Sao_Paulo`.

**Validação:** uma, duas e dez horas funcionam corretamente e permanecem após
reinicialização.

## Noite 5 — Segurança do lembrete

**Objetivo:** tratar cancelamento, reagendamento, estados concluídos e
duplicidade.

**Validação:** somente um lembrete válido é enviado para o horário atual do
agendamento.

## Noite 6 — Cliente inativo

**Objetivo:** considerar somente atendimentos concluídos, aplicar dias de
ausência e mínimo de atendimentos, ignorar retorno futuro e controlar repetição.

**Validação:** apenas clientes que atendem a todos os critérios entram na fila.

## Noite 7 — Aniversários

**Objetivo:** usar o fuso de São Paulo, tratar datas ausentes e garantir uma
mensagem por aniversariante por ano.

**Validação:** virada do dia e repetições do worker não causam erro ou
duplicidade.

## Noite 8 — Provedor, tentativas e confirmação

**Objetivo:** eliminar sucesso simulado, exigir provedor válido, revisar
retentativas e diferenciar aceitação, entrega e falha.

**Validação:** painel e histórico apresentam o estado verdadeiro e falhas não
produzem duplicidades silenciosas.

## Noite 9 — Monitoramento e preparação operacional

**Objetivo:** identificar fila parada, claims abandonados e erros definitivos;
preparar os requisitos do piloto real. O Render continua gratuito.

**Validação:** falhas ficam visíveis e o procedimento de recuperação está
documentado, sem contratação nesta etapa.

## Noite 10 — Validação integrada

**Objetivo:** testar as sete automações com contatos autorizados, executar todos
os testes, publicar no Render gratuito e documentar os resultados.

**Validação:** todos os fluxos e testes aprovados, histórico atualizado e
pendências do piloto registradas.

## Estimativa e limite

São dez sessões de aproximadamente quatro horas, totalizando quarenta horas. Se
houver bloqueio externo, será criada uma sessão adicional específica. A noite
atual não será estendida pela madrugada para compensar o bloqueio.
