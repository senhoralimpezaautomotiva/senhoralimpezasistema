import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ansrnnydksrjwefnntaw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vbMMkzHsGfSd5Gyg_7zogg_YUIBB7gg';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  console.log('Iniciando probe da tabela "agendamentos" com IDs reais de cliente, veículo e serviço...');
  
  const knownClientId = '1d7f5c76-7b8c-4687-89b5-750f6808f2f3';
  const knownVehicleId = '0b412500-8415-4976-8fac-e76723debfb5';
  const knownServiceId = '8350c53e-fa9b-4c1d-ba6b-d18198c7b94e'; // "Lavagem Completa"

  let payload: any = {
    cliente_id: knownClientId,
    veiculo_id: knownVehicleId,
    servico_id: knownServiceId,
    data_agendamento: '2026-07-15',
    hora_agendamento: '09:00:00'
  };

  const { data, error } = await supabase
    .from('agendamentos')
    .insert(payload)
    .select();

  if (error) {
    console.log('❌ Falha na inserção:', error.message);
    console.log('Detalhes do erro:', JSON.stringify(error, null, 2));
  } else {
    console.log('🎉 SUCESSO! Registro inserido com sucesso!');
    console.log('Colunas de "agendamentos":', Object.keys(data[0]));
    console.log('Registro inserido:', data[0]);

    // Deletar para limpar
    const { error: delError } = await supabase
      .from('agendamentos')
      .delete()
      .eq('id', data[0].id);

    if (delError) {
      console.log('⚠️ Falha ao limpar registro temporário:', delError.message);
    } else {
      console.log('✓ Registro temporário removido com sucesso.');
    }
  }
}

main();
