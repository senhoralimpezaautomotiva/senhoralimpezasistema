-- ==========================================
-- SCRIPT DE CRIAÇÃO DA TABELA VEHICLE_MODELS
-- ==========================================
-- Esta tabela serve como referência de fabricantes e modelos de veículos,
-- integrando o cálculo automático de porte (P, M, G) para serviços de Estética Automotiva.

-- 1. Criação da tabela vehicle_models
CREATE TABLE IF NOT EXISTS public.vehicle_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturer VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL DEFAULT '',
    size_category VARCHAR(1) NOT NULL CHECK (size_category IN ('P', 'M', 'G')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Restrição única para evitar duplicidades de modelos do mesmo fabricante
    CONSTRAINT unique_manufacturer_model UNIQUE (manufacturer, model)
);

-- 2. Habilitar o Row Level Security (RLS) para segurança no Supabase
ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;

-- 3. Criação de políticas de acesso (Políticas RLS)
-- Permitir leitura pública (tanto para o admin quanto para o portal do cliente logado/deslogado)
CREATE POLICY "Permitir leitura para todos os usuários" 
ON public.vehicle_models 
FOR SELECT 
USING (true);

-- Permitir controle total (inserção, atualização, exclusão) para usuários administradores/autenticados
CREATE POLICY "Permitir controle total para usuários autenticados" 
ON public.vehicle_models 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 4. Função e Gatilho para atualizar automaticamente o campo updated_at
CREATE OR REPLACE FUNCTION update_vehicle_models_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_vehicle_models_updated_at
    BEFORE UPDATE ON public.vehicle_models
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicle_models_updated_at();

-- 5. Inserção em lote dos fabricantes e modelos padrão
INSERT INTO public.vehicle_models (manufacturer, model, size_category, active) VALUES
-- Fiat
('Fiat', 'Uno', 'P', TRUE),
('Fiat', 'Mobi', 'P', TRUE),
('Fiat', 'Argo', 'P', TRUE),
('Fiat', 'Palio', 'P', TRUE),
('Fiat', 'Siena', 'M', TRUE),
('Fiat', 'Grand Siena', 'M', TRUE),
('Fiat', 'Cronos', 'M', TRUE),
('Fiat', 'Palio Weekend', 'M', TRUE),
('Fiat', 'Punto', 'P', TRUE),
('Fiat', 'Idea', 'M', TRUE),
('Fiat', 'Doblò', 'G', TRUE),
('Fiat', 'Fiorino', 'G', TRUE),
('Fiat', 'Strada', 'G', TRUE),
('Fiat', 'Toro', 'G', TRUE),
('Fiat', 'Pulse', 'M', TRUE),
('Fiat', 'Fastback', 'M', TRUE),
('Fiat', 'Freemont', 'G', TRUE),

-- Volkswagen
('Volkswagen', 'Gol', 'P', TRUE),
('Volkswagen', 'Voyage', 'M', TRUE),
('Volkswagen', 'Fox', 'P', TRUE),
('Volkswagen', 'Up', 'P', TRUE),
('Volkswagen', 'Polo Hatch', 'P', TRUE),
('Volkswagen', 'Polo Sedan', 'M', TRUE),
('Volkswagen', 'Virtus', 'M', TRUE),
('Volkswagen', 'Saveiro', 'G', TRUE),
('Volkswagen', 'Parati', 'M', TRUE),
('Volkswagen', 'CrossFox', 'M', TRUE),
('Volkswagen', 'SpaceFox', 'M', TRUE),
('Volkswagen', 'Golf', 'M', TRUE),
('Volkswagen', 'Bora', 'M', TRUE),
('Volkswagen', 'Jetta', 'M', TRUE),
('Volkswagen', 'Passat', 'M', TRUE),
('Volkswagen', 'Nivus', 'M', TRUE),
('Volkswagen', 'T-Cross', 'M', TRUE),
('Volkswagen', 'Taos', 'G', TRUE),
('Volkswagen', 'Tiguan', 'G', TRUE),
('Volkswagen', 'Touareg', 'G', TRUE),

-- Chevrolet
('Chevrolet', 'Celta', 'P', TRUE),
('Chevrolet', 'Classic', 'M', TRUE),
('Chevrolet', 'Corsa Hatch', 'P', TRUE),
('Chevrolet', 'Corsa Sedan', 'M', TRUE),
('Chevrolet', 'Corsa Wagon', 'M', TRUE),
('Chevrolet', 'Prisma', 'M', TRUE),
('Chevrolet', 'Onix Hatch', 'P', TRUE),
('Chevrolet', 'Onix Plus', 'M', TRUE),
('Chevrolet', 'Agile', 'M', TRUE),
('Chevrolet', 'Sonic Hatch', 'P', TRUE),
('Chevrolet', 'Sonic Sedan', 'M', TRUE),
('Chevrolet', 'Cruze Hatch', 'M', TRUE),
('Chevrolet', 'Cruze Sedan', 'M', TRUE),
('Chevrolet', 'Vectra', 'M', TRUE),
('Chevrolet', 'Astra', 'M', TRUE),
('Chevrolet', 'Meriva', 'M', TRUE),
('Chevrolet', 'Zafira', 'G', TRUE),
('Chevrolet', 'Spin', 'G', TRUE),
('Chevrolet', 'Tracker', 'M', TRUE),
('Chevrolet', 'Captiva', 'G', TRUE),
('Chevrolet', 'Equinox', 'G', TRUE),
('Chevrolet', 'Trailblazer', 'G', TRUE),
('Chevrolet', 'Montana', 'G', TRUE),
('Chevrolet', 'S10', 'G', TRUE),
('Chevrolet', 'Blazer', 'G', TRUE),

-- Ford
('Ford', 'Ka Hatch', 'P', TRUE),
('Ford', 'Ka Sedan', 'M', TRUE),
('Ford', 'Fiesta Hatch', 'P', TRUE),
('Ford', 'Fiesta Sedan', 'M', TRUE),
('Ford', 'EcoSport', 'M', TRUE),
('Ford', 'Focus Hatch', 'M', TRUE),
('Ford', 'Focus Sedan', 'M', TRUE),
('Ford', 'Fusion', 'G', TRUE),
('Ford', 'Escort', 'M', TRUE),
('Ford', 'Verona', 'M', TRUE),
('Ford', 'Del Rey', 'M', TRUE),
('Ford', 'Corcel', 'M', TRUE),
('Ford', 'Belina', 'M', TRUE),
('Ford', 'Pampa', 'G', TRUE),
('Ford', 'Courier', 'G', TRUE),
('Ford', 'Ranger', 'G', TRUE),
('Ford', 'Maverick', 'G', TRUE),
('Ford', 'Territory', 'G', TRUE),
('Ford', 'Edge', 'G', TRUE),
('Ford', 'Explorer', 'G', TRUE),

-- Jeep
('Jeep', 'Renegade', 'M', TRUE),
('Jeep', 'Compass', 'G', TRUE),
('Jeep', 'Commander', 'G', TRUE),
('Jeep', 'Cherokee', 'G', TRUE),
('Jeep', 'Grand Cherokee', 'G', TRUE),
('Jeep', 'Wrangler 2 Portas', 'G', TRUE),
('Jeep', 'Wrangler 4 Portas', 'G', TRUE),
('Jeep', 'Gladiator', 'G', TRUE),

-- Toyota
('Toyota', 'Etios Hatch', 'P', TRUE),
('Toyota', 'Etios Sedan', 'M', TRUE),
('Toyota', 'Yaris Hatch', 'P', TRUE),
('Toyota', 'Yaris Sedan', 'M', TRUE),
('Toyota', 'Corolla', 'M', TRUE),
('Toyota', 'Corolla Cross', 'G', TRUE),
('Toyota', 'RAV4', 'G', TRUE),
('Toyota', 'SW4', 'G', TRUE),
('Toyota', 'Hilux Cabine Simples', 'G', TRUE),
('Toyota', 'Hilux Cabine Dupla', 'G', TRUE),
('Toyota', 'Bandeirante', 'G', TRUE),

-- Honda
('Honda', 'Fit', 'M', TRUE),
('Honda', 'City Hatch', 'P', TRUE),
('Honda', 'City Sedan', 'M', TRUE),
('Honda', 'Civic Hatch', 'M', TRUE),
('Honda', 'Civic Sedan', 'M', TRUE),
('Honda', 'Accord', 'G', TRUE),
('Honda', 'WR-V', 'M', TRUE),
('Honda', 'HR-V', 'M', TRUE),
('Honda', 'ZR-V', 'G', TRUE),
('Honda', 'CR-V', 'G', TRUE),
('Honda', 'Passport', 'G', TRUE),
('Honda', 'Pilot', 'G', TRUE),

-- Fabricantes adicionais pré-registrados sem modelos iniciais
('BMW', '', 'M', TRUE),
('Mercedes-Benz', '', 'M', TRUE),
('Volvo', '', 'M', TRUE)
ON CONFLICT (manufacturer, model) DO NOTHING;
