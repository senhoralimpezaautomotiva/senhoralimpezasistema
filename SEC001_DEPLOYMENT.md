# SEC001 — implantação e rotação de credenciais

Este procedimento evita interrupção dos disparos durante a retirada das
credenciais do frontend. Nenhum valor real deve ser registrado neste arquivo,
em commits, tickets ou logs.

## Ordem obrigatória

1. Criar novos tokens na Z-API e um novo webhook no Make.com, mantendo os
   valores anteriores ativos durante a transição.
2. Cadastrar `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN` e
   `MAKE_WEBHOOK_URL` no gerenciador de segredos do ambiente do servidor.
3. Publicar esta versão e confirmar que o processo do servidor recebeu as
   variáveis sem imprimir seus valores.
4. Executar um teste manual de automação e confirmar o recebimento no provedor.
   Os logs da aplicação devem mostrar somente o canal e o código HTTP.
5. Aplicar `supabase_usuarios_rls_migration.sql` caso a função
   `public.is_active_usuario_admin()` ainda não exista.
6. Aplicar `supabase_sec001_credentials_migration.sql`. A migração remove as
   colunas privadas, fecha a escrita pública e exclui o fallback legado em
   `clientes`.
7. Abrir o sistema em um navegador que já tenha usado a versão anterior e
   confirmar a remoção de `sl_admin_password`, `sl_config`, `sl_logs` e
   `sl_executions`, além da sanitização de `sl_config_cache`.
8. Revogar os tokens antigos da Z-API e o webhook antigo do Make.com.
9. Invalidar artefatos antigos publicados (bundles, mapas de código-fonte,
   arquivos ZIP e caches de CDN) e publicar somente o build atual.
10. Revisar os logs históricos dos provedores e da hospedagem conforme a
    política de retenção da empresa.

## Validações mínimas

- O bundle do navegador não contém `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`,
  `ZAPI_INSTANCE_ID` ou `MAKE_WEBHOOK_URL`.
- A tabela `configuracoes_empresa` não contém colunas de integração.
- Uma chamada anônima não consegue inserir ou atualizar
  `configuracoes_empresa`.
- Um administrador autenticado consegue salvar configurações públicas.
- Uma automação real chega ao provedor e seus logs não incluem URL, token,
  telefone completo, mensagem completa ou corpo de resposta.
- A senha administrativa é alterada exclusivamente pelo Supabase Auth.

## Contingência

Se o teste do passo 4 falhar, manter os tokens antigos ativos, restaurar as
variáveis do ambiente do servidor e repetir o teste. Não executar a migração
do banco nem revogar as credenciais anteriores antes de o envio pelo servidor
estar confirmado.
