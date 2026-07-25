# Publicação do piloto

Este procedimento publica o painel administrativo e o Portal do Cliente. O
portal autentica por e-mail e senha no Supabase Auth, exige confirmação de
e-mail e isola cada identidade em um único cadastro por RLS.

Para publicação no Render, use também o procedimento operacional fechado em
`docs/GO_LIVE_RENDER.md` e o Blueprint `render.yaml`.

## 1. Portão obrigatório antes de acessar o banco

Não execute SQL enquanto estes itens não estiverem registrados:

1. referência exata do projeto Supabase destinado ao piloto;
2. confirmação de que o projeto não é um ambiente diferente;
3. janela aprovada para alteração;
4. backup lógico real, fora deste repositório, com data, tamanho e checksum;
5. restauração do backup validada em um banco isolado.

O backup deve incluir roles, schema e dados. Use `pg_dump` com a connection
string fornecida pelo próprio Supabase e depois valide o arquivo:

```text
pg_dump --format=custom --no-owner --no-privileges "<DATABASE_URL>" --file "<BACKUP_EXTERNO>.dump"
npm run db:backup:verify -- "<BACKUP_EXTERNO>.dump"
```

Nunca coloque a connection string, o dump ou dados reais dentro do projeto.
Não use `supabase db reset --linked`. Não renomeie, normalize ou apague tabelas,
colunas ou dados durante a preparação do piloto.

Os arquivos SQL antigos na raiz não formam uma cadeia oficial de migrações.
Conforme a DB-001, eles não devem ser aplicados novamente sem primeiro comparar
o histórico remoto e confirmar que a proteção já aprovada ainda não está
presente. A aplicação remota fica bloqueada até essa verificação.

## 2. Variáveis de produção

Configure as variáveis na plataforma de hospedagem, nunca em arquivo publicado:

```text
APP_ENV=production
NODE_ENV=production
PORT=3000
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<chave-publica>
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<chave-publica>
VITE_ENABLE_CLIENT_PORTAL=true
MAKE_WEBHOOK_URL=<segredo-do-servidor>
ZAPI_INSTANCE_ID=<segredo-do-servidor>
ZAPI_TOKEN=<segredo-do-servidor>
ZAPI_CLIENT_TOKEN=<segredo-do-servidor>
```

As variáveis `VITE_*` são públicas. Somente a URL e a chave pública do Supabase,
além do sinalizador booleano do portal, podem usar esse prefixo. Z-API e Make
devem existir apenas no ambiente privado do servidor. Use
`VITE_ENABLE_CLIENT_PORTAL=false` somente para desabilitar o portal durante um
rollback sem afetar o painel administrativo.

No Supabase, mantenha o provedor Email habilitado e `Confirm email` ativo.
Cadastre a URL HTTPS publicada e a URL de homologação em **Authentication →
URL Configuration → Redirect URLs**, pois confirmação e recuperação retornam
ao portal. Para produção, configure SMTP próprio; o remetente padrão do
Supabase possui limites baixos e não oferece garantia de entrega.

## 3. Validar e gerar a versão

Use Node.js compatível com o projeto e Bun somente para instalar/auditar:

```text
bun install --frozen-lockfile
npm run security:ci
```

O comando consolidado executa TypeScript, todos os testes SEC e DB-001, testes
de estabilização e do piloto, build, scanner de segredos, validação do artefato,
lockfile, vulnerabilidades e licenças.

O diretório `dist/` gerado é o único artefato de execução. Não publique source
maps, dumps, arquivos `.env`, ZIPs, scripts de diagnóstico ou SQL.

## 4. Iniciar, verificar e reiniciar

Na hospedagem, configure o comando:

```text
npm start
```

Verifique pela URL HTTPS temporária da plataforma:

1. a tela de login abre sem erro;
2. `?portal=true` mostra o login por e-mail do Portal do Cliente;
3. cadastro, confirmação de e-mail, login, recuperação, F5 e logout funcionam;
4. dois clientes autenticados não conseguem consultar dados um do outro;
5. o console e a rede do navegador não mostram segredos;
6. os headers de segurança estão presentes;
7. um cadastro e um agendamento de homologação funcionam com cada perfil.

Para reiniciar, use o botão de restart/redeploy da própria hospedagem. Não rode
duas instâncias manuais na mesma porta. Para uso no computador da loja, crie um
atalho para a URL HTTPS; o computador não deve hospedar o servidor publicamente.

## 5. Rollback

Antes da publicação, anote o identificador da versão anterior da plataforma.
Se o smoke test falhar, restaure essa versão pelo mecanismo de rollback da
hospedagem e preserve os logs pelo correlation ID.

Uma reversão de aplicação não autoriza reversão destrutiva do banco. Qualquer
rollback de banco exige backup restaurável, revisão técnica e nova aprovação.

## 6. Teste manual da loja

Em dados de homologação, valide nesta ordem:

1. admin: login, F5, logout e consulta do dashboard;
2. gerente: clientes, veículos, agenda, impressão e relatório básico;
3. atendente: cadastrar/inativar cliente, cadastrar/editar veículo e agendar;
4. conferir preço para veículos Pequeno, Médio e Grande;
5. alterar um agendamento, confirmar, iniciar e finalizar;
6. confirmar as mensagens de agendamento, início e finalização;
7. imprimir a ordem de serviço;
8. abrir a URL em uma nova janela e confirmar que o portal está indisponível.

Use clientes e telefones de teste. A liberação da loja só ocorre depois que RLS,
políticas e mensagens forem comprovadas no projeto Supabase confirmado.
