
/* ═══ STATE ═══ */
let opts=['경험담','FAQ','핵심 요약표','체크리스트'];
let fixTarget='nv';
let gd={ts:'',nv:'',nvPrompts:[],tsPrompts:[]};
let allPromptData={};
let schedTimer=null,schedActive=false;
let isLocal=false; // 로컬/Vercel 자동 감지
let previousTsKeywords={}; // {카테고리: [이전 추천 키워드들]}
let previousNvKeywords=[]; // 이전 네이버 추천 키워드들

/* ═══ 로컬/Vercel 자동 감지 ═══ */
async function detectMode(){
  // localhost면 무조건 로컬
  if(location.hostname==='localhost'||location.hostname==='127.0.0.1') isLocal=true;
  updateModeUI();
}
function updateModeUI(){
  const pill=document.getElementById('modePill');
  if(isLocal){
    pill.textContent='💻 로컬 PC 모드';
    pill.className='mode-pill mode-local';
  }else{
    pill.textContent='🌐 Vercel 모드';
    pill.className='mode-pill mode-vercel';
  }
}

/* ═══ UTILS ═══ */
function toast(m,dur=2800){const e=document.getElementById('toast');e.textContent=m;e.classList.add('on');setTimeout(()=>e.classList.remove('on'),dur);}
function copyEl(id){navigator.clipboard.writeText(document.getElementById(id).textContent).then(()=>toast('📋 복사됐어요!'));}
function copyText(txt){navigator.clipboard.writeText(txt).then(()=>toast('📋 프롬프트 복사됐어요!'));}
function dlText(id,fn){const a=document.createElement('a');a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(document.getElementById(id).textContent);a.download=fn;a.click();toast('💾 저장!');}
function setProg(p,m){document.getElementById('pbar').style.width=p+'%';document.getElementById('plbl').textContent=m;}
function showTab(n){
  ['nv','ts','img','fix','seo','hist'].forEach(k=>{document.getElementById('t-'+k)?.classList.remove('on');document.getElementById('pane-'+k)?.classList.remove('on');});
  document.getElementById('t-'+n)?.classList.add('on');document.getElementById('pane-'+n)?.classList.add('on');
  document.getElementById('emptyState').style.display='none';
  const oa=document.querySelector('.out-area');if(oa)oa.scrollTop=0;
}
function mv(v){
  document.getElementById('sb').style.display=v==='s'?'':'none';
  document.getElementById('main').classList.toggle('on',v==='r');
  document.getElementById('mob-s').classList.toggle('on',v==='s');
  document.getElementById('mob-r').classList.toggle('on',v==='r');
}
function addLog(m,cls='linf'){
  const b=document.getElementById('slog');
  const t=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  b.innerHTML+=`<div class="${cls}">[${t}] ${m}</div>`;b.scrollTop=b.scrollHeight;
}
function setFT(t){fixTarget=t;['nv','ts'].forEach(k=>document.getElementById('ft-'+k).classList.remove('on'));document.getElementById('ft-'+t).classList.add('on');}
function setFTY(btn,txt){document.querySelectorAll('.ftybtn').forEach(b=>b.classList.remove('on'));btn.classList.add('on');document.getElementById('fixReq').value=txt;}
function setExperienceType(v){
  document.getElementById('experienceType').value=v;
  document.querySelectorAll('.exp-btn').forEach(b=>b.classList.toggle('on',b.dataset.exp===v));
}

/* ═══ KEY SAVE ═══ */
function loadKeys(){
  const on=localStorage.getItem('bai_save')==='1';
  document.getElementById('saveTgl').checked=on;
  if(on){
    const tk=localStorage.getItem('bai_tk')||'';if(tk)document.getElementById('tavilyKey').value=tk;
    const gk=localStorage.getItem('bai_gk')||'';if(gk)document.getElementById('geminiKey').value=gk;
    const nid=localStorage.getItem('bai_nid')||'';if(nid)document.getElementById('naverClientId').value=nid;
    const nsc=localStorage.getItem('bai_nsc')||'';if(nsc)document.getElementById('naverClientSecret').value=nsc;
    if(tk||gk)document.getElementById('ksaved').classList.add('on');
  }
}
function autoSave(){
  if(!document.getElementById('saveTgl').checked)return;
  const tk=document.getElementById('tavilyKey').value.trim();if(tk)localStorage.setItem('bai_tk',tk);
  const gk=document.getElementById('geminiKey').value.trim();if(gk)localStorage.setItem('bai_gk',gk);
  const nid=document.getElementById('naverClientId').value.trim();if(nid)localStorage.setItem('bai_nid',nid);
  const nsc=document.getElementById('naverClientSecret').value.trim();if(nsc)localStorage.setItem('bai_nsc',nsc);
  if(tk||gk)document.getElementById('ksaved').classList.add('on');
}
function onSaveTgl(){
  const on=document.getElementById('saveTgl').checked;localStorage.setItem('bai_save',on?'1':'0');
  if(on){autoSave();toast('✅ API 키 저장됐어요!');}
  else{localStorage.removeItem('bai_gk');localStorage.removeItem('bai_tk');localStorage.removeItem('bai_nid');localStorage.removeItem('bai_nsc');document.getElementById('ksaved').classList.remove('on');toast('🗑 키 삭제됨');}
}
document.querySelectorAll('.tag').forEach(t=>{
  t.addEventListener('click',()=>{
    t.classList.toggle('on');const v=t.dataset.v;
    opts=t.classList.contains('on')?[...opts,v]:opts.filter(x=>x!==v);
  });
});

/* ═══ API 호출 ═══ */
async function tavilySearch(query){
  const key=document.getElementById('tavilyKey').value.trim();if(!key)return null;
  try{
    const r=await fetch('/api/tavily',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:key,query})});
    const d=await r.json();
    if(d.results){let ctx='';if(d.answer)ctx+=`[AI요약]\n${d.answer}\n\n`;ctx+=d.results.slice(0,6).map(r=>`[${r.title}]\n${r.content}`).join('\n\n');return ctx;}
    return null;
  }catch(e){return null;}
}

async function naverSearch(query){
  const nid=document.getElementById('naverClientId').value.trim();
  const nsc=document.getElementById('naverClientSecret').value.trim();
  if(!nid||!nsc)return null;
  try{
    const r=await fetch('/api/naver',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:nid,clientSecret:nsc,query})});
    const d=await r.json();
    if(d.items&&d.items.length){
      return d.items.map(i=>'[뉴스] '+i.title.replace(/<[^>]*>/g,'')+': '+i.description.replace(/<[^>]*>/g,'')).join('\n\n');
    }
    return null;
  }catch(e){return null;}
}

async function geminiSearch(query){
  const key=document.getElementById('geminiKey').value.trim();if(!key)return null;
  try{
    const r=await fetch('/api/gemini',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:key,prompt:query,max_tokens:600,model:'gemini-2.0-flash'})});
    const d=await r.json();
    if(d.error) return null;
    if(d.text) return d.text;
    return null;
  }catch(e){return null;}
}


async function geminiAsk(prompt, max_tokens, model='gemini-2.0-flash'){
  const key=document.getElementById('geminiKey').value.trim();if(!key)return null;
  try{
    const r=await fetch('/api/gemini',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:key,prompt,max_tokens:max_tokens||800, model})});
    const d=await r.json();
    if(d.error){window._lastGeminiErr=String(d.error);return null;}
    return d.text||null;
  }catch(e){window._lastGeminiErr=e.message;return null;}
}
/* ═══ SEO 파일명 ═══ */
function seoName(raw,num,prefix=''){
  const m={'정부':'gov','지원금':'fund','복지':'welfare','여행':'travel','관광':'tour','국내':'domestic','해외':'overseas','서울':'seoul','부산':'busan','제주':'jeju','경주':'gyeongju','전주':'jeonju','강릉':'gangneung','속초':'sokcho','도쿄':'tokyo','오사카':'osaka','파리':'paris','방콕':'bangkok','발리':'bali','건강':'health','금융':'finance','청년':'youth','계좌':'account','신청':'apply','정보':'info','이슈':'issue','월세':'rent'};
  let b=raw||'';Object.entries(m).forEach(([k,v])=>{b=b.replace(new RegExp(k,'g'),v+'-');});
  b=b.toLowerCase().replace(/[^\w-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'').substring(0,24)||'img';
  const date=new Date().toISOString().slice(0,10).replace(/-/g,'');
  return `${prefix}${b}-${date}-0${num}.jpg`;
}

/* ═══ 키워드 추천 ═══ */
async function fetchKw(){
  const gk=document.getElementById('geminiKey').value.trim();
  if(!gk){toast('⚠ Gemini API 키를 먼저 입력해주세요 (키워드 추천용)');return;}
  const cat=document.getElementById('tsKwCat').value;
  const userKeyword=document.getElementById('tsKw').value.trim();
  const btn=document.getElementById('tsKwBtn');const chips=document.getElementById('tsChips');
  const tk=document.getElementById('tavilyKey').value.trim();
  const nid=document.getElementById('naverClientId').value.trim();
  btn.textContent='⏳...';btn.disabled=true;
  chips.innerHTML='<span style="font-size:12px;color:var(--tx3)">추천 중...</span>';
  try{
    // 네이버+Tavily로 실시간 뉴스 수집
    let newsCtx='';
    if(nid||tk){
      const [nR,tR]=await Promise.all([
        nid?naverSearch((userKeyword||cat)+' 최신'):Promise.resolve(null),
        tk?tavilySearch((userKeyword||cat)+' 최신 2026'):Promise.resolve(null)
      ]);
      if(nR) newsCtx+='[네이버뉴스]\n'+nR.slice(0,1000);
      if(tR) newsCtx+='\n[Tavily]\n'+tR.slice(0,800);
    }

    let excludeList='';
    if(previousTsKeywords[cat]&&previousTsKeywords[cat].length>0){
      excludeList='\n제외(이미 추천): '+previousTsKeywords[cat].slice(0,5).join(', ');
    }

    const isTravelCat=/여행|관광/.test(cat);
    const newsSection = newsCtx ? '\n\n[실시간 뉴스]\n'+newsCtx+'\n\n위 뉴스 기반으로 실제 등장한 키워드 우선 선별.' : '';
    let prompt='';
    if(userKeyword){
      prompt = isTravelCat
        ? '"'+userKeyword+'" 여행 관련 롱테일 키워드 10개. 같은 여행지/코스/테마, 실제 검색되는 것만.'+newsSection+excludeList+'\nJSON 배열만: ["키워드1",...,"키워드10"]'
        : '"'+userKeyword+'" 관련 "'+cat+'" 롱테일 키워드 10개. 고단가(지원금/보험/재테크 등) 우선, 실제 검색되는 것만.'+newsSection+excludeList+'\nJSON 배열만: ["키워드1",...,"키워드10"]';
    }else{
      prompt = isTravelCat
        ? '"'+cat+'" 2026년 검색량 높은 롱테일 키워드 10개.'+newsSection+excludeList+'\nJSON 배열만: ["키워드1",...,"키워드10"]'
        : '"'+cat+'" 애드포스트 수익 유리한 롱테일 키워드 10개. 고단가(대출/보험/카드/재테크/지원금) 우선.'+newsSection+excludeList+'\nJSON 배열만: ["키워드1",...,"키워드10"]';
    }

    const t=await geminiAsk(prompt,500,'gemini-2.0-flash');
    if(!t){chips.innerHTML='<span style="font-size:12px;color:var(--rd)">❌ Gemini 응답 없음: '+(window._lastGeminiErr||'API 키 확인')+'</span>';return;}
    let kws=[];
    try{const x=t.replace(/```json|```/g,'').trim().match(/\[[\s\S]*\]/);kws=JSON.parse(x?x[0]:t);}catch(e){}
    if(!Array.isArray(kws)||!kws.length){chips.innerHTML='<span style="font-size:12px;color:var(--rd)">❌ 키워드 파싱 실패. 다시 시도해주세요</span>';return;}
    if(!previousTsKeywords[cat])previousTsKeywords[cat]=[];
    previousTsKeywords[cat]=[...new Set([...previousTsKeywords[cat],...kws])].slice(0,15);
    chips.innerHTML='';
    kws.forEach(k=>{const el=document.createElement('span');el.className='chip';el.textContent=k;el.onclick=()=>{document.getElementById('tsKw').value=k;document.querySelectorAll('#tsChips .chip').forEach(c=>c.classList.remove('sel'));el.classList.add('sel');toast('✔ '+k);};chips.appendChild(el);});
  }catch(e){chips.innerHTML='<span style="font-size:12px;color:var(--rd)">오류: '+e.message+'</span>';}
  finally{btn.textContent='✦ 추천';btn.disabled=false;}
}
async function fetchHot(){
  if(!document.getElementById('geminiKey').value.trim()){toast('⚠ Gemini API 키를 먼저 입력해주세요');return;}
  const cat=document.getElementById('nvKwCat').value;
  const userKeyword=document.getElementById('nvKw').value.trim();
  const btn=document.getElementById('hotBtn');const chips=document.getElementById('nvChips');
  btn.textContent='⏳ 검색 중...';btn.disabled=true;
  chips.innerHTML='<span style="font-size:12px;color:var(--tx3)">실시간 트렌드 검색 중...</span>';
  try{
    let ctx='';
    const tk=document.getElementById('tavilyKey').value.trim();
    const gk=document.getElementById('geminiKey').value.trim();
    if(tk||gk||document.getElementById('naverClientId').value.trim()){
      setProg(5,'🔍 실시간 트렌드 검색 중...');
      const tRes = tk ? await tavilySearch(`${cat} 최신 이슈 뉴스 2026`) : null;
      const gRes = gk ? await geminiSearch(`${cat} 최신 이슈 뉴스 2026`) : null;
      const nRes = await naverSearch(`${cat} 최신 뉴스`);
      if(tRes) ctx += `\n\n[실시간뉴스 - Tavily]\n${tRes.slice(0,1200)}\n[끝]`;
      if(nRes) ctx += `\n\n[실시간뉴스 - 네이버]\n${nRes.slice(0,1200)}\n[끝]`;
      if(gRes) ctx += `\n\n[실시간뉴스 - Gemini]\n${gRes.slice(0,800)}\n[끝]`;
      setProg(0,'');
    }
    
    let excludeList='';
    if(previousNvKeywords && previousNvKeywords.length>0){
      excludeList='\n이미 추천한 키워드(제외): '+previousNvKeywords.slice(0,5).join(', ');
    }

    // 네이버+Tavily 뉴스에서 직접 키워드 추출 — Gemini가 선별
    const baseQ = userKeyword
      ? '다음은 "'+userKeyword+'" 관련 실시간 뉴스입니다.\n\n'+ctx+
        '\n\n위 뉴스 기반으로 "'+userKeyword+"\"과 직접 연관된 블로그 SEO 키워드 10개를 선별하세요."+
        '\n조건: 실제 뉴스에 등장한 키워드 우선, 검색량 높고 애드포스트 유리, "'+userKeyword+'"과 무관한 키워드 금지'+excludeList+
        '\nJSON 배열만 반환: ["키워드1",...,"키워드10"]'
      : '다음은 "'+cat+'" 카테고리 실시간 뉴스입니다.\n\n'+ctx+
        '\n\n위 뉴스 기반으로 지금 가장 핫한 블로그 키워드 10개를 선별하세요.'+
        '\n조건: 실제 뉴스에 등장한 키워드 우선, 검색량 높고 애드포스트 유리'+excludeList+
        '\nJSON 배열만 반환: ["키워드1",...,"키워드10"]';

    // Gemini로 선별 (Claude 사용 안 함)
    if(!gk){ chips.innerHTML='<span style="font-size:12px;color:var(--rd)">⚠ Gemini API 키가 필요합니다 (키워드 선별용)</span>'; btn.textContent='🔥 3일 이내 핫 키워드 자동 선별'; btn.disabled=false; return; }

    // ctx 없어도 Gemini 학습 데이터 기반으로 키워드 생성
    const finalQ = ctx ? baseQ
      : (userKeyword
          ? '"'+userKeyword+'" 관련 블로그 SEO 키워드 10개. 검색량 높고 애드포스트 유리한 것 우선.'+excludeList+'\nJSON 배열만 반환: ["키워드1",...,"키워드10"]'
          : '"'+cat+'" 카테고리 블로그 키워드 10개. 검색량 높고 애드포스트 고단가 우선.'+excludeList+'\nJSON 배열만 반환: ["키워드1",...,"키워드10"]');

    const t = await geminiAsk(finalQ, 500, 'gemini-2.0-flash');
    if(!t){chips.innerHTML='<span style="font-size:12px;color:var(--rd)">❌ Gemini 응답 없음: '+(window._lastGeminiErr||'API 키 확인')+'</span>';return;}
    let kws=[];
    try{const x=t.replace(/```json|```/g,'').trim().match(/\[[\s\S]*\]/);kws=JSON.parse(x?x[0]:t);}catch(e){}
    if(!Array.isArray(kws)||!kws.length){chips.innerHTML='<span style="font-size:12px;color:var(--rd)">❌ 키워드 파싱 실패. 다시 시도해주세요</span>';return;}
    previousNvKeywords=[...new Set([...previousNvKeywords,...kws])].slice(0,20);
    chips.innerHTML='';
    kws.forEach(k=>{const el=document.createElement('span');el.className='chip chip-hot';el.textContent=k;el.onclick=()=>{document.getElementById('nvKw').value=k;document.querySelectorAll('#nvChips .chip').forEach(c=>c.classList.remove('sel'));el.classList.add('sel');toast('🔥 선택: '+k);};chips.appendChild(el);});
    toast('🔥 핫 키워드 '+kws.length+'개 선별 완료!');
  }catch(e){chips.innerHTML='<span style="font-size:12px;color:var(--rd)">오류: '+e.message+'</span>';}
  finally{btn.textContent='🔥 3일 이내 핫 키워드 자동 선별';btn.disabled=false;}
}

/* ═══ 네이버 단독 생성 ═══ */
async function generateNaver(){
  const nvKw=document.getElementById('nvKw').value.trim();
  if(!document.getElementById('geminiKey').value.trim()){toast('⚠ Gemini API 키를 입력해주세요');return;}
  if(!nvKw){toast('⚠ 네이버 키워드를 입력해주세요');return;}

  const nick=document.getElementById('nickName').value.trim()||'블로거';
  const nvKwCat=document.getElementById('nvKwCat').value;
  const imgCount=parseInt(document.getElementById('imgCount').value);
  const nvChar=document.getElementById('nvChar').value;
  const optStr=opts.join(', ');
  const memoNv=document.getElementById('memoNv').value.trim();
  const opinionNv=document.getElementById('opinionNv').value.trim();
  const fNvKw=nvKw;

  const btn=document.getElementById('genNvBtn');
  btn.disabled=true;btn.textContent='⏳ 네이버 생성 중...';
  document.querySelector('.out-area').scrollTop=0;
  document.querySelector('.out-area').scrollIntoView({behavior:'smooth'});
  gd.nv=''; gd.nvPrompts=[];
  document.getElementById('saveBanner').classList.remove('on');
  document.getElementById('ok-nv').classList.remove('on');

  try{
    const expType = document.getElementById('experienceType')?.value || 'mixed';
    let expGuide = '';
    if(expType==='direct') expGuide='경험은 내 직접 경험(제가 ~) 위주로, 각 소제목 안에 1-2문장씩 자연스럽게 삽입';
    else if(expType==='indirect') expGuide='경험은 지인/주변 사람 경험(친구가/동료가 ~) 위주로, 각 소제목 안에 1-2문장씩 자연스럽게 삽입';
    else expGuide='직접 경험(제가 ~)과 지인 경험(친구가 ~)을 교차하며, 각 소제목 안에 자연스럽게 삽입';

    const tk=document.getElementById('tavilyKey').value.trim();
    const gk=document.getElementById('geminiKey').value.trim();
    const nid=document.getElementById('naverClientId').value.trim();

    /* ━━ STEP 1: 네이버 API — 핫 뉴스 5개 원문 수집 ━━ */
    let nvNews5='';
    if(nid){
      setProg(5,'[1] 네이버 뉴스 수집 중...');
      nvNews5 = await naverSearch(fNvKw+' 최신')||'';
      toast('✅ [1단계] 네이버 뉴스 수집 완료');
    }

    /* ━━ STEP 2: Tavily — 뉴스 심층 배경·추가 정보 검색 ━━ */
    let nvDeep='';
    if(tk){
      setProg(12,'[2] Tavily 심층 배경 검색 중...');
      nvDeep = await tavilySearch(fNvKw+' 배경 조건 기준 2026')||'';
      toast('✅ [2단계] Tavily 심층 정보 완료');
    }

    /* ━━ STEP 3: Gemini — 팩트 추출 + 목차 작성 ━━ */
    let nvOutline='';
    if(gk){
      setProg(22,'[3] Gemini 팩트 추출 + 목차 작성 중...');

      const makeOutlineQ = `다음 뉴스와 심층 정보를 분석해서 아래 두 가지를 작성하세요.\n\n[키워드]: ${fNvKw}\n[뉴스 원문 5개]:\n${nvNews5||"(없음)"}\n\n[심층 배경·추가 정보]:\n${nvDeep||"(없음)"}\n\n★ 출력 형식 (반드시 아래 두 섹션 포함):\n\n## 검증된 팩트\n- 날짜, 금액, 조건, 기준 등 수치는 뉴스 원문 기준으로만 추출\n- 불확실한 정보는 "확인필요" 표시\n- 뉴스에 없는 내용은 절대 추가하지 말 것\n\n## 블로그 목차 (네이버 모바일 최적화)\n- 소제목 6개 이상\n- 각 소제목 아래 해당 팩트와 연결되는 내용 요점 1줄씩\n- 추출한 팩트 수치를 소제목 또는 요점에 직접 반영\n- FAQ 5개 포함`;
      nvOutline = await geminiAsk(makeOutlineQ, 1200, 'gemini-2.0-flash')||''; // Text generation
      toast('✅ [3단계] Gemini 팩트+목차 완료');
    }

    const nvCtx = (nvOutline||nvNews5||nvDeep) ? `\n\n━━ Gemini 팩트·목차 (반드시 준수) ━━\n${(nvOutline||nvNews5||nvDeep).slice(0,2000)}\n★ 위 목차와 팩트 기반으로 집필. 팩트에 없는 수치·날짜 절대 임의 생성 금지\n━━ 끝 ━━` : '';

    /* ━━ STEP 2b: 나의 의견 보완 (나의 의견 입력 시) ━━ */
    let augOpinionNv='';
    if(opinionNv){
      setProg(18,'💭 의견 보완 중 (네이버)...');
      try{
        const opCtx = nvDeep ? `\n관련정보:\n${nvDeep.slice(0,400)}` : '';
        augOpinionNv = await geminiAsk(`블로거 의견: "${opinionNv}"\n키워드: ${fNvKw}${opCtx}\n\n위 의견을 블로그 본문에 자연스럽게 녹일 수 있도록 200자 내외로 보완하세요. 원래 경험은 살리고 구체적 정보 추가. 보완된 내용만 반환.`, 500, 'gemini-2.0-flash'); // Text generation
      }catch(e){augOpinionNv=opinionNv;}
    }

    /* ━━ STEP 3a: Gemini 3.1 Pro 네이버 글 작성 ━━ */
    setProg(20,'[3] Gemini 3.1 Pro-Preview 네이버 블로그 글 작성 중...');
    const nvMemo=memoNv?`\n\n━━ 블로그 주인 메모 (반드시 글에 녹여낼 것) ━━\n${memoNv}\n━━ 끝 ━━`:'';
    const nvOp=augOpinionNv?`\n\n━━ 블로그 주인 추가 의견 (글 중간에 자연스럽게 녹여낼 것) ━━\n${augOpinionNv}\n━━ 끝 ━━`:'';
    
    const nvPromptTemplate = `[네이버 블로그 — 애드포스트 수익 최적화 + 모바일]\n키워드: "${fNvKw}" | 카테고리: ${nvKwCat} | 목표: ${nvChar}자+ | 구성: ${optStr} | 이미지: ${imgCount}개\n\n★ 애드포스트 수익 전략 (필수 준수):\n\n【1. CTR 클릭률 극대화】\n- 제목: 숫자("3가지", "월 30만원") + 손해/혜택/궁금증 자극 표현 필수\n- 도입부 3줄: 독자 공감(상황 묘사) → 최신 이슈/문제 제시 → 해결책 암시 (30초컷 유도)\n- 각 소제목도 클릭욕구 자극하는 표현 사용\n\n【2. 황금 키워드 + 고단가 키워드 필수 포함】\n- 주제 키워드 "${fNvKw}"을 제목·소제목·본문에 자연스럽게 반복 배치\n- 대출, 보험, 카드, 주식, 재테크, 세금, 환급, 지원금, 복지, 청약 중 관련 키워드를 본문에 자연스럽게 포함\n- 카테고리 "${nvKwCat}" 관련 고단가 키워드를 소제목 또는 문단에 배치\n- 황금 키워드: 검색량 높고 시의성 있는 복합 키워드 소제목에 활용\n\n【3. 이슈성 + 정보성 결합】\n- 최신 뉴스·이유·배경을 도입부에서 시의성 있게 다룸 (단순 설명 금지)\n- 중반부: 구체적 수치/조건/절차/혜택 정보\n- 후반부: 독자 행동 유도(신청, 비교, 확인 등)\n\n【4. 체류시간 극대화】\n- 소제목 6개 이상 (각각 독립적 정보 단위)\n- FAQ 5개 이상 (실제 검색 의도와 일치)\n- 단계별 설명 또는 비교 목록 포함\n- 관련 카테고리 키워드로 추가 읽을거리 유도\n\n【5. 경험 자연스럽게 녹이기】\n- 경험을 별도 섹션으로 분리하지 말고 각 정보 문단 안에 자연스럽게 삽입\n- ${expGuide}\n- 경험 직후 바로 관련 팁/정보로 연결\n\n기술 규칙:\n- 한 문단 최대 2~3줄 (50자 이내) — 모바일 핵심\n- 표(table) 절대 금지\n- 단락 사이 빈 줄 필수\n- 마크다운 기호 절대 금지 (##, #, -, *, ** 금지)\n- 순수 텍스트 + 이모지만 사용\n\n형식:\n첫 줄: 제목: [CTR형 제목 - 숫자+혜택/손해/궁금증]\n도입부 3줄: 공감 + 이슈 + 해결 암시\n소제목 6개+: 이모지 + 자극적이고 정보적인 소제목\n각 소제목 아래: 3~4문단 + 경험 1-2문장 삽입\n마무리: 관련 정보 클릭 유도 + 댓글/공감/이웃추가\n\n★ 이미지 배치 규칙 (매우 중요, 절대 몰아서 넣지 말 것):\n- [이미지1 삽입 위치 - 설명]: 도입부 또는 첫 소제목 바로 뒤\n- [이미지2 삽입 위치 - 설명]: 두/세번째 소제목 뒤\n- [이미지3 삽입 위치 - 설명]: 중반부 소제목 뒤\n- [이미지4 삽입 위치 - 설명]: 후반부 소제목 뒤\n- [이미지5 삽입 위치 - 설명]: 마무리 직전 (해당하는 이미지 수 만큼만)\n- 반드시 각 소제목 사이사이에 분산 배치, 마지막에 몰아서 넣기 절대 금지\n\n태그 20개 맨 아래 (# 없이 줄바꿈)\nHTML 태그 없이 순수 텍스트${nvMemo}${nvOp}${nvCtx}\n역할: 대한민국 최고 블로그 SEO 전문가이자 애드포스트 수익화 전문 네이버 블로거 ${nick}. 카테고리: ${nvKwCat}.`;

    const nvText = await geminiAsk(nvPromptTemplate, 5500, 'gemini-2.0-flash');
    if(!nvText) throw new Error('Gemini 응답 없음: '+(window._lastGeminiErr||'API 키/모델 확인'));
    let cleanNvText = nvText.replace(/^#+\s/gm, '').replace(/^\s*[-*]\s/gm, '').replace(/\*\*/g, '').replace(/\uFFFD/g, '').trim();
    cleanNvText = cleanNvText.split(/\n{2,}/).map(p=>p.trim()).filter(Boolean).map(p=>p.replace(/([.?!])\s*(?=[^\n])/g,'$1\n')).join('\n\n');
    gd.nv = cleanNvText;
    document.getElementById('nvOut').textContent=cleanNvText;
    document.getElementById('ok-nv').classList.add('on');
    
    // 이미지 프롬프트 생성
    setProg(62,'[5] 네이버 이미지 프롬프트 생성 중...');
    const nvLines = gd.nv.split('\n').filter(l=>l.trim());
    const nvHeadings = nvLines.filter(l=>/^[^\s]/.test(l) && l.length < 60 && !/^(태그|Tags|#)/.test(l) && !/^\[이미지/.test(l)).slice(0,8);
    const nvImgMap = Array.from({length:imgCount},(_, i)=>{
      const h = nvHeadings[i] || nvHeadings[nvHeadings.length-1] || fNvKw;
      return `이미지${i+1}: "${h.slice(0,40)}" 소제목에 해당하는 이미지`;
    }).join('\n');
    const nvContent = gd.nv.replace(/\s+/g,' ').trim().slice(0,600);
    const imgPromptQ = `다음 블로그 글을 분석하여 각 소제목에 맞는 이미지 프롬프트를 JSON으로 생성하세요.\n\n[네이버 키워드]: ${fNvKw}\n\n[네이버 글 내용]:\n${nvContent}\n\n[이미지-소제목 매핑]:\n${nvImgMap}\n\n★ 규칙:\n1. 각 이미지는 매핑된 소제목 내용만 표현\n2. 글에 없는 내용, 추상적 이미지 금지\n3. 매번 고유한 내용 (중복 금지)\n4. 정책/지원금/금융→인포그래픽·카드뉴스 스타일\n5. prompt_en: 미드저니/DALL-E용 영어 (피사체+구도+색감+스타일 포함, 4K/8K 등 고해상도 키워드 금지, 자연스러운 일반 화질 느낌)\n6. prompt_gpt: ChatGPT·Canva용 한국어 상세 프롬프트 (고해상도 키워드 제외)\n7. prompt_ko: 짧은 한국어 프롬프트\n\nJSON 배열만 반환 (총 ${imgCount}개):\n[{"type":"naver","num":1,"title":"20자내","prompt_en":"영어","prompt_gpt":"한국어상세","prompt_ko":"짧은한국어","caption":"40자내","filename":"naver-xxx.jpg"},...]`;
    
    let promptRaw = await geminiAsk(imgPromptQ, 3000, 'gemini-2.0-flash');
    if(!promptRaw || promptRaw.length < 50){
      promptRaw = await geminiAsk(imgPromptQ, 3500, 'gemini-2.0-flash');
    }

    let allPrompts=[];
    try{
      const x=(promptRaw||'').replace(/```json|```/g,'').trim().match(/\[[\s\S]*\]/);
      allPrompts=JSON.parse(x?x[0]:promptRaw);
      if(!Array.isArray(allPrompts)) allPrompts=[allPrompts];
    }catch(e){
      document.getElementById('pgrid-nv').innerHTML = `<div style="color:var(--tx3);font-size:13px;white-space:pre-wrap;">파싱 실패:<br>${promptRaw}</div>`;
    }
    gd.nvPrompts = allPrompts.map((p,i)=>({...p, type:'naver', num:(p.num||i+1)}));
    
    Object.keys(allPromptData).forEach(k => { if(k.includes('prompt-nv')) delete allPromptData[k]; });
    renderPromptCards('pgrid-nv', gd.nvPrompts, 'nv');

    /* ━━ STEP 6: Imagen 자동 생성 ━━ */
    setProg(75, '🎨 Imagen 3 네이버 이미지 자동 생성 중...');
    await generateAllGeminiImages('nv');

    /* ⑤ 로컬이면 파일 자동 저장 */
    if(isLocal){
      setProg(88,'💾 바탕화면에 저장 중...');
      try{
        const saveRes=await fetch('/api/save-all',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({nv:gd.nv, ts:gd.ts, nvPrompts:gd.nvPrompts, tsPrompts:gd.tsPrompts})
        });
        const saveData=await saveRes.json();
        if(saveData.folder){
          document.getElementById('saveBanner').classList.add('on');
          document.getElementById('savePath').textContent='📁 '+saveData.folder;
          document.getElementById('saveList').innerHTML=saveData.saved.join('<br>');
          const today=new Date().toISOString().slice(0,10);
          toast(`🎉 저장 완료! 바탕화면 블로그\\${today} 폴더 열렸어요!`,5000);
          addLog(`✅ 저장 완료: ${saveData.saved.length}개 파일`,'lok');
        }
      }catch(e){
        toast('⚠ 파일 저장 실패: '+e.message);
      }
    }

    /* ⑥ 깃허브 자동 푸시 */
    setProg(93,'🚀 깃허브에 자동 푸시 중...');
    try{
      const gitRes=await fetch('/api/git-push',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message:`BlogAI: ${fNvKw||fTsKw} 콘텐츠 생성 완료`})
      });
      const gitData=await gitRes.json();
      if(gitData.success){
        toast('🚀 깃허브 자동 푸시 완료!',3000);
        addLog('✅ 깃허브 자동 푸시 완료','lok');
      }else{
        console.warn('깃 푸시 경고:',gitData);
        addLog('⚠ 깃 푸시: '+gitData.message,'linf');
      }
    }catch(e){
      console.warn('깃 푸시 오류 (무시됨):', e.message);
      addLog('⚠ 깃 푸시 불가 (Git 미설정)','linf');
    }

    setProg(100,'✅ 완료!');
    showTab('img');
    if(window.innerWidth<=768)mv('r');

    if(!isLocal) toast('✅ 완료! 이미지 탭에서 프롬프트 확인하세요',4000);

    autoSave();
    saveHist(fNvKw,'',gd.ts,gd.nv);
    addLog(`✅ 완료 NV:${fNvKw}`,'lok');
    setTimeout(()=>setProg(0,''),4000);

  }catch(e){
    setProg(0,'');toast('❌ '+(e.message||'오류 발생'));
    addLog('❌ 오류: '+e.message,'lerr');console.error(e);
  }finally{
    btn.disabled=false;btn.textContent='📱 네이버 단독 생성';
  }
}

/* ═══ 티스토리 단독 생성 ═══ */
async function generateTistory(){
  const tsKw=document.getElementById('tsKw').value.trim();
  if(!document.getElementById('geminiKey').value.trim()){toast('⚠ Gemini API 키를 입력해주세요');return;}
  if(!tsKw){toast('⚠ 티스토리 키워드를 입력해주세요');return;}

  const nick=document.getElementById('nickName').value.trim()||'블로거';
  const tsKwCat=document.getElementById('tsKwCat').value;
  const imgCount=parseInt(document.getElementById('imgCount').value)||3;
  const tsChar=document.getElementById('tsChar').value||'2500';
  const optStr=opts.join(', ');
  const memoTs=document.getElementById('memoTs').value.trim();
  const opinionTs=document.getElementById('opinionTs').value.trim();
  const fTsKw=tsKw;

  const btn=document.getElementById('genTsBtn');
  btn.disabled=true;btn.textContent='⏳ 티스토리 생성 중...';
  document.querySelector('.out-area').scrollTop=0;
  gd.ts=''; gd.tsPrompts=[];
  document.getElementById('ok-ts').classList.remove('on');

  try{
    const expType=document.getElementById('experienceType')?.value||'mixed';
    let expGuide='';
    if(expType==='direct') expGuide='경험은 내 직접 경험(제가 ~) 위주로, 각 소제목 안에 1-2문장씩 자연스럽게 삽입';
    else if(expType==='indirect') expGuide='경험은 지인/주변 사람 경험(친구가/동료가 ~) 위주로, 각 소제목 안에 1-2문장씩 자연스럽게 삽입';
    else expGuide='직접 경험(제가 ~)과 지인 경험(친구가 ~)을 교차하며, 각 소제목 안에 자연스럽게 삽입';

    const tk=document.getElementById('tavilyKey').value.trim();
    const gk=document.getElementById('geminiKey').value.trim();
    const nid=document.getElementById('naverClientId').value.trim();

    /* STEP 1: 네이버 뉴스 수집 */
    let tsNews5='';
    if(nid){
      setProg(5,'[1] 네이버 뉴스 수집 중...');
      tsNews5=await naverSearch(fTsKw+' 최신')||'';
    }

    /* STEP 2: Tavily 심층 정보 */
    let tsDeep='';
    if(tk){
      setProg(12,'[2] Tavily 심층 배경 검색 중...');
      tsDeep=await tavilySearch(fTsKw+' 상세 정보 2026')||'';
    }

    /* STEP 3: Gemini 팩트+목차 */
    let tsOutline='';
    if(gk){
      setProg(22,'[3] Gemini 팩트 추출 + 목차 작성 중...');
      const outlineQ=`다음 뉴스와 심층 정보를 분석해서 아래 두 가지를 작성하세요.\n\n[키워드]: ${fTsKw}\n[뉴스 원문 5개]:\n${tsNews5||'(없음)'}\n\n[심층 배경·추가 정보]:\n${tsDeep||'(없음)'}\n\n★ 출력 형식:\n## 검증된 팩트\n- 날짜, 금액, 조건, 기준 등 수치는 뉴스 원문 기준으로만 추출\n- 불확실한 정보는 "확인필요" 표시\n## 블로그 목차 (티스토리 HTML)\n- h2 소제목 6개 이상\n- 각 소제목 아래 요점 1줄\n- FAQ 5개 포함`;
      tsOutline=await geminiAsk(outlineQ,1200)||'';
    }

    const tsCtx=(tsOutline||tsNews5||tsDeep)?`\n\n━━ Gemini 팩트·목차 (반드시 준수) ━━\n${(tsOutline||tsNews5||tsDeep).slice(0,2000)}\n★ 팩트에 없는 수치·날짜 절대 임의 생성 금지\n━━ 끝 ━━`:'';

    /* 의견 보완 */
    let augOpinionTs='';
    if(opinionTs){
      setProg(18,'💭 의견 보완 중...');
      try{
        const opCtx=tsDeep?`\n관련정보:\n${tsDeep.slice(0,400)}`:'';
        augOpinionTs=await geminiAsk(`블로거 의견: "${opinionTs}"\n키워드: ${fTsKw}${opCtx}\n\n위 의견을 블로그 본문에 자연스럽게 녹일 수 있도록 200자 내외로 보완하세요. 원래 경험은 살리고 구체적 정보 추가. 보완된 내용만 반환.`,500)||opinionTs;
      }catch(e){augOpinionTs=opinionTs;}
    }

    /* STEP 4: Gemini 티스토리 HTML 작성 */
    setProg(35,'[4] 티스토리 HTML 작성 중...');
    const tsMemo=memoTs?`\n\n━━ 블로그 주인 메모 (반드시 글에 녹여낼 것) ━━\n${memoTs}\n━━ 끝 ━━`:'';
    const tsOp=augOpinionTs?`\n\n━━ 블로그 주인 추가 의견 (글 중간에 자연스럽게 녹여낼 것) ━━\n${augOpinionTs}\n━━ 끝 ━━`:'';

    const tsPromptTemplate=`[티스토리 블로그 — HTML 형식 SEO 최적화]\n키워드: "${fTsKw}" | 카테고리: ${tsKwCat} | 목표: ${tsChar}자+ | 구성: ${optStr} | 이미지: ${imgCount}개\n\n★ 티스토리 HTML 규칙 (필수):\n- 반드시 완전한 HTML 코드로 작성 (body 내용만, html/head 태그 불필요)\n- <h2> 소제목 6개 이상 (SEO 키워드 포함)\n- <h3> 부제목 활용\n- <p> 단락 (2~3문장)\n- <ul><li> 목록 활용\n- <strong> 중요 키워드 강조\n- <br><br> 단락 사이 간격\n- 표(table) 금지\n- 이모지 적극 활용\n\n★ SEO 전략:\n- 제목: <h1> 또는 첫 <h2>에 키워드 "${fTsKw}" 포함\n- 본문 전체에 키워드 자연스럽게 반복 배치\n- FAQ <h2> 섹션 5개 이상 포함\n- 카테고리 "${tsKwCat}" 관련 고단가 키워드 포함\n\n★ 경험 자연스럽게 녹이기:\n- ${expGuide}\n\n★ 이미지 배치:\n- <!-- 이미지1 --> 부터 <!-- 이미지${imgCount} --> 주석으로 각 이미지 위치 표시\n- 소제목 사이사이에 분산 배치\n\n맨 아래 태그 20개: <p>태그1, 태그2, ...</p>형식${tsMemo}${tsOp}${tsCtx}\n역할: 대한민국 최고 티스토리 SEO 전문가이자 수익형 블로거 ${nick}. 카테고리: ${tsKwCat}.`;

    const tsText=await geminiAsk(tsPromptTemplate,5500,'gemini-2.0-flash');
    if(!tsText) throw new Error('Gemini 응답 없음: '+(window._lastGeminiErr||'API 키/모델 확인'));

    gd.ts=tsText;
    document.getElementById('tsOut').textContent=tsText;
    document.getElementById('ok-ts').classList.add('on');

    /* STEP 5: 이미지 프롬프트 생성 */
    setProg(62,'[5] 티스토리 이미지 프롬프트 생성 중...');
    const tsContent=gd.ts.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,600);
    const tsHeadings=(gd.ts.match(/<h[23][^>]*>(.*?)<\/h[23]>/gi)||[]).map(h=>h.replace(/<[^>]*>/g,'').trim()).slice(0,8);
    const tsImgMap=Array.from({length:imgCount},(_,i)=>{
      const h=tsHeadings[i]||tsHeadings[tsHeadings.length-1]||fTsKw;
      return `이미지${i+1}: "${h.slice(0,40)}" 소제목에 해당하는 이미지`;
    }).join('\n');

    const tsImgPromptQ=`다음 블로그 글을 분석하여 각 소제목에 맞는 이미지 프롬프트를 JSON으로 생성하세요.\n\n[티스토리 키워드]: ${fTsKw}\n\n[글 내용 요약]:\n${tsContent}\n\n[이미지-소제목 매핑]:\n${tsImgMap}\n\n★ 규칙:\n1. 각 이미지는 매핑된 소제목 내용만 표현\n2. 글에 없는 내용, 추상적 이미지 금지\n3. prompt_en: 미드저니/DALL-E용 영어\n4. prompt_gpt: ChatGPT·Canva용 한국어 상세\n5. prompt_ko: 짧은 한국어 프롬프트\n\nJSON 배열만 반환 (총 ${imgCount}개):\n[{"type":"tistory","num":1,"title":"20자내","prompt_en":"영어","prompt_gpt":"한국어상세","prompt_ko":"짧은한국어","caption":"40자내","filename":"tistory-xxx.jpg"},...]`;

    let tsPromptRaw=await geminiAsk(tsImgPromptQ,3000,'gemini-2.0-flash');
    if(!tsPromptRaw||tsPromptRaw.length<50) tsPromptRaw=await geminiAsk(tsImgPromptQ,3500,'gemini-2.0-flash');

    let tsAllPrompts=[];
    try{
      const x=(tsPromptRaw||'').replace(/```json|```/g,'').trim().match(/\[[\s\S]*\]/);
      tsAllPrompts=JSON.parse(x?x[0]:tsPromptRaw);
      if(!Array.isArray(tsAllPrompts)) tsAllPrompts=[tsAllPrompts];
    }catch(e){
      document.getElementById('pgrid-ts').innerHTML=`<div style="color:var(--tx3);font-size:13px;white-space:pre-wrap;">파싱 실패:<br>${tsPromptRaw}</div>`;
    }
    gd.tsPrompts=tsAllPrompts.map((p,i)=>({...p,type:'tistory',num:(p.num||i+1)}));
    renderPromptCards('pgrid-ts',gd.tsPrompts,'ts');

    /* 로컬 저장 */
    if(isLocal){
      setProg(88,'💾 저장 중...');
      try{
        const saveRes=await fetch('/api/save-all',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nv:gd.nv,ts:gd.ts,nvPrompts:gd.nvPrompts,tsPrompts:gd.tsPrompts})});
        const saveData=await saveRes.json();
        if(saveData.folder){toast(`🎉 저장 완료! 바탕화면 폴더 열렸어요!`,4000);addLog(`✅ 저장 완료: ${saveData.saved.length}개 파일`,'lok');}
      }catch(e){toast('⚠ 파일 저장 실패: '+e.message);}
    }

    setProg(100,'✅ 완료!');
    showTab('ts');
    if(window.innerWidth<=768)mv('r');
    toast('✅ 티스토리 완료! 티스토리 탭에서 확인하세요',4000);
    autoSave();
    saveHist('',fTsKw,gd.ts,gd.nv);
    addLog(`✅ 완료 TS:${fTsKw}`,'lok');
    setTimeout(()=>setProg(0,''),4000);

  }catch(e){
    setProg(0,'');toast('❌ '+(e.message||'오류 발생'));
    addLog('❌ 티스토리 오류: '+e.message,'lerr');console.error(e);
  }finally{
    btn.disabled=false;btn.textContent='✈️ 티스토리 단독 생성';
  }
}

/* ═══ 프롬프트 카드 렌더링 ═══ */
function renderPromptCards(gridId, prompts, type){
  const grid=document.getElementById(gridId);
  if(!prompts||!prompts.length){grid.innerHTML='<div style="color:var(--tx3);font-size:13px;text-align:center;padding:20px">프롬프트 생성 실패</div>';return;}
  grid.innerHTML='';
  const color=type==='nv'?'var(--nv)':'var(--ts)';
  const label=type==='nv'?'📱 네이버':'✈️ 티스토리';

  prompts.forEach((p,i)=>{
    const card=document.createElement('div');
    card.className='prompt-card';
    const uniqueId=`prompt-${type}-${i}`;
    card.innerHTML=`
      <div class="pc-hdr">
        <div>
          <div class="pc-num" style="color:${color}">${label} 이미지 ${p.num||i+1}</div>
          <div class="pc-title">${p.title||''}</div>
        </div>
        <div style="font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--tl)">${p.filename||''}</div>
      </div>
      <div class="pc-body">
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
            <div class="pc-label" style="color:var(--tl);margin-bottom:0">🇺🇸 영어 프롬프트 (미드저니 · ChatGPT)</div>
            <button class="btn-sm" style="padding:3px 8px;font-size:11px" onclick="copyPromptText('${uniqueId}-en')">📋 복사</button>
          </div>
          <div class="pc-en">${p.prompt_en||''}</div>
          <textarea id="${uniqueId}-en" style="display:none">${p.prompt_en||''}</textarea>
        </div>
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
            <div class="pc-label" style="color:var(--am);margin-bottom:0">🇰🇷 한국어 프롬프트 (Canva · 네이버AI)</div>
            <button class="btn-sm" style="padding:3px 8px;font-size:11px" onclick="copyPromptText('${uniqueId}-ko')">📋 복사</button>
          </div>
          <div class="pc-ko">${p.prompt_ko||''}</div>
          <textarea id="${uniqueId}-ko" style="display:none">${p.prompt_ko||''}</textarea>
        </div>
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
            <div class="pc-label" style="color:var(--nv);margin-bottom:0">🤖 Gemini/ChatGPT 프롬프트</div>
            <button class="btn-sm" style="padding:3px 8px;font-size:11px" onclick="copyPromptText('${uniqueId}-gpt')">📋 복사</button>
          </div>
          <div class="pc-en" style="color:var(--nv)">${p.prompt_gpt||''}</div>
          <textarea id="${uniqueId}-gpt" style="display:none">${p.prompt_gpt||''}</textarea>
        </div>
        <div style="font-size:11px;color:var(--tx3);padding:5px 0;border-top:1px solid var(--bd);margin-top:4px">${p.caption||''}</div>
      </div>`;
    allPromptData[uniqueId] = p;
    grid.appendChild(card);
  });
}

function copyPromptText(elementId){
  const textarea=document.getElementById(elementId);
  if(!textarea){toast('⚠ 복사 오류');return;}
  navigator.clipboard.writeText(textarea.value).then(()=>toast('📋 프롬프트 복사됐어요!')).catch(err=>toast('❌ 복사 실패'));
}


/* ═══ Gemini 이미지 자동 생성 ═══ */
async function generateGeminiImage(uid) {
  const key = document.getElementById('geminiKey').value.trim();
  if (!key) { toast('⚠ Gemini API 키를 입력해주세요'); return; }
  const p = allPromptData[uid];
  if (!p) { toast('⚠ 프롬프트 데이터 없음'); return; }
  const btn = document.getElementById(uid + '-gbtn');
  const imgEl = document.getElementById(uid + '-gimg');
  const dlBtn = document.getElementById(uid + '-gdl');
  if (!btn || !imgEl || !dlBtn) return;
  btn.disabled = true;
  btn.textContent = '⏳ 생성 중...';
  try {
    const prompt = p.prompt_gpt || p.prompt_en || p.prompt_ko || p.title || '';
    const r = await fetch('/api/gemini-image', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({apiKey: key, prompt: prompt})
    });
    const rawText = await r.text();
    let data;
    try { data = JSON.parse(rawText); }
    catch(pe) { toast('❌ Gemini 서버 오류: 서버를 재시작해 주세요 (응답이 HTML)'); btn.disabled=false; btn.textContent='🎨 Gemini로 이미지 생성'; return; }
    if (data.imageData) {
      const mtype = data.mimeType || 'image/png';
      const src = 'data:' + mtype + ';base64,' + data.imageData;
      imgEl.src = src;
      imgEl.style.display = 'block';
      dlBtn.classList.add('on');
      dlBtn.onclick = function() {
        const a = document.createElement('a');
        a.href = src;
        a.download = p.filename || 'gemini-image.png';
        a.click();
        toast('💾 이미지 다운로드!');
      };
      if (isLocal) {
        try {
          await fetch('/api/save-image', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({imageData: data.imageData, mimeType: mtype, filename: p.filename})
          });
          toast('✅ 이미지 생성 + 바탕화면 저장 완료!');
        } catch(se) { toast('✅ 이미지 생성 완료! (저장 실패: ' + se.message + ')'); }
      } else {
        toast('✅ 이미지 생성 완료! 다운로드 버튼을 눌러주세요');
      }
    } else {
      const errMsg = (data.raw && data.raw.message) ? data.raw.message : (data.error || '지원하지 않는 API 키 또는 권한 없음');
      toast('❌ 이미지 생성 실패: ' + errMsg);
    }
  } catch(e) {
    toast('❌ Gemini 오류: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '🎨 Gemini로 이미지 생성';
  }
}

async function generateAllGeminiImages(target) {
  const key = document.getElementById('geminiKey').value.trim();
  if (!key) { toast('⚠ Gemini API 키를 입력해주세요'); return; }
  
  const keys = Object.keys(allPromptData).filter(uid => target ? uid.includes(`prompt-${target}`) : true);
  if (!keys.length) { toast('⚠ 먼저 글과 프롬프트를 생성해주세요'); return; }
  
  const allBtn = document.getElementById('geminiAllBtn');
  if (allBtn && !target) { allBtn.disabled = true; allBtn.textContent = '⏳ 전체 이미지 생성 중...'; }
  let success = 0, fail = 0;
  const generatedImgs = [];
  for (const uid of keys) {
    try {
      await generateGeminiImage(uid);
      const imgEl = document.getElementById(uid + '-gimg');
      const p = allPromptData[uid];
      if (imgEl && imgEl.src && imgEl.src.startsWith('data:')) {
        generatedImgs.push({ src: imgEl.src, filename: p.filename || uid + '.png' });
      }
      success++;
      await new Promise(res => setTimeout(res, 3000));
    } catch(e) { fail++; }
  }
  if (allBtn) { allBtn.disabled = false; allBtn.textContent = '🎨 Gemini로 전체 이미지 한번에 생성'; }
  // 로컬이면 서버 저장, Vercel이면 ZIP 다운로드
  if (!isLocal && generatedImgs.length > 0) {
    try {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      document.head.appendChild(script);
      await new Promise(res => script.onload = res);
      const zip = new JSZip();
      generatedImgs.forEach(img => {
        const base64 = img.src.split(',')[1];
        zip.file(img.filename, base64, {base64: true});
      });
      const blob = await zip.generateAsync({type:'blob'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `blog-images-${target||'all'}-` + new Date().toISOString().slice(0,10) + '.zip';
      a.click();
      toast('✅ 완료! 성공: ' + success + '개 — ZIP으로 다운로드됨');
    } catch(ze) { toast('✅ 완료! 성공: ' + success + '개 / 실패: ' + fail + '개'); }
  } else {
    toast('✅ 완료! 성공: ' + success + '개 / 실패: ' + fail + '개' + (isLocal ? ' (바탕화면 저장됨)' : ''));
  }
}

/* ═══ 수정 요청 ═══ */
async function doFix(){
  const gk=document.getElementById('geminiKey').value.trim();
  if(!gk){toast('⚠ Gemini API 키를 입력해주세요');return;}
  const req=document.getElementById('fixReq').value.trim();
  if(!req){toast('⚠ 수정 요청 내용을 입력해주세요');return;}
  const content=fixTarget==='nv'?gd.nv:gd.ts;
  if(!content){toast('⚠ 먼저 글을 생성해주세요');return;}
  const btn=document.getElementById('fixBtn');
  btn.disabled=true;btn.textContent='⏳ 수정 중...';
  document.getElementById('fixResultArea').style.display='none';
  try{
    const result=await geminiAsk(`다음 ${fixTarget==='nv'?'네이버 블로그 텍스트':'티스토리 HTML'} 글을 아래 요청에 따라 수정해주세요.\n\n[수정 요청]\n${req}\n\n[현재 글]\n${content}\n\n수정된 글 전체만 반환. 설명 없이.`, 5500, 'gemini-2.0-flash'); // Text generation
    document.getElementById('fixResult').textContent=result;
    document.getElementById('fixResultArea').style.display='block';
    toast('✅ 수정 완료! 확인 후 반영하기 눌러주세요');
  }catch(e){toast('❌ 수정 오류: '+e.message);}
  finally{btn.disabled=false;btn.textContent='✦ Gemini에게 수정 요청하기';}
}
function applyFix(){
  const result=document.getElementById('fixResult').textContent;
  if(!result){toast('⚠ 수정 내용 없음');return;}
  if(fixTarget==='nv'){gd.nv=result;document.getElementById('nvOut').textContent=result;toast('✅ 네이버 글 반영!');showTab('nv');}
  else{gd.ts=result;document.getElementById('tsOut').textContent=result;toast('✅ 티스토리 글 반영!');showTab('ts');}
}

/* ═══ HISTORY ═══ */
function saveHist(nvKw,tsKw,ts,nv){
  let h=JSON.parse(localStorage.getItem('bai_hist')||'[]');
  h.unshift({id:Date.now(),nvKw,tsKw,date:new Date().toLocaleDateString('ko-KR'),ts,nv});
  if(h.length>15)h=h.slice(0,15);
  localStorage.setItem('bai_hist',JSON.stringify(h));renderHist();
}
function loadHist(id){
  const h=JSON.parse(localStorage.getItem('bai_hist')||'[]');
  const item=h.find(x=>x.id===id);if(!item)return;
  gd.ts=item.ts;gd.nv=item.nv;
  document.getElementById('tsOut').textContent=item.ts;
  document.getElementById('nvOut').textContent=item.nv;
  document.getElementById('ok-ts').classList.add('on');document.getElementById('ok-nv').classList.add('on');
  if(item.nvKw)document.getElementById('nvKw').value=item.nvKw;
  if(item.tsKw)document.getElementById('tsKw').value=item.tsKw;
  showTab('nv');toast('🕘 히스토리 불러왔어요');
}
function delHist(id,e){
  e.stopPropagation();let h=JSON.parse(localStorage.getItem('bai_hist')||'[]');
  h=h.filter(x=>x.id!==id);localStorage.setItem('bai_hist',JSON.stringify(h));renderHist();toast('🗑 삭제됨');
}
function clearHist(){if(!confirm('히스토리 전부 삭제?'))return;localStorage.removeItem('bai_hist');renderHist();toast('🗑 전체 삭제됨');}
function renderHist(){
  const h=JSON.parse(localStorage.getItem('bai_hist')||'[]');
  const el=document.getElementById('histList');if(!el)return;
  if(!h.length){el.innerHTML='<div style="color:var(--tx3);font-size:13px;text-align:center;padding:24px 0">히스토리가 없어요</div>';return;}
  el.innerHTML=h.map(i=>`
    <div class="hi" onclick="loadHist(${i.id})">
      <div style="font-size:16px">📄</div>
      <div class="hi-kw"><div class="hi-nv">📱 ${i.nvKw||'—'}</div><div class="hi-ts">✈️ ${i.tsKw||'—'}</div></div>
      <div class="hi-date">${i.date}</div>
      <button class="hi-del" onclick="delHist(${i.id},event)">×</button>
    </div>`).join('');
}

/* ═══ SCHEDULER ═══ */
function toggleSched(restore=false){
  const on=document.getElementById('schedTgl').checked;schedActive=on;
  if(on){
    localStorage.setItem('bai_sched','1');
    localStorage.setItem('bai_st1',document.getElementById('st1').value);
    localStorage.setItem('bai_st2',document.getElementById('st2').value);
    if(schedTimer)clearInterval(schedTimer);
    schedTimer=setInterval(checkSched,30000);checkSched();
    document.getElementById('nextBox').style.display='block';
    if(!restore){addLog('🟢 스케줄러 시작','lok');toast('⏰ 스케줄러 활성화!');}
    updateNextRun();
  }else{
    localStorage.removeItem('bai_sched');
    if(schedTimer){clearInterval(schedTimer);schedTimer=null;}
    document.getElementById('nextBox').style.display='none';
    addLog('⭕ 스케줄러 중지','linf');
  }
}
async function checkSched(){
  if(!schedActive)return;
  const now=new Date(),h=now.getHours(),m=now.getMinutes(),td=now.toDateString();
  const[h1,m1]=document.getElementById('st1').value.split(':').map(Number);
  const[h2,m2]=document.getElementById('st2').value.split(':').map(Number);
  const k1=`${td}-r1`,k2=`${td}-r2`;
  if(h===h1&&Math.abs(m-m1)<=1&&!localStorage.getItem(k1)){localStorage.setItem(k1,'1');addLog('🌅 오전 자동 실행','linf');toast('🌅 오전 자동 생성 시작!');await autoRun();}
  if(h===h2&&Math.abs(m-m2)<=1&&!localStorage.getItem(k2)){localStorage.setItem(k2,'1');addLog('☀️ 오후 자동 실행','linf');toast('☀️ 오후 자동 생성 시작!');await autoRun();}
  updateNextRun();
}
async function autoRun(){
  const gk=document.getElementById('geminiKey').value.trim();if(!gk){addLog('❌ API 키 없음','lerr');return;}
  const tk=document.getElementById('tavilyKey').value.trim();
  if(tk){
    try{
      const cat=document.getElementById('nvKwCat').value;
      const res=await tavilySearch(`${cat} 최신 이슈 2026`);
      let ctx=res?`\n\n[검색]\n${res.slice(0,1200)}\n[끝]`:'';
      const kw=await geminiAsk(`"${cat}" 최근 3일 이내 핫한 키워드 1개.${ctx}\n키워드 1개만 반환:`, 200, 'gemini-2.0-flash');
      const clean=kw.replace(/["'\n]/g,'').trim().slice(0,50);
      if(clean){document.getElementById('nvKw').value=clean;addLog(`🔥 키워드: ${clean}`,'lok');}
    }catch(e){addLog('⚠ 키워드 갱신 실패','lerr');}
  }
  await generateNaver();
  await generateTistory();
}
function updateNextRun(){
  if(!schedActive)return;
  const now=new Date();
  const[h1,m1]=document.getElementById('st1').value.split(':').map(Number);
  const[h2,m2]=document.getElementById('st2').value.split(':').map(Number);
  const n1=new Date(now);n1.setHours(h1,m1,0,0);if(n1<=now)n1.setDate(n1.getDate()+1);
  const n2=new Date(now);n2.setHours(h2,m2,0,0);if(n2<=now)n2.setDate(n2.getDate()+1);
  const next=n1<n2?n1:n2;const diff=next-now;
  const dh=Math.floor(diff/3600000),dm=Math.floor((diff%3600000)/60000);
  document.getElementById('nextVal').textContent=`${next===n1?'오전 '+document.getElementById('st1').value:'오후 '+document.getElementById('st2').value} (${dh}시간 ${dm}분 후)`;
}

/* ═══ INIT ═══ */
loadKeys();
renderHist();
detectMode(); // 로컬/Vercel 자동 감지
