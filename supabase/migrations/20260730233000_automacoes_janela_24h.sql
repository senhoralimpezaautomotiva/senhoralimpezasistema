BEGIN;

ALTER TABLE public.configuracoes_empresa
    ADD COLUMN IF NOT EXISTS automation_start_hour TEXT NOT NULL DEFAULT '08:00',
    ADD COLUMN IF NOT EXISTS automation_end_hour TEXT NOT NULL DEFAULT '20:00',
    ADD COLUMN IF NOT EXISTS automation_24_hours BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.configuracoes_empresa
    DROP CONSTRAINT IF EXISTS configuracoes_empresa_automation_start_hour_format,
    DROP CONSTRAINT IF EXISTS configuracoes_empresa_automation_end_hour_format;

ALTER TABLE public.configuracoes_empresa
    ADD CONSTRAINT configuracoes_empresa_automation_start_hour_format
        CHECK (automation_start_hour ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
    ADD CONSTRAINT configuracoes_empresa_automation_end_hour_format
        CHECK (automation_end_hour ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$');

COMMIT;
