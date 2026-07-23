const SUPABASE_URL = 'https://ansrnnydksrjwefnntaw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vbMMkzHsGfSd5Gyg_7zogg_YUIBB7gg';

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
