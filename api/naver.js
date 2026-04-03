const https = require('https');

function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const options = { hostname, port: 443, path, method: 'GET', headers };
    const r = https.request(options, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve({ error: data }); } });
    });
    r.on('error', reject); r.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { clientId, clientSecret, query } = req.body || {};
  const id = clientId || process.env.NAVER_CLIENT_ID;
  const secret = clientSecret || process.env.NAVER_CLIENT_SECRET;

  if (!id || !secret) {
    res.status(400).json({ error: '네이버 API 키 없음' }); return;
  }
  try {
    const result = await httpsGet(
      'openapi.naver.com',
      '/v1/search/news.json?query=' + encodeURIComponent(query) + '&display=5&sort=date',
      { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret }
    );
    res.status(200).json(result);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
