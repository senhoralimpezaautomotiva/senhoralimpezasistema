# E-mails do Supabase Auth para o Portal do Cliente

Este documento separa o que esta implementado no codigo da aplicacao e o que
precisa ser configurado manualmente no painel do Supabase.

## Codigo da aplicacao

- A tela de recuperacao do Portal solicita o e-mail do cliente e chama
  `resetPasswordForEmail`.
- O link de recuperacao redireciona para:
  `https://<dominio-da-aplicacao>/?portal=true&recovery=true`.
- Quando o Supabase valida o token do link, o Portal abre a tela
  `Redefinir senha`.
- A nova senha usa a mesma validacao ja existente no Portal:
  - minimo de 8 caracteres;
  - pelo menos uma letra maiuscula;
  - pelo menos uma letra minuscula;
  - pelo menos um numero.
- Depois de redefinir a senha por token de recuperacao, o Portal encerra a
  sessao tecnica criada pelo Supabase e volta para o login com mensagem de
  sucesso em portugues.
- A troca obrigatoria de senha marcada por `force_password_change` continua
  separada: ela limpa a flag pela Edge Function existente e libera o Portal sem
  mudar a regra ja validada.

## Configuracao obrigatoria no Supabase

Estas etapas devem ser feitas no painel do Supabase, sem alterar codigo:

1. Acesse **Authentication > URL Configuration**.
2. Configure **Site URL** com a URL publica da aplicacao.
3. Em **Redirect URLs**, inclua exatamente:
   - `https://<dominio-da-aplicacao>/?portal=true`
   - `https://<dominio-da-aplicacao>/?portal=true&recovery=true`
4. Acesse **Authentication > SMTP Settings**.
5. Configure o remetente com:
   - **Sender name:** `Senhora Limpeza Estetica Automotiva`
   - **Sender email:** e-mail verificado no provedor SMTP do dominio.
6. Acesse **Authentication > Email Templates > Reset Password**.
7. Configure o assunto:

```text
Redefina sua senha - Senhora Limpeza Estetica Automotiva
```

8. Configure o conteudo do e-mail em portugues. Modelo sugerido:

```html
<h2>Redefinicao de senha</h2>

<p>Ola,</p>

<p>Recebemos uma solicitacao para redefinir a senha do seu acesso ao Portal do Cliente da Senhora Limpeza Estetica Automotiva.</p>

<p>Para criar uma nova senha, clique no botao abaixo:</p>

<p>
  <a href="{{ .ConfirmationURL }}">Redefinir minha senha</a>
</p>

<p>Se voce nao solicitou esta alteracao, ignore este e-mail. Sua senha atual continuara valida.</p>

<p>Atenciosamente,<br>Senhora Limpeza Estetica Automotiva</p>
```

## Observacoes de seguranca

- Nao publique a senha SMTP no reposititorio nem nas variaveis publicas do
  frontend.
- O link `{{ .ConfirmationURL }}` deve ser mantido no template, pois e ele que
  carrega o token seguro gerado pelo Supabase.
- Nao aplique esta configuracao sem validar previamente o dominio, SPF, DKIM e
  DMARC do remetente.
