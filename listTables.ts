import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ansrnnydksrjwefnntaw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vbMMkzHsGfSd5Gyg_7zogg_YUIBB7gg';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  console.log('Fetching list of tables...');
  // We can select from information_schema.tables or some other pg_catalog views if they are exposed via PostgREST.
  // Wait, does PostgREST expose information_schema.tables by default? Usually not, unless it's in the API schema.
  // But let's try or query pg_catalog.pg_tables or similar.
  const { data, error } = await supabase.from('clientes').select('id').limit(1);
  console.log('Testing schema error messages or hints:');
  
  // Let's see if we can list all tables from a known view or if we can find any other tables.
  const candidateTables = [
    'clientes', 'veiculos', 'agendamentos', 'servicos_disponiveis', 'vehicle_models', 'servicos_precos'
  ];
  console.log('Candidates we know or suspect:', candidateTables);
}

main();
