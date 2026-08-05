# Portal do Cliente — implementação do layout aprovado

## Escopo

Esta implementação aplica ao portal autenticado o padrão visual aprovado, sem
substituir o fluxo existente de agendamento. A tela principal passa a concentrar
cinco acessos: Agendar serviço, Catálogo, Cartão fidelidade, Histórico e
Consultar agenda.

## Comportamento das telas

- **Login:** mantém autenticação, cadastro e recuperação existentes, com o logo
  e o novo padrão visual.
- **Principal:** saudação centralizada, resumo da fidelidade e do último
  atendimento, quatro botões simétricos e o botão horizontal de consulta.
- **Agendar serviço:** abre o fluxo anterior integralmente preservado.
- **Catálogo:** exibe os serviços do sistema ou abre o catálogo do WhatsApp,
  conforme escolha feita em Configurações > Geral > Portal do Cliente.
- **Cartão fidelidade:** cartão digital com o logo, progresso real e meta
  configurável de indicações.
- **Histórico:** apresenta os agendamentos pertencentes ao cliente autenticado.
- **Consultar agenda:** consulta datas e horários sem oferecer ação de criação,
  alteração ou cancelamento.

## Dados e segurança

- A migration `20260805235000_portal_cliente_experiencia.sql` adiciona somente
  configurações opcionais e uma função de leitura agregada.
- A contagem de fidelidade é calculada no banco para o cliente autenticado e não
  expõe cadastros de clientes indicados.
- A agenda consultiva reutiliza a leitura protegida do portal e permanece sem
  operações mutáveis.
- A fonte padrão do catálogo é `system`, a meta padrão é 10 e o link do
  WhatsApp fica vazio até configuração administrativa.

## Operação e reversão

- Para voltar ao catálogo interno, selecionar `Catálogo do sistema` na tela de
  configurações; nenhuma publicação é necessária.
- Para rollback da interface, publicar novamente o commit estável anterior.
- A migration é aditiva e pode permanecer instalada durante um rollback da
  aplicação. Caso haja necessidade comprovada de reversão do schema, criar uma
  migration corretiva específica; não apagar migrations já aplicadas.

