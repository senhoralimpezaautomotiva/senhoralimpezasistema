BEGIN;

ALTER TABLE public.configuracoes_empresa
    ADD COLUMN IF NOT EXISTS reminder_advance_hours INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.configuracoes_empresa
    DROP CONSTRAINT IF EXISTS configuracoes_empresa_reminder_advance_hours_range;

ALTER TABLE public.configuracoes_empresa
    ADD CONSTRAINT configuracoes_empresa_reminder_advance_hours_range
        CHECK (reminder_advance_hours BETWEEN 1 AND 168);

UPDATE public.configuracoes_empresa AS config
SET automations = (
        CASE
            WHEN jsonb_typeof(config.automations) = 'array'
                THEN config.automations
            ELSE '[]'::jsonb
        END
    ) || jsonb_build_array(
        jsonb_build_object(
            'id', 'at_lembrete_agendamento',
            'name', 'Lembrete de Agendamento',
            'description', 'Envia uma mensagem automatica com a antecedencia configurada para o lembrete.',
            'event', 'lembrete_agendamento',
            'isActive', true,
            'template', 'Ola, *{nome}*! Passando para lembrar que seu agendamento esta marcado para *{data_hora}* com o veiculo *{veiculo}* (Servico: *{servico}*). Estamos te aguardando!'
        )
    ),
    updated_at = now()
WHERE config.id = 'c0000000-0000-0000-0000-000000000000'::uuid
  AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
          CASE
              WHEN jsonb_typeof(config.automations) = 'array'
                  THEN config.automations
              ELSE '[]'::jsonb
          END
      ) AS existing(item)
      WHERE existing.item->>'event' = 'lembrete_agendamento'
  );

COMMIT;
