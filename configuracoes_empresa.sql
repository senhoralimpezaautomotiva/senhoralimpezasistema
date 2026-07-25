-- =========================================================================
-- SCRIPT DE CRIAÇÃO DA TABELA CONFIGURACOES_EMPRESA (SUPABASE)
-- =========================================================================
-- Este script cria a tabela de configurações administrativas centralizadas,
-- permitindo a sincronização em tempo real entre todos os ambientes (e.g.,
-- Firebase Studio, portal do cliente, notebook e dispositivos móveis).

CREATE TABLE IF NOT EXISTS public.configuracoes_empresa (
    id UUID PRIMARY KEY DEFAULT 'c0000000-0000-0000-0000-000000000000'::uuid,
    company_name VARCHAR(255) DEFAULT 'Senhora Limpeza Estética Automotiva',
    phone VARCHAR(50) DEFAULT '(11) 99999-8888',
    email VARCHAR(100) DEFAULT 'contato@senhoralimpeza.com.br',
    cnpj VARCHAR(50) DEFAULT '45.123.789/0001-99',
    address TEXT DEFAULT 'Av. das Nações Unidas, 14205 - Brooklin Novo, São Paulo - SP',
    hours_of_operation TEXT DEFAULT 'Segunda a Sexta: 08:00 às 18:00 | Sábado: 08:00 às 14:00',
    logo_url TEXT DEFAULT 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=150&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    primary_color VARCHAR(50) DEFAULT '#0F172A',
    accent_color VARCHAR(50) DEFAULT '#0EA5E9',
    referral_active BOOLEAN DEFAULT TRUE,
    referral_discount_percent INTEGER DEFAULT 10,
    automations JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1. Habilitar o Row Level Security (RLS) para segurança no Supabase
ALTER TABLE public.configuracoes_empresa ENABLE ROW LEVEL SECURITY;

-- 2. A tabela contém somente configuração pública. A leitura pode ser feita
-- pelo cliente, mas nenhuma escrita anônima é criada neste script.
CREATE POLICY "configuracoes_empresa_select_public"
ON public.configuracoes_empresa
FOR SELECT
TO anon, authenticated
USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.configuracoes_empresa FROM anon;

-- 3. Inserção do registro inicial padrão com o ID fixado do sistema
INSERT INTO public.configuracoes_empresa (id) 
VALUES ('c0000000-0000-0000-0000-000000000000'::uuid) 
ON CONFLICT (id) DO NOTHING;

-- 4. Função e Gatilho para atualizar automaticamente o campo updated_at
CREATE OR REPLACE FUNCTION update_configuracoes_empresa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_configuracoes_empresa_updated_at
    BEFORE UPDATE ON public.configuracoes_empresa
    FOR EACH ROW
    EXECUTE FUNCTION update_configuracoes_empresa_updated_at();
