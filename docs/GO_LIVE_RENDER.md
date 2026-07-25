# GO-LIVE-001 — Publicação piloto no Render

Este procedimento publica o painel administrativo e o Portal do Cliente sem
executar novas migrations ou alterar dados. O banco oficial continua no projeto
Supabase já vinculado.

## 1. Antes de criar o serviço

- Confirme que o backup externo aprovado continua disponível.
- Confirme que as migrations `20260724210000`, `20260724213000` e
  `20260724224500` aparecem como aplicadas no Supabase.
- Tenha em mãos a URL pública e a chave `publishable` ou `anon` do Supabase.
- Tenha pelo menos um provedor de mensagens: Make ou Z-API.
- Escolha um provedor SMTP compatível com Supabase Auth e valide o domínio
  remetente, SPF, DKIM e DMARC.
- Não execute migrations, `db reset`, seed ou sincronização destrutiva durante
  esta publicação.

## 2. Criar o Blueprint no Render

1. Envie este projeto para um repositório Git privado.
2. No Render, escolha **New → Blueprint** e conecte o repositório.
3. Confirme o arquivo `render.yaml`.
4. O Blueprint cria `senhora-limpeza-piloto` na região Virginia, a região do
   Render mais próxima disponível para o Supabase em São Paulo.
5. O plano inicial está fixado como `free` para impedir contratação automática.
6. Preencha as variáveis marcadas como `sync: false`.

O deploy automático fica desligado. Cada publicação deve ser iniciada
manualmente depois que os testes da versão forem aprovados.

O plano gratuito adormece após inatividade e pode levar cerca de um minuto para
responder novamente. Ele também pausa o worker de automações enquanto estiver
adormecido. Para uso contínuo na loja e mensagens pontuais, aprove a mudança
manual para o plano Starter antes de considerar o piloto operacionalmente
estável.

## 3. Variáveis do Render

O Blueprint define automaticamente:

| Variável | Valor |
| --- | --- |
| `APP_ENV` | `production` |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `24.18.0` |
| `BUN_VERSION` | `1.3.14` |
| `VITE_ENABLE_CLIENT_PORTAL` | `true` |

Preencha no painel:

| Variável | Obrigatória | Origem |
| --- | --- | --- |
| `SUPABASE_URL` | Sim | Project Settings → API |
| `SUPABASE_ANON_KEY` | Sim | Chave pública `publishable` ou `anon` |
| `VITE_SUPABASE_URL` | Sim | Mesmo valor de `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Sim | Mesmo valor de `SUPABASE_ANON_KEY` |
| `MAKE_WEBHOOK_URL` | Condicional | Cofre do Make |
| `ZAPI_INSTANCE_ID` | Condicional | Painel Z-API |
| `ZAPI_TOKEN` | Condicional | Painel Z-API |
| `ZAPI_CLIENT_TOKEN` | Opcional | Painel Z-API |

Configure Make ou o conjunto Z-API. Não use `service_role`, chave `secret`,
senha do banco ou Access Token da CLI no Render. As variáveis `VITE_*` são
públicas e aceitam somente a URL e a chave pública do Supabase.

O Render fornece `PORT` e `RENDER_EXTERNAL_URL` automaticamente. Se um domínio
próprio for adotado, adicione `PUBLIC_APP_URL=https://dominio` ao Render e
refaça a configuração de URLs do Supabase.

## 4. SMTP e URLs do Supabase

O SMTP pertence ao Supabase Auth, não ao servidor Render. Não coloque a senha
SMTP nas variáveis da aplicação.

Obtenha do provedor SMTP:

- host e porta;
- usuário e senha SMTP;
- endereço remetente de domínio verificado;
- nome do remetente.

Copie `.env.smtp.example` para um arquivo local ignorado pelo Git e preencha os
valores. Primeiro execute somente a validação:

```text
npm run go-live:smtp:check
```

Depois de revisar o domínio definitivo e autorizar a alteração do Supabase:

```text
npm run go-live:smtp:apply
```

Esse comando configura via Management API:

- provedor Email habilitado;
- confirmação de e-mail obrigatória;
- proteção de troca de e-mail;
- SMTP configurável;
- `Site URL` com a URL HTTPS publicada;
- duas Redirect URLs exatas:
  - `https://<servico>.onrender.com/?portal=true`
  - `https://<servico>.onrender.com/?portal=true&recovery=true`

O `SUPABASE_ACCESS_TOKEN` é usado somente nessa operação local e nunca deve ser
enviado ao Render ou versionado. A mesma configuração pode ser feita pelo
Dashboard em **Authentication → URL Configuration** e
**Authentication → SMTP Settings**.

## 5. Build e publicação

O Render executa:

```text
bun install --frozen-lockfile --ignore-scripts
npm run build:render
npm start
```

`build:render` falha antes da publicação quando encontra ambiente não HTTPS,
projetos Supabase divergentes, chave privada no lugar da chave pública, portal
desativado ou ausência de provedor de mensagens.

O endpoint `GET /health` deve responder `200` com `{"status":"ok"}` sem revelar
configuração. O Render só troca a versão ativa depois que o novo processo passa
no health check.

## 6. Smoke test após o deploy

Execute nesta ordem:

1. `/health` responde `200`;
2. login administrativo, F5 e logout;
3. admin, gerente e atendente acessam somente os módulos permitidos;
4. cadastrar e editar um cliente e um veículo de teste;
5. criar agendamento e conferir preço por porte;
6. iniciar e finalizar o atendimento;
7. conferir as mensagens de agendamento, início e finalização;
8. imprimir a ordem de serviço;
9. abrir `/?portal=true`, cadastrar e confirmar um e-mail de teste;
10. testar login, F5, logout e recuperação de senha no portal;
11. confirmar que dois clientes não enxergam dados um do outro;
12. conferir headers, console e rede sem segredos.

Não use dados reais no primeiro smoke test.

## 7. Rollback

Antes do go-live, anote o deploy aprovado anterior. Se o smoke test falhar:

1. Render → serviço → **Deploys**;
2. selecione o último deploy aprovado;
3. escolha **Rollback to this deploy**;
4. aguarde `/health` retornar `200`;
5. repita login, agenda e envio de uma mensagem de teste.

Para bloquear somente o Portal do Cliente sem derrubar o painel, altere
`VITE_ENABLE_CLIENT_PORTAL=false` e faça novo build/deploy. A variável é
incorporada na build, portanto apenas reiniciar não aplica essa mudança.

Rollback da aplicação não reverte banco, migrations, usuários do Auth ou
configuração SMTP. Qualquer mudança nesses itens exige procedimento próprio e
backup.
