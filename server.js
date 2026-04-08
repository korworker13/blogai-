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

// 날짜 기준 순번 폴더 반환: 2026-04-08 → 2026-04-08(2) → 2026-04-08(3) ...
function getDateFolder() {
  const today = new Date().toISOString().slice(0, 10);
  let dir = path.join(SAVE_BASE, today);
  if (!fs.existsSync(dir)) return dir;
  let cnt = 2;
  while (fs.existsSync(path.join(SAVE_BASE, `${today}(${cnt})`))) cnt++;
  return path.join(SAVE_BASE, `${today}(${cnt})`);
}

function httpsPost(hostname, path, headers, postData) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname, port: 443, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData), ...headers },
      timeout: 120000  // ★ 이미지 생성은 최대 2분 대기
    };
    const r = https.request(options, (resp) => {
      const chunks = [];
      resp.on('data', chunk => chunks.push(chunk));          // ★ Buffer 그대로 수집
      resp.on('end', () => {
        try {
          const data = Buffer.concat(chunks).toString('utf8'); // ★ 합친 후 utf8 디코딩
          resolve(JSON.parse(data));
        } catch(e) {
          resolve({ error: chunks.toString() });
        }
      });
    });
    r.on('timeout', () => { r.destroy(); reject(new Error('요청 타임아웃 (120초 초과)')); });
    r.on('error', reject);
    r.write(postData); r.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // Naver Search API
  if (req.method === 'POST' && req.url === '/api/naver') {
    const { clientId, clientSecret, query } = await readBody(req);
    const id = clientId || process.env.NAVER_CLIENT_ID;
    const secret = clientSecret || process.env.NAVER_CLIENT_SECRET;
    if (!id || !secret) { res.writeHead(400); res.end(JSON.stringify({ error: '네이버 API 키 없음' })); return; }
    try {
      const options = {
        hostname: 'openapi.naver.com', port: 443,
        path: '/v1/search/news.json?query=' + encodeURIComponent(query) + '&display=5&sort=date',
        method: 'GET',
        headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret }
      };
      const result = await new Promise((resolve, reject) => {
        const r = https.request(options, (resp) => {
          const chunks = [];
          resp.on('data', chunk => chunks.push(chunk));
          resp.on('end', () => { try { const data = Buffer.concat(chunks).toString('utf8'); resolve(JSON.parse(data)); } catch(e) { resolve({ error: e.message }); } });
        });
        r.on('error', reject); r.end();
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch(e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // 네이버 DataLab 검색어 트렌드 API
  if (req.method === 'POST' && req.url === '/api/naver-datalab') {
    const { clientId, clientSecret, keywords } = await readBody(req);
    const id = clientId || process.env.NAVER_CLIENT_ID;
    const secret = clientSecret || process.env.NAVER_CLIENT_SECRET;
    if (!id || !secret) { res.writeHead(400); res.end(JSON.stringify({ error: '네이버 API 키 없음' })); return; }
    if (!Array.isArray(keywords) || !keywords.length) { res.writeHead(400); res.end(JSON.stringify({ error: '키워드 없음' })); return; }

    // DataLab은 한 번에 최대 5개 그룹 → 5개씩 나눠서 호출
    const today = new Date();
    const endDate = today.toISOString().slice(0, 10);
    const startDate = new Date(today - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const chunks = [];
    for (let i = 0; i < keywords.length; i += 5) chunks.push(keywords.slice(i, i + 5));

    try {
      const scores = {};
      for (const chunk of chunks) {
        const body = JSON.stringify({
          startDate, endDate, timeUnit: 'date',
          keywordGroups: chunk.map(k => ({ groupName: k, keywords: [k] }))
        });
        const options = {
          hostname: 'openapi.naver.com', port: 443,
          path: '/v1/datalab/search',
          method: 'POST',
          headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        };
        const result = await new Promise((resolve, reject) => {
          const r = https.request(options, (resp) => {
            const chunks = [];
            resp.on('data', c => chunks.push(c));
            resp.on('end', () => { try { const data = Buffer.concat(chunks).toString('utf8'); resolve(JSON.parse(data)); } catch(e) { resolve({ error: e.message }); } });
          });
          r.on('error', reject); r.write(body); r.end();
        });
        if (result.results) {
          result.results.forEach(item => {
            // ratio 배열의 평균값을 점수로 사용
            const ratios = item.data ? item.data.map(d => d.ratio) : [];
            const avg = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
            const max = ratios.length ? Math.max(...ratios) : 0;
            scores[item.title] = { avg: Math.round(avg * 10) / 10, max: Math.round(max * 10) / 10 };
          });
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ scores }));
    } catch(e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // Tavily API
  if (req.method === 'POST' && req.url === '/api/tavily') {
    const { apiKey, query, days } = await readBody(req);
    const key = apiKey || process.env.TAVILY_API_KEY;
    if (!key) { res.writeHead(400); res.end(JSON.stringify({ error: 'Tavily 키 없음' })); return; }
    try {
      const result = await httpsPost('api.tavily.com', '/search', {},
        JSON.stringify({ api_key: key, query, search_depth: 'advanced', max_results: 8, include_answer: true, days: days || 90 }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch(e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // Gemini API (gemini-3.1-flash-lite-preview)
  if (req.method === 'POST' && req.url === '/api/gemini') {
    const { apiKey, prompt, max_tokens, model } = await readBody(req);
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) { res.writeHead(400); res.end(JSON.stringify({ error: 'Gemini API 키 없음' })); return; }

    const targetModel = model || 'gemini-3.1-flash-lite-preview'; // Default model for general text generation
    try {
      const body = {
        contents: [{ parts: [{ text: prompt || '' }] }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: max_tokens || 8192, // maxOutputTokens 상향 조정
        }
      };
      const result = await httpsPost('generativelanguage.googleapis.com',
        `/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(key)}`,
        {}, JSON.stringify(body));
      console.log(`[Gemini] model=${targetModel} | candidates=${result?.candidates?.length||0} | error=${result?.error?.message||'none'} | finish=${result?.candidates?.[0]?.finishReason||'n/a'}`);
      if (result?.error) console.error('[Gemini API ERROR]', JSON.stringify(result.error));
      let text = '';
      if (result && result.candidates && result.candidates[0] &&
          result.candidates[0].content && result.candidates[0].content.parts) {
        text = result.candidates[0].content.parts.map(p => p.text || '').join('');
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const geminiErr = result.error ? (result.error.message || JSON.stringify(result.error)) : (result.promptFeedback?.blockReason ? '안전필터 차단: '+result.promptFeedback.blockReason : undefined);
      res.end(JSON.stringify({ text, error: geminiErr }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 이미지 생성 API (gemini-3.1-flash-image-preview / generateContent)
  if (req.method === 'POST' && req.url === '/api/gemini-image') {
    const { apiKey, prompt } = await readBody(req);
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) { res.writeHead(400); res.end(JSON.stringify({ error: 'Gemini API 키 없음' })); return; }

    try {
      const modelName = 'gemini-3.1-flash-image-preview';
      const body = {
        contents: [{ parts: [{ text: prompt || '' }] }],
        generationConfig: { responseModalities: ['Text', 'Image'] }
      };
      const result = await httpsPost('generativelanguage.googleapis.com',
        `/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(key)}`,
        {}, JSON.stringify(body));

      console.log(`[GeminiImage] model=${modelName} | error=${result?.error?.message||'none'}`);
      if (result && result.error) console.error('[GeminiImage API ERROR]', JSON.stringify(result.error));

      let imageData = null, mimeType = 'image/jpeg';
      const parts = result?.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          imageData = part.inlineData.data;
          mimeType = part.inlineData.mimeType || 'image/jpeg';
          break;
        }
      }

      const imgErr = result?.error
        ? (result.error.message || JSON.stringify(result.error))
        : (imageData ? null : '이미지 데이터 없음');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ imageData, mimeType, error: imgErr }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // URL 유효성 검증 API
  if (req.method === 'POST' && req.url === '/api/check-url') {
    const { urls } = await readBody(req);
    if (!urls || !Array.isArray(urls)) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({valid:[]})); return; }
    const checkOne = (url) => new Promise((resolve) => {
      try {
        const lib = url.startsWith('https') ? https : http;
        const r = lib.request(url, {method:'HEAD', timeout:4000}, (resp) => {
          resolve([200,301,302,303].includes(resp.statusCode) ? url : null);
        });
        r.on('error', () => resolve(null));
        r.on('timeout', () => { r.destroy(); resolve(null); });
        r.end();
      } catch(e) { resolve(null); }
    });
    const results = await Promise.all(urls.map(checkOne));
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({valid: results.filter(Boolean)}));
    return;
  }

  // 이미지 파일 저장 API (개별) — 날짜 순번 폴더/이미지/ 에 저장
  if (req.method === 'POST' && req.url === '/api/save-image') {
    const { imageData, mimeType, filename } = await readBody(req);
    const today = new Date().toISOString().slice(0, 10);
    // 오늘 날짜 폴더 중 가장 최근 순번 폴더를 찾아서 이미지 폴더에 저장
    let baseDir = path.join(SAVE_BASE, today);
    let cnt = 2;
    while (fs.existsSync(path.join(SAVE_BASE, `${today}(${cnt})`))) cnt++;
    if (cnt > 2 && fs.existsSync(path.join(SAVE_BASE, `${today}(${cnt - 1})`))) {
      baseDir = path.join(SAVE_BASE, `${today}(${cnt - 1})`);
    } else if (!fs.existsSync(baseDir)) {
      baseDir = getDateFolder();
    }
    const saveDir = path.join(baseDir, '이미지');
    try {
      ensureDir(saveDir);
      const ext = (mimeType || '').includes('jpeg') ? '.jpg' : '.png';
      const fname = filename || `gemini-image-${Date.now()}${ext}`;
      fs.writeFileSync(path.join(saveDir, fname), Buffer.from(imageData, 'base64'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, path: path.join(saveDir, fname) }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 이미지 일괄 저장 API — 날짜 순번 폴더/이미지/ 에 한꺼번에 저장
  if (req.method === 'POST' && req.url === '/api/save-image-bulk') {
    const { images, keyword } = await readBody(req);
    const slugKw = (keyword || '블로그')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '-')
      .trim()
      .slice(0, 30);
    if (!Array.isArray(images) || !images.length) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: '이미지 없음' }));
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    let baseDir = path.join(SAVE_BASE, today);
    let cnt = 2;
    while (fs.existsSync(path.join(SAVE_BASE, `${today}(${cnt})`))) cnt++;
    if (cnt > 2 && fs.existsSync(path.join(SAVE_BASE, `${today}(${cnt - 1})`))) {
      baseDir = path.join(SAVE_BASE, `${today}(${cnt - 1})`);
    } else if (!fs.existsSync(baseDir)) {
      baseDir = getDateFolder();
    }
    const saveDir = path.join(baseDir, '이미지');
    try {
      ensureDir(saveDir);
      const saved = [];
      let imgIdx = 1;
      for (const img of images) {
        const base64 = img.src && img.src.includes(',') ? img.src.split(',')[1] : img.src;
        if (!base64) { saved.push('SKIP:' + img.filename); continue; }
        const buf = Buffer.from(base64, 'base64');
        const ext = (img.filename || '').endsWith('.png') ? '.png' : '.jpg';
        const newFilename = `${slugKw}-${String(imgIdx).padStart(2, '0')}${ext}`;
        fs.writeFileSync(path.join(saveDir, newFilename), buf);
        saved.push(newFilename);
        imgIdx++;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, path: saveDir, saved }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
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
    const { nv, ts, nvPrompts, tsPrompts, nvKw, tsKw } = await readBody(req);
    const saveDir = getDateFolder();

    // ★ 키워드 기반 파일명 생성
    const makeSlug = (kw) => (kw || '블로그글')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '-')
      .trim()
      .slice(0, 40);
    const nvSlug = makeSlug(nvKw);
    const tsSlug = makeSlug(tsKw);

    try {
      ensureDir(saveDir);
      const saved = [];

      // 네이버 글 저장
      if (nv) {
        const nvFile = `${nvSlug}_네이버.txt`;
        fs.writeFileSync(path.join(saveDir, nvFile), nv, 'utf8');
        saved.push('✅ ' + nvFile);
      }

      // 티스토리 글 저장
      if (ts) {
        const tsFile = `${tsSlug}_티스토리.html`;
        fs.writeFileSync(path.join(saveDir, tsFile), ts, 'utf8');
        saved.push('✅ ' + tsFile);
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
    const headers = { 'Content-Type': mime[path.extname(fullPath)] || 'text/plain' };
    if (path.extname(fullPath) === '.html') headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    res.writeHead(200, headers);
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
