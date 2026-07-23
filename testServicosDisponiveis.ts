import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ansrnnydksrjwefnntaw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vbMMkzHsGfSd5Gyg_7zogg_YUIBB7gg';

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
