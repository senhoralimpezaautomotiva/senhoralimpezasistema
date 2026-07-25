# Senhora Limpeza

Sistema administrativo e portal para estética automotiva.

## Ambientes

O projeto reconhece três ambientes:

- `development`: servidor Vite e serviços locais ou isolados.
- `staging`: build de produção com dados e credenciais exclusivos de homologação.
- `production`: build e credenciais exclusivos de produção.

Copie o arquivo `.env.<ambiente>.example` apropriado para um arquivo `.env`
local não versionado ou injete as variáveis pela plataforma. Staging e produção
exigem `APP_ENV`, `NODE_ENV=production`, `SUPABASE_URL` e
`SUPABASE_ANON_KEY`. Os valores `VITE_*` são públicos e incorporados ao bundle;
tokens da Z-API e webhooks do Make nunca podem usar esse prefixo.

O Portal do Cliente usa Supabase Auth por e-mail e senha, sessão persistente e
vínculo exclusivo entre `auth.users` e `public.clientes`. O isolamento é
aplicado por RLS no banco. `VITE_ENABLE_CLIENT_PORTAL=true` é o padrão; use
`false` apenas como rollback operacional. Confirmação de e-mail deve permanecer
obrigatória no Supabase.

Configurações privadas não possuem valores padrão. Uma combinação Z-API
incompleta, URLs inseguras ou ambiente de produção configurado como
desenvolvimento impedem a inicialização.

## Execução

```text
bun install --frozen-lockfile
npm run dev
```

Builds:

```text
npm run build
npm run build:staging
```

## Baseline de segurança

```text
npm run security:headers
npm run security:secrets
npm run security:artifact
npm run security:dependencies
npm run security:outdated
npm run security:unused
npm run security:licenses
npm run test:sec005
npm run security:ci
```

O procedimento operacional do piloto, incluindo backup, publicação, restart,
rollback e teste manual, está em `docs/PILOT_DEPLOYMENT.md`.

A preparação específica do Render, o health check, a validação das variáveis,
as Redirect URLs e a configuração segura de SMTP estão em
`docs/GO_LIVE_RENDER.md`. O Blueprint oficial é `render.yaml`.

A CSP de produção não permite `unsafe-eval` nem scripts inline. A exceção
`style-src 'unsafe-inline'` é necessária porque React e Recharts aplicam estilos
por atributo. Em desenvolvimento, o preâmbulo inline do React Refresh é permitido;
essa exceção não existe em staging ou produção.
