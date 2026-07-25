import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim() || '';
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Configuração Supabase ausente.');

const MORE_CANDIDATES = [
  'servico', 'service',
  'funcionario', 'funcionarios',
  'colaborador', 'colaboradores',
  'profissional', 'profissionais',
  'empresas', 'empresa',
  'atendimentos', 'atendimento'
];

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  console.log('Testando mais candidatos a tabelas...');

  for (const table of MORE_CANDIDATES) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact' })
      .limit(1);

    if (error) {
      if (!error.message.includes('does not exist') && error.code !== '42P01') {
        console.log(`ℹ️ Tabela "${table}" retornou erro (${error.code}): ${error.message}`);
      }
    } else {
      console.log(`✓ TABELA DETECTADA: "${table}" (total: ${count})`);
      if (data && data.length > 0) {
        console.log(`  Campos:`, Object.keys(data[0]));
        console.log(`  Amostra:`, data[0]);
      }
    }
  }
}

main();
