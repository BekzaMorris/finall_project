const base = 'http://localhost:4000';
const email = `itop-test+${Date.now()}@example.com`;
const password = 'TestPass1';

async function run() {
  try {
    console.log('Registering user:', email);
    let res = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'ITOP Test' }),
    });
    const regText = await res.text();
    console.log('Register response:', regText);

    console.log('Logging in...');
    res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const loginJson = await res.json();
    console.log('Login response:', JSON.stringify(loginJson, null, 2));

    const token = loginJson?.tokens?.accessToken;
    if (!token) {
      console.error('No access token in login response, aborting.');
      process.exit(1);
    }

    console.log('Creating ticket in API (should trigger iTop call)');
    res = await fetch(`${base}/api/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subject: 'ITOP integration test', message: 'Automated test ticket', priority: 'MEDIUM' }),
    });

    const ticketJson = await res.json();
    console.log('Create ticket response:', JSON.stringify(ticketJson, null, 2));
    console.log('Done. Check API logs for iTop output.');
  } catch (err) {
    console.error('Error during test:', err);
    process.exit(1);
  }
}

run();
