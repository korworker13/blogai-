const https = require('https');

function httpsPost(hostname, path, headers, postData) {
  return new Promise((resolve, reject) => {
    const options = { hostname, port: 443, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData), ...headers } };
    const r = https.request(options, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve({ error: data }); } });
    });
    r.on('error', reject); r.write(postData); r.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { apiKey, prompt } = req.body || {};
  const key = apiKey || process.env.GEMINI_API_KEY;

  if (!key) { res.status(400).json({ error: 'Gemini API 키 없음' }); return; }

  try {
    const modelName = 'gemini-3.1-flash-image-preview';
    const body = {
      contents: [{ parts: [{ text: prompt || '' }] }],
      generationConfig: { responseModalities: ['Text', 'Image'] }
    };
    const result = await httpsPost(
      'generativelanguage.googleapis.com',
      `/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(key)}`,
      {}, JSON.stringify(body)
    );

    let imageData = null, mimeType = 'image/jpeg';
    const parts = result?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        imageData = part.inlineData.data;
        mimeType = part.inlineData.mimeType || 'image/jpeg';
        break;
      }
    }
    const error = result?.error?.message || (imageData ? null : '이미지 데이터 없음');
    res.status(200).json({ imageData, mimeType, error });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
