BEGIN;

ALTER TABLE public.configuracoes_empresa
    ADD COLUMN IF NOT EXISTS reminder_advance_hours INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.configuracoes_empresa
    DROP CONSTRAINT IF EXISTS configuracoes_empresa_reminder_advance_hours_range;

ALTER TABLE public.configuracoes_empresa
    ADD CONSTRAINT configuracoes_empresa_reminder_advance_hours_range
        CHECK (reminder_advance_hours BETWEEN 1 AND 168);

COMMIT;
