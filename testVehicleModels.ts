import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim() || '';
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Configuração Supabase ausente.');

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  console.log('Testing "vehicle_models" table existence...');
  const { data, error } = await supabase
    .from('vehicle_models')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error querying "vehicle_models":', error);
  } else {
    console.log('Success querying "vehicle_models"! Data:', data);
  }
}

main();
