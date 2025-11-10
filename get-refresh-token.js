const https = require('https');

const CLIENT_ID = 'amzn1.application-oa2-client.1b1f4a1b2d464dfb97e22a3a9b3990d7';
const CLIENT_SECRET = 'amzn1.oa2-cs.v1.42a18a83d07ff2679b7e88c6b29e7271a1d83af357ee22b22d4891a793051db0';
const AUTHORIZATION_CODE = 'ANwYSijKDvzCLGLCzCiy';
const REDIRECT_URI = 'https://localhost:3000/auth/callback';

const postData = JSON.stringify({
  grant_type: 'authorization_code',
  code: AUTHORIZATION_CODE,
  redirect_uri: REDIRECT_URI,
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET
});

const options = {
  hostname: 'api.amazon.com',
  path: '/auth/o2/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': postData.length
  }
};

console.log('🔄 Richiesta Refresh Token...\n');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      if (response.refresh_token) {
        console.log('✅ Refresh Token:\n');
        console.log(response.refresh_token);
      } else {
        console.log('❌ Errore:', JSON.stringify(response, null, 2));
      }
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (e) => console.error(e));
req.write(postData);
req.end();
