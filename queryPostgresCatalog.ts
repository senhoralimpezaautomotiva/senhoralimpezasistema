import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim() || '';
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Configuração Supabase ausente.');

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  console.log('Testando consultas a catálogos do Postgres...');

  const endpoints = [
    'information_schema.table_constraints',
    'information_schema.key_column_usage',
    'information_schema.referential_constraints',
    'pg_catalog.pg_constraint',
    'pg_constraint',
    'key_column_usage',
    'referential_constraints'
  ];

  for (const endpoint of endpoints) {
    try {
      const { data, error } = await supabase
        .from(endpoint)
        .select('*')
        .limit(1);

      if (error) {
        // console.log(`Erro no endpoint "${endpoint}": ${error.message}`);
      } else {
        console.log(`✓ SUCESSO no endpoint "${endpoint}"!`);
        console.log('Amostra:', data);
      }
    } catch (e: any) {
      // ignore
    }
  }
}

main();
