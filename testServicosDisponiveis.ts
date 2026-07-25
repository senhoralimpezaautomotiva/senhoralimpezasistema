import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim() || '';
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Configuração Supabase ausente.');

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  console.log('Consultando a tabela "servicos_disponiveis"...');
  const { data, error, count } = await supabase
    .from('servicos_disponiveis')
    .select('*', { count: 'exact' });

  if (error) {
    console.log('Erro ao ler "servicos_disponiveis":', error.message);
  } else {
    console.log('✓ SUCESSO!');
    console.log('Total de registros:', count);
    if (data && data.length > 0) {
      console.log('Colunas de "servicos_disponiveis":', Object.keys(data[0]));
      console.log('Registros encontrados:', JSON.stringify(data, null, 2));
    } else {
      console.log('Tabela está vazia.');
    }
  }
}

main();
