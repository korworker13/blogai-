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

  const { apiKey, prompt, max_tokens, model } = req.body || {};
  const key = apiKey || process.env.GEMINI_API_KEY;

  if (!key) { res.status(400).json({ error: 'Gemini API 키 없음' }); return; }

  const targetModel = model || 'gemini-2.0-flash';
  try {
    const body = {
      contents: [{ parts: [{ text: prompt || '' }] }],
      generationConfig: {
        temperature: 0.7, topP: 0.95, topK: 40,
        maxOutputTokens: max_tokens || 8192,
      }
    };
    const result = await httpsPost(
      'generativelanguage.googleapis.com',
      `/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(key)}`,
      {}, JSON.stringify(body)
    );

    let text = '';
    if (result?.candidates?.[0]?.content?.parts) {
      text = result.candidates[0].content.parts.map(p => p.text || '').join('');
    }
    const error = result?.error?.message || (result?.promptFeedback?.blockReason ? '안전필터 차단: ' + result.promptFeedback.blockReason : undefined);
    res.status(200).json({ text, error });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
