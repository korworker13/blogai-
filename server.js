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

  // ★ 깃 푸시 API — 변경사항 자동 커밋 및 푸시
  if (req.method === 'POST' && req.url === '/api/git-push') {
    const { message } = await readBody(req);
    const commitMsg = message || `BlogAI 자동 업데이트 - ${new Date().toLocaleString('ko-KR')}`;
    
    try {
      // 워킹 디렉토리가 git 리포지토리인지 확인
      const isGit = fs.existsSync(path.join(__dirname, '.git'));
      if (!isGit) {
        res.writeHead(400); 
        res.end(JSON.stringify({ error: 'Git 리포지토리가 아닙니다' }));
        return;
      }

      // git add .
      exec('git add .', { cwd: __dirname }, (err1, stdout1) => {
        if (err1) {
          console.error('git add 오류:', err1);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'git add 실패: ' + err1.message }));
          return;
        }

        // git commit
        exec(`git commit -m "${commitMsg}"`, { cwd: __dirname }, (err2, stdout2) => {
          if (err2) {
            // 커밋할 변경사항이 없는 경우는 오류가 아님
            if (err2.message.includes('nothing to commit')) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, message: '커밋할 변경사항 없음' }));
              return;
            }
            console.error('git commit 오류:', err2);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'git commit 실패: ' + err2.message }));
            return;
          }

          // git push
          exec('git push', { cwd: __dirname }, (err3, stdout3) => {
            if (err3) {
              console.error('git push 오류:', err3);
              res.writeHead(500);
              res.end(JSON.stringify({ error: 'git push 실패: ' + err3.message }));
              return;
            }

            console.log('✅ 깃허브 자동 푸시 완료:', commitMsg);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: '깃허브에 자동 푸시 완료!', stdout: stdout3 }));
          });
        });
      });
    } catch(e) {
      console.error('깃 푸시 오류:', e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
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
