import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim() || '';
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Configuração Supabase ausente.');

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  console.log('Testando inserção na tabela agendamentos...');
  const { data, error } = await supabase
    .from('agendamentos')
    .insert({
      id_inexistente_teste: 'teste'
    } as any)
    .select();

  if (error) {
    console.log('Mensagem de erro recebida (isto é esperado e útil):');
    console.log(JSON.stringify(error, null, 2));
  } else {
    console.log('Inserção bem-sucedida? Data:', data);
  }
}

main();
