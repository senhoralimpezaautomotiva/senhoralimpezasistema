\set ON_ERROR_STOP on

INSERT INTO public.clientes (id, nome, telefone)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'Legado', '5511999990001'),
    ('10000000-0000-0000-0000-000000000002', 'Sucesso', '5511999990002');

INSERT INTO public.agendamentos (id, cliente_id, status)
VALUES
    (
        '20000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'Finalizado'
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000002',
        'Finalizado'
    );

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
VALUES
    (
        '30000000-0000-0000-0000-000000000001',
        'servico_finalizado',
        '20000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        '5511999990001',
        '',
        'pendente',
        0,
        now(),
        NULL
    ),
    (
        '30000000-0000-0000-0000-000000000002',
        'pagamento_recebido',
        '20000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        '5511999990001',
        '',
        'pendente',
        0,
        now(),
        NULL
    ),
    (
        '30000000-0000-0000-0000-000000000003',
        'novo_agendamento',
        '20000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000002',
        '5511999990002',
        'Mensagem já enviada',
        'sucesso',
        1,
        now(),
        NULL
    ),
    (
        '30000000-0000-0000-0000-000000000004',
        'novo_agendamento',
        '20000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000002',
        '5511999990002',
        'Duplicada pendente',
        'pendente',
        0,
        now(),
        NULL
    );
