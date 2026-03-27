const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

const PORT = 3000;
const SAVE_BASE = 'C:\\Users\\GKL\\Desktop\\블로그';

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve({}); } });
  });
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function httpsPost(hostname, path, headers, postData) {
  return new Promise((resolve, reject) => {
    const options = { hostname, port: 443, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData), ...headers } };
    const r = https.request(options, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve({ error: data }); } });
    });
    r.on('error', reject);
    r.write(postData); r.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // Claude API
  if (req.method === 'POST' && req.url === '/api/claude') {
    const { apiKey, model, max_tokens, messages, system } = await readBody(req);
    const key = apiKey || process.env.CLAUDE_API_KEY;
    if (!key) { res.writeHead(400); res.end(JSON.stringify({ error: 'API 키 없음' })); return; }
    try {
      const body = { model: model || 'claude-sonnet-4-20250514', max_tokens: max_tokens || 5000, messages };
      if (system) body.system = system;
      const result = await httpsPost('api.anthropic.com', '/v1/messages',
        { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, JSON.stringify(body));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch(e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // Tavily API
  if (req.method === 'POST' && req.url === '/api/tavily') {
    const { apiKey, query } = await readBody(req);
    const key = apiKey || process.env.TAVILY_API_KEY;
    if (!key) { res.writeHead(400); res.end(JSON.stringify({ error: 'Tavily 키 없음' })); return; }
    try {
      const result = await httpsPost('api.tavily.com', '/search', {},
        JSON.stringify({ api_key: key, query, search_depth: 'advanced', max_results: 8, include_answer: true, days: 3 }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch(e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ★ 저장 API — 글 + 이미지 프롬프트 파일 저장
  if (req.method === 'POST' && req.url === '/api/save-all') {
    const { nv, ts, nvPrompts, tsPrompts } = await readBody(req);
    const today = new Date().toISOString().slice(0, 10);
    const saveDir = path.join(SAVE_BASE, today);

    try {
      ensureDir(saveDir);
      const saved = [];

      // 네이버 글 저장
      if (nv) {
        fs.writeFileSync(path.join(saveDir, '네이버_글.txt'), nv, 'utf8');
        saved.push('✅ 네이버_글.txt');
      }

      // 티스토리 글 저장
      if (ts) {
        fs.writeFileSync(path.join(saveDir, '티스토리_글.html'), ts, 'utf8');
        saved.push('✅ 티스토리_글.html');
      }

      // 이미지 프롬프트 가이드 저장
      if (nvPrompts || tsPrompts) {
        let guide = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        guide += '  BlogAI 이미지 프롬프트 가이드\n';
        guide += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
        guide += '사용 방법:\n';
        guide += '  미드저니: /imagine [영어 프롬프트] 입력\n';
        guide += '  ChatGPT: "이 이미지를 만들어줘" + 한국어 프롬프트\n';
        guide += '  Canva AI: 한국어 프롬프트 입력\n\n';

        if (nvPrompts && nvPrompts.length > 0) {
          guide += '━━ 📱 네이버 블로그 이미지 ━━\n\n';
          nvPrompts.forEach((p, i) => {
            guide += `[이미지 ${i+1}] ${p.title}\n`;
            guide += `파일명: ${p.filename}\n`;
            guide += `캡션: ${p.caption}\n`;
            guide += `\n▶ 영어 프롬프트 (미드저니/ChatGPT):\n${p.prompt_en}\n`;
            guide += `\n▶ 한국어 프롬프트 (Canva/네이버AI):\n${p.prompt_ko}\n`;
            guide += '\n' + '─'.repeat(40) + '\n\n';
          });
        }

        if (tsPrompts && tsPrompts.length > 0) {
          guide += '━━ ✈️ 티스토리 블로그 이미지 ━━\n\n';
          tsPrompts.forEach((p, i) => {
            guide += `[이미지 ${i+1}] ${p.title}\n`;
            guide += `파일명: ${p.filename}\n`;
            guide += `캡션: ${p.caption}\n`;
            guide += `\n▶ 영어 프롬프트 (미드저니/ChatGPT):\n${p.prompt_en}\n`;
            guide += `\n▶ 한국어 프롬프트 (Canva/네이버AI):\n${p.prompt_ko}\n`;
            guide += '\n' + '─'.repeat(40) + '\n\n';
          });
        }

        fs.writeFileSync(path.join(saveDir, '이미지_프롬프트_가이드.txt'), guide, 'utf8');
        saved.push('✅ 이미지_프롬프트_가이드.txt');
      }

      // 탐색기 자동 열기
      exec(`explorer "${saveDir}"`);
      console.log(`\n🎉 저장 완료! → ${saveDir}\n`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ folder: saveDir, saved }));

    } catch(e) {
      console.error('저장 오류:', e);
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 정적 파일 서빙
  let filePath = req.url === '/' ? '/public/index.html' : req.url;
  if (!filePath.startsWith('/public') && !filePath.startsWith('/api')) filePath = '/public' + filePath;
  const fullPath = path.join(__dirname, filePath);

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      fs.readFile(path.join(__dirname, 'public', 'index.html'), (e2, d2) => {
        if (e2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(d2);
      });
      return;
    }
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
    res.writeHead(200, { 'Content-Type': mime[path.extname(fullPath)] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║        BlogAI v10 — 로컬 서버          ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║  브라우저: http://localhost:${PORT}        ║`);
  console.log(`║  저장위치: C:\\Users\\GKL\\Desktop\\블로그  ║`);
  console.log('╚════════════════════════════════════════╝\n');
});
