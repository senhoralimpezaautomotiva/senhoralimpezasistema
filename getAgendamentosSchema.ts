const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim() || '';
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Configuração Supabase ausente.');

async function main() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/agendamentos`, {
      method: 'OPTIONS', // OPTIONS often returns column list in headers or body
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    console.log('--- OPTIONS Response ---');
    console.log('Status:', response.status);
    console.log('Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
    const text = await response.text();
    console.log('Body:', text);

    // Try GET with Accept: application/schema+json
    const responseGet = await fetch(`${SUPABASE_URL}/rest/v1/agendamentos`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Accept': 'application/schema+json'
      }
    });

    console.log('\n--- GET Schema Response ---');
    console.log('Status:', responseGet.status);
    const textGet = await responseGet.text();
    console.log('Body:', textGet);

  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

main();
