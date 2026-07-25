# Fonte oficial de migrações

Este diretório é a única fonte autorizada para novas migrações do banco.

Situação em 2026-07-24: o projeto remoto foi vinculado pela Supabase CLI, o
backup lógico real foi validado e o schema `public` remoto foi capturado em
`20260724210000_baseline.sql`. O hash do arquivo coincide com o dump de schema
do backup: `5711d33afa372243ee63d41f36379f3a75d465a8f5e969ae4b032fdac2df9fad`.

A baseline não contém dados de negócio. O ensaio de restauração local permanece
pendente por indisponibilidade de espaço para o ambiente Docker isolado.

O primeiro arquivo oficial é `20260724210000_baseline.sql`. No projeto de
origem, essa versão deve ser registrada como aplicada, sem executar novamente
o DDL que já representa o estado existente.

Ele somente poderá ser criado após estes gates:

1. backup lógico de roles, schema e dados gerado e verificado;
2. catálogo remoto coletado por conexão de banco somente leitura;
3. divergências locais revisadas;
4. baseline gerada por `supabase db pull`, revisada linha a linha;
5. recriação limpa validada localmente com `supabase db reset`;
6. comparação sem drift relevante contra o banco de origem;
7. aprovação técnica registrada.

Regras permanentes:

- nomes seguem `YYYYMMDD_NNNNNN_descricao.sql`;
- a ordenação lexicográfica é a ordem de execução;
- uma migração aplicada nunca é editada;
- correções são novas migrações;
- produção recebe apenas `supabase db push --dry-run` revisado e depois
  `supabase db push`;
- `supabase db reset --linked` é proibido em produção;
- SQL Editor e alterações manuais no Dashboard não são fluxo de implantação;
- scripts diagnósticos, seeds com dados reais e dumps não entram neste
  diretório;
- nenhuma credencial, PII ou dado de produção é versionado.

Consulte `docs/database/DB001_BASELINE.md` para o procedimento completo.
