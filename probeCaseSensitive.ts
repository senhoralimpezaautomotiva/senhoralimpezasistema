import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ansrnnydksrjwefnntaw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vbMMkzHsGfSd5Gyg_7zogg_YUIBB7gg';

const CASES = [
  'Servicos', 'Servico', 'Services', 'Service',
  'Clientes', 'Veiculos', 'Agendamentos',
  'SERVICOS', 'SERVICO', 'SERVICES', 'SERVICE',
  'CLIENTES', 'VEICULOS', 'AGENDAMENTOS'
];

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  console.log('Testando nomes de tabelas com sensitividade a maiúsculas/minúsculas...');

  for (const table of CASES) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact' })
      .limit(1);

    if (error) {
      if (!error.message.includes('does not exist') && error.code !== '42P01') {
        console.log(`ℹ️ Tabela "${table}" retornou erro (${error.code}): ${error.message}`);
      }
    } else {
      console.log(`✓ TABELA ENCONTRADA: "${table}" (total: ${count})`);
      if (data && data.length > 0) {
        console.log(`  Campos:`, Object.keys(data[0]));
      }
    }
  }
}

main();
