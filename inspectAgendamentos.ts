/**
 * Fetch OpenAPI with full headers
 */
const SUPABASE_URL = 'https://ansrnnydksrjwefnntaw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vbMMkzHsGfSd5Gyg_7zogg_YUIBB7gg';

async function main() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const spec = await response.json();
    console.log('✓ OpenAPI spec recebida com sucesso!');
    
    const definitions = spec.definitions || {};
    
    // Let's print definitions for 'clientes', 'veiculos', and 'agendamentos'
    const targetTables = ['clientes', 'veiculos', 'agendamentos'];
    
    for (const table of targetTables) {
      const def = definitions[table];
      if (def) {
        console.log(`\n========================================`);
        console.log(`Definição da tabela: "${table}"`);
        console.log(`Descrição: ${def.description || 'Sem descrição'}`);
        console.log(`Campos:`);
        for (const [propName, propVal] of Object.entries<any>(def.properties)) {
          const required = def.required?.includes(propName) ? 'REQUIRED' : 'OPTIONAL';
          console.log(`  - ${propName} (${propVal.type}${propVal.format ? `:${propVal.format}` : ''}) [${required}] - ${propVal.description || ''}`);
        }
      } else {
        console.log(`Tabela "${table}" não encontrada no OpenAPI spec.`);
      }
    }
  } catch (err: any) {
    console.error('Erro ao buscar OpenAPI spec:', err.message);
  }
}

main();
