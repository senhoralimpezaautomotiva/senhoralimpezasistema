-- Noite 5: garante deduplicacao atomica da fila de automacoes.
--
-- A aplicacao ja trata a violacao 23505 como uma execucao duplicada ignorada.
-- O indice parcial preserva a possibilidade de registros sem chave, mas impede
-- duas execucoes com a mesma chave mesmo quando ciclos concorrentes tentam
-- inseri-las ao mesmo tempo.

create unique index if not exists automacoes_execucoes_deduplication_key_uidx
  on public.automacoes_execucoes (deduplication_key)
  where deduplication_key is not null;
