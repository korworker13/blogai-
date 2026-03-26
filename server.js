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
    const { prompt, style } = await readBody(req);
    const styleSuffix = {
      thumbnail: 'professional blog thumbnail, eye-catching, photography mixed with graphic overlay, high quality',
      photo:     'realistic travel photography, natural golden hour lighting, vivid landscape, no text no logo',
      infographic: 'clean Korean infographic, flat illustration, bold data visualization, pastel colors, white background',
      card:      'Korean card news style, bold typography, strong gradient background, social media card design',
      variety:   'mixed media blog image, dynamic composition, vibrant colors, editorial style'
    };
    const s = (style === 'variety') ? ['thumbnail','photo','infographic','card'][Math.floor(Math.random()*4)] : (style || 'thumbnail');
    const suffix = styleSuffix[s] || styleSuffix['thumbnail'];
    const encoded = encodeURIComponent(`${prompt}, ${suffix}`);
    const seed = Date.now() + Math.floor(Math.random() * 99999);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&enhance=true&seed=${seed}`;
    try {
      const imgRes = await fetch(url);
      if (!imgRes.ok) throw new Error('이미지 생성 실패');
      const buffer = await imgRes.buffer();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ base64: buffer.toString('base64'), mimeType: 'image/jpeg', usedStyle: s }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── 파일 저장 (바탕화면 블로그 폴더) ──
  if (req.method === 'POST' && req.url === '/api/save') {
    const { nv, ts, images } = await readBody(req);
    const homeDir = require('os').homedir();
    const blogDir = path.join(homeDir, 'Desktop', '블로그');
    const dateStr = new Date().toISOString().slice(0, 10);
    const dateFolder = path.join(blogDir, dateStr);

    try {
      // 폴더 생성 (없으면)
      if (!fs.existsSync(blogDir)) fs.mkdirSync(blogDir, { recursive: true });
      if (!fs.existsSync(dateFolder)) fs.mkdirSync(dateFolder, { recursive: true });

      let saved = [];
      
      // 네이버 글 저장
      if (nv) {
        const nvFile = path.join(dateFolder, '네이버_글.txt');
        fs.writeFileSync(nvFile, nv, 'utf8');
        saved.push('네이버_글.txt');
      }

      // 티스토리 글 저장
      if (ts) {
        const tsFile = path.join(dateFolder, '티스토리_글.html');
        fs.writeFileSync(tsFile, ts, 'utf8');
        saved.push('티스토리_글.html');
      }

      // 이미지 저장
      if (Array.isArray(images) && images.length > 0) {
        const imgFolder = path.join(dateFolder, '이미지');
        if (!fs.existsSync(imgFolder)) fs.mkdirSync(imgFolder, { recursive: true });
        
        for (const img of images) {
          if (img.base64 && img.filename) {
            const buffer = Buffer.from(img.base64, 'base64');
            const imgFile = path.join(imgFolder, img.filename);
            fs.writeFileSync(imgFile, buffer);
            saved.push(img.filename);
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
