-- Garante que instalações com configuração parcial recebam as automações
-- imediatas obrigatórias. Entradas existentes são preservadas integralmente.
WITH defaults(item, position) AS (
    VALUES
        (
            jsonb_build_object(
                'id', 'at1',
                'name', 'Mensagem de Novo Cliente',
                'description', 'Envia mensagem de boas-vindas ao cadastrar um novo cliente.',
                'event', 'novo_cliente',
                'isActive', true,
                'template', 'Olá, *{nome}*! É um grande prazer ter você como cliente da Senhora Limpeza Estética Automotiva. 🚗✨ Cadastramos seu contato com sucesso e estamos à disposição para deixar seu veículo impecável!'
            ),
            1
        ),
        (
            jsonb_build_object(
                'id', 'at2',
                'name', 'Confirmação de Agendamento',
                'description', 'Envia confirmação imediata quando um agendamento é criado.',
                'event', 'novo_agendamento',
                'isActive', true,
                'template', E'Olá, *{nome}*! Confirmamos seu agendamento para o veículo *{veiculo}* em nosso espaço.\n\n📅 *Data/Hora:* {data_hora}\n🛠️ *Serviço:* {servico}\n💰 *Valor:* R$ {valor}\n\nTe aguardamos no endereço cadastrado.'
            ),
            2
        ),
        (
            jsonb_build_object(
                'id', 'at_servico_iniciado',
                'name', 'Serviço Iniciado',
                'description', 'Envia notificação quando o veículo entra em processo de limpeza/estética.',
                'event', 'servico_iniciado',
                'isActive', true,
                'template', E'Olá, *{nome}*! O serviço de *{servico}* no seu *{veiculo}* foi iniciado. 🛠️🚗✨\n\nAcompanhamos cada detalhe com o máximo cuidado. Notificaremos você assim que o veículo estiver pronto!'
            ),
            3
        ),
        (
            jsonb_build_object(
                'id', 'at3',
                'name', 'Serviço Finalizado / Retirada',
                'description', 'Notifica que o serviço terminou e o carro está pronto para retirada.',
                'event', 'servico_finalizado',
                'isActive', true,
                'template', 'Excelente notícia, *{nome}*! O serviço de *{servico}* no seu *{veiculo}* foi finalizado. O veículo ficou espetacular e já está pronto para retirada! 🧼🚗✨'
            ),
            4
        )
),
missing AS (
    SELECT defaults.item, defaults.position
    FROM defaults
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.configuracoes_empresa AS config,
             jsonb_array_elements(
                 CASE
                     WHEN jsonb_typeof(config.automations) = 'array'
                         THEN config.automations
                     ELSE '[]'::jsonb
                 END
             ) AS existing(item)
        WHERE config.id = 'c0000000-0000-0000-0000-000000000000'::uuid
          AND existing.item->>'event' = defaults.item->>'event'
    )
),
missing_array AS (
    SELECT coalesce(jsonb_agg(item ORDER BY position), '[]'::jsonb) AS items
    FROM missing
)
UPDATE public.configuracoes_empresa AS config
SET automations = (
        CASE
            WHEN jsonb_typeof(config.automations) = 'array'
                THEN config.automations
            ELSE '[]'::jsonb
        END
    ) || missing_array.items,
    updated_at = now()
FROM missing_array
WHERE config.id = 'c0000000-0000-0000-0000-000000000000'::uuid
  AND jsonb_array_length(missing_array.items) > 0;

