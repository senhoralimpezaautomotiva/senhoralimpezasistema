\set ON_ERROR_STOP on

DELETE FROM public.automacoes_execucoes
WHERE id = '30000000-0000-0000-0000-000000000099';

INSERT INTO public.automacoes_execucoes (
    id,
    automacao,
    appointment_id,
    customer_id,
    telefone,
    mensagem,
    status,
    tentativas,
    data_execucao,
    deduplication_key
)
VALUES (
    '30000000-0000-0000-0000-000000000099',
    'servico_finalizado',
    '20000000-0000-0000-0000-000000000020',
    '10000000-0000-0000-0000-000000000020',
    '5511999990020',
    'Mensagem de claim',
    'pendente',
    0,
    now() - interval '1 minute',
    'claim:two-workers'
);
