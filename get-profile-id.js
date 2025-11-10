const https = require('https');

const CLIENT_ID = 'amzn1.application-oa2-client.1b1f4a1b2d464dfb97e22a3a9b3990d7';
const CLIENT_SECRET = 'amzn1.oa2-cs.v1.42a18a83d07ff2679b7e88c6b29e7271a1d83af357ee22b22d4891a793051db0';
const REFRESH_TOKEN = 'Atzr|IwEBIEHLiPH6wuX-oY9LaJdCZvQXSbMhbwWCnQlCQx86M6R_4bEC8PvDi-WWxCfFzUzoEtKlvqdMT2ODYhePhvzY1ehtre7nLAvye1fqBW6dA7V3fiMYuFB7cSCuxOu9KljrBi2vc9azBxr0PoQ2vPGs6QoG2-H8EdtbNc4w1WcElU-rb8pswZS1DyHPxt8MCmdA7lbGHuH_a9W2oN57-aMoBXUv9TyjaWmE3hJaT2mPPQIqtwQmRokTzTp4ac21c8kF5zDJnc_JURpW_5L-l1NX_T2gdKkH9ztr85Q43Suw-X2FMM_qnQjYaIdRTSTKxFYp0p2Z6G2c8d0SkulQIkDrUVlS2gIFY46aNX6p_H-oFDVWGaBO-jwBfUdy-mSRl8TI-m2K8iggKwj2Yeh7TeVeDN4d7VWN1vxDfw-DynmvJj-VGUMVgXrGE-cOVrlYx3wOHMzXgQq03BXHNJqtgxz0_pMGVo6wTrqCfAL2HGGyHJMFQSzMB-k3XeDrhmET2gmvbkoEo7mwT3vvVQ5eXB3wZNuH';

console.log('Step 1: Ottengo Access Token...\n');

const tokenData = JSON.stringify({
  grant_type: 'refresh_token',
  refresh_token: REFRESH_TOKEN,
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET
});

const tokenOptions = {
  hostname: 'api.amazon.com',
  path: '/auth/o2/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': tokenData.length
  }
};

const tokenReq = https.request(tokenOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      if (response.access_token) {
        console.log('Access Token ottenuto!\n');
        console.log('Step 2: Recupero profili...\n');
        getProfiles(response.access_token);
      } else {
        console.log('Errore:', JSON.stringify(response, null, 2));
      }
    } catch (e) {
      console.log('Errore:', data);
    }
  });
});

tokenReq.on('error', (e) => console.error(e));
tokenReq.write(tokenData);
tokenReq.end();

function getProfiles(accessToken) {
  const profileOptions = {
    hostname: 'advertising-api-eu.amazon.com',
    path: '/v2/profiles',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Amazon-Advertising-API-ClientId': CLIENT_ID,
      'Content-Type': 'application/json'
    }
  };

  const profileReq = https.request(profileOptions, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const profiles = JSON.parse(data);
        if (Array.isArray(profiles) && profiles.length > 0) {
          console.log('Trovati profili:\n');
          console.log('='.repeat(60));
          profiles.forEach((profile) => {
            console.log('\nProfile ID: ' + profile.profileId);
            console.log('Marketplace: ' + profile.countryCode);
            console.log('Valuta: ' + profile.currencyCode);
          });
          console.log('\n' + '='.repeat(60));
          console.log('\nUsa questo Profile ID: ' + profiles[0].profileId);
        } else {
          console.log('Risposta:', JSON.stringify(profiles, null, 2));
        }
      } catch (e) {
        console.log('Dati:', data);
      }
    });
  });

  profileReq.on('error', (e) => console.error(e));
  profileReq.end();
}
