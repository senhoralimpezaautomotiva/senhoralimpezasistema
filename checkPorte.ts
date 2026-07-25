import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim() || '';
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Configuração Supabase ausente.');

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  // Query to get the check constraints in postgres
  const { data, error } = await supabase.rpc('get_check_constraints', {});
  void data;
  
  if (error) {
    console.log('RPC check failed, executing standard query on pg_constraint...');
    // We can run a direct SQL if there is an rpc, or we can fetch a few records, or insert various values.
    // Let's try inserting different porte values or look at pg_constraint if we have access,
    // but we can also just run a simple select on pg_catalog or query using a custom supabase query.
  }

  // Let's select check constraints using postgres information schema if we can
  const { data: constraints, error: errC } = await supabase.from('pg_constraint').select('*').limit(10);
  console.log('pg_constraint:', constraints, errC);

  // If we can't query system tables directly because of security rules, let's try to query an error message!
  // We can try to insert a wrong porte to see what the constraint error message says, or see if there is any other way.
  // Wait, let's try inserting different values like 'Pequeno', 'Medio', 'Grande', 'Hatch', 'Sedan', 'SUV'
  const values = ['Pequeno', 'Médio', 'Grande', 'Hatch', 'Sedan', 'SUV', 'MÉDIO', 'PEQUENO', 'GRANDE'];
  for (const val of values) {
    const { error } = await supabase.from('veiculos').insert({
      id: '00000000-0000-0000-0000-000000000000',
      cliente_id: '1d7f5c76-7b8c-4687-89b5-750f6808f2f3',
      placa: 'AAA0A00',
      modelo: 'Test',
      marca: 'Test',
      cor: 'Preto',
      porte: val
    });
    if (error) {
      console.log(`Value "${val}" failed:`, error.message);
    } else {
      console.log(`Value "${val}" SUCCESS!`);
      // Clean up
      await supabase.from('veiculos').delete().eq('id', '00000000-0000-0000-0000-000000000000');
    }
  }
}

main();
