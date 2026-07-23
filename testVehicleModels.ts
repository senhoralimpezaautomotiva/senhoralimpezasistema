import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ansrnnydksrjwefnntaw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vbMMkzHsGfSd5Gyg_7zogg_YUIBB7gg';

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
