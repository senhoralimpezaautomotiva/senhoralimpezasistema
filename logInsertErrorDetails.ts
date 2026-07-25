import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim() || '';
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Configuração Supabase ausente.');

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  const knownClientId = '1d7f5c76-7b8c-4687-89b5-750f6808f2f3';
  const knownVehicleId = '0b412500-8415-4976-8fac-e76723debfb5';
  const dummyUUID = '00000000-0000-0000-0000-000000000000';

  const { error } = await supabase
    .from('agendamentos')
    .insert({
      cliente_id: knownClientId,
      veiculo_id: knownVehicleId,
      servico_id: dummyUUID,
      data_agendamento: '2026-07-15',
      hora_agendamento: '09:00:00'
    })
    .select();

  if (error) {
    console.log('--- OBJETO DE ERRO COMPLETO ---');
    console.log(JSON.stringify(error, null, 2));
  } else {
    console.log('Inserção funcionou!');
  }
}

main();
