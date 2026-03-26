const http = require('http');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const PORT = 3000;

async function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // ── API 라우트 ──
  if (req.method === 'POST' && req.url === '/api/claude') {
    const { apiKey, model, max_tokens, messages, system } = await readBody(req);
    const key = apiKey || process.env.CLAUDE_API_KEY;
    try {
      const body = { model: model || 'claude-sonnet-4-20250514', max_tokens: max_tokens || 5000, messages };
      if (system) body.system = system;
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/tavily') {
    const { apiKey, query } = await readBody(req);
    const key = apiKey || process.env.TAVILY_API_KEY;
    try {
      const r = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key, query, search_depth: 'advanced', max_results: 8, include_answer: true, days: 3 })
      });
      const data = await r.json();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/image') {
    const { prompt, style, geminiKey } = await readBody(req);
    const styleSuffix = {
      thumbnail: 'professional blog thumbnail, eye-catching, photography mixed with graphic overlay, high quality',
      photo:     'realistic travel photography, natural golden hour lighting, vivid landscape, no text no logo',
      infographic: 'clean Korean infographic, flat illustration, bold data visualization, pastel colors, white background',
      card:      'Korean card news style, bold typography, strong gradient background, social media card design',
      variety:   'mixed media blog image, dynamic composition, vibrant colors, editorial style'
    };
    const s = (style === 'variety') ? ['thumbnail','photo','infographic','card'][Math.floor(Math.random()*4)] : (style || 'thumbnail');
    const suffix = styleSuffix[s] || styleSuffix['thumbnail'];
    const fullPrompt = `${prompt}, ${suffix}`;

    // ① Pollinations 시도 (25초 타임아웃)
    try {
      const encoded = encodeURIComponent(fullPrompt);
      const seed = Date.now() + Math.floor(Math.random() * 99999);
      const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&enhance=true&seed=${seed}`;
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 25000);
      const imgRes = await fetch(url, { signal: controller.signal });
      clearTimeout(tid);
      if (imgRes.ok) {
        const buffer = await imgRes.buffer();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ base64: buffer.toString('base64'), mimeType: 'image/jpeg', usedStyle: s, source: 'pollinations' }));
        return;
      }
    } catch(e) { /* Pollinations 실패 → Gemini로 폴백 */ }

    // ② Gemini Imagen 폴백
    if (geminiKey) {
      try {
        const gRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${geminiKey}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instances: [{ prompt: fullPrompt }], parameters: { sampleCount: 1, aspectRatio: '1:1' } }) }
        );
        const gData = await gRes.json();
        const b64 = gData.predictions?.[0]?.bytesBase64Encoded;
        if (b64) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ base64: b64, mimeType: 'image/png', usedStyle: s, source: 'gemini' }));
          return;
        }
      } catch(e) { /* Gemini도 실패 */ }
    }

    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '이미지 생성 실패 (Pollinations & Gemini 모두 실패)' }));
    return;
  }

  // ── 바탕화면 자동 저장 ──
  if (req.method === 'POST' && req.url === '/api/save') {
    const { nv, ts, images } = await readBody(req);
    const homeDir = require('os').homedir();
    const blogDir = path.join(homeDir, 'Desktop', '블로그');
    const dateStr = new Date().toISOString().slice(0, 10);
    const dateFolder = path.join(blogDir, dateStr);
    try {
      if (!fs.existsSync(blogDir)) fs.mkdirSync(blogDir, { recursive: true });
      if (!fs.existsSync(dateFolder)) fs.mkdirSync(dateFolder, { recursive: true });
      const saved = [];
      if (nv) { fs.writeFileSync(path.join(dateFolder, '네이버_글.txt'), nv, 'utf8'); saved.push('네이버_글.txt'); }
      if (ts) { fs.writeFileSync(path.join(dateFolder, '티스토리_글.html'), ts, 'utf8'); saved.push('티스토리_글.html'); }
      if (Array.isArray(images) && images.length > 0) {
        const imgRoot = path.join(dateFolder, '이미지');
        if (!fs.existsSync(imgRoot)) fs.mkdirSync(imgRoot, { recursive: true });
        for (const img of images) {
          if (img.base64 && img.filename) {
            const imgFile = path.join(imgRoot, img.filename);
            const imgDir = path.dirname(imgFile);
            if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
            fs.writeFileSync(imgFile, Buffer.from(img.base64, 'base64'));
            saved.push('이미지/' + img.filename);
          }
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, path: dateFolder, saved }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── 정적 파일 서빙 ──
  let filePath = req.url === '/' ? '/public/index.html' : req.url;
  if (!filePath.startsWith('/public')) filePath = '/public' + filePath;
  const fullPath = path.join(__dirname, filePath);

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      // SPA fallback
      fs.readFile(path.join(__dirname, 'public', 'index.html'), (e2, d2) => {
        if (e2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(d2);
      });
      return;
    }
    const ext = path.extname(fullPath);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('\n✅ BlogAI v10 실행 중!');
  console.log(`👉 브라우저에서 열기: http://localhost:${PORT}\n`);
});
