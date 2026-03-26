# BlogAI v10 — Vercel 배포용

네이버(실시간 핫이슈) + 티스토리(여행) 자동 블로그 생성기

---

## ⚡ 로컬 개발 (VS Code)

### 사전 준비
- [Node.js](https://nodejs.org) v18+
- [Vercel CLI](https://vercel.com/cli): `npm i -g vercel`

### 실행
```bash
# 1. 의존성 설치
npm install

# 2. 로컬 서버 시작 (API 포함)
vercel dev
# → http://localhost:3000
```

> `vercel dev` 명령이 `/api/*.js` 서버리스 함수를 로컬에서 그대로 실행해줍니다.
> Node.js만 있으면 됩니다. 별도 서버 설정 불필요.

---

## 🚀 Vercel 배포 (무료)

```bash
# 1. Vercel 로그인 (최초 1회)
vercel login

# 2. 배포
vercel --prod
```

배포 후 받은 URL로 어디서든 접속 가능.

### 환경변수 설정 (선택)
Vercel 대시보드 → Settings → Environment Variables:
```
CLAUDE_API_KEY = sk-ant-api03-...
TAVILY_API_KEY = tvly-...
```
설정하면 브라우저에 키 입력 안해도 됨.

---

## 🔑 API 키

| 키 | 필수 여부 | 발급처 |
|----|----------|--------|
| Claude API | 필수 | console.anthropic.com |
| Tavily API | 선택 | app.tavily.com (무료 1,000회/월) |

- **Tavily 없으면**: Claude 자체 지식으로 생성 (실시간 뉴스 미반영)
- **Tavily 있으면**: 3일 이내 실시간 뉴스 기반으로 생성

---

## 📋 기능 요약

### 생성
1. API 키 입력 → 키워드 입력 (또는 🔥 핫 키워드 자동 선별)
2. **내 의견/메모** 입력 (선택) → 실제 경험이 글에 반영됨
3. ✦ 딸깍! 버튼 → 네이버 + 티스토리 + 이미지 동시 완성

### 이미지 스타일 5종
| 스타일 | 설명 |
|--------|------|
| 📸 썸네일 | 사진+그래픽 혼합 |
| 🌄 여행사진 | 자연광 사실적 사진 |
| 📊 인포그래픽 | 데이터 시각화 |
| 📰 카드뉴스 | SNS 공유용 카드 |
| 🎨 다양하게 | 이미지마다 랜덤 스타일 |

### 수정 요청 (✏️ 탭)
생성된 글 → 수정 유형 선택 or 자유 입력 → Claude 즉시 수정 → 반영하기

### 자동 스케줄러
- 오전 8시 / 오후 3시 자동 실행 (시간 변경 가능)
- Tavily 키 있으면 실행 전 핫 키워드 자동 갱신

---

## 📁 파일 구조
```
blogai-vercel/
├── vercel.json          # Vercel 라우팅 설정
├── package.json
├── README.md
├── api/
│   ├── claude.js        # Claude API 프록시
│   ├── tavily.js        # Tavily 검색 프록시
│   └── image.js         # 이미지 생성 + 서버사이드 다운로드
└── public/
    └── index.html       # 메인 앱 전체
```

---

## 🔧 문제 해결

| 문제 | 해결 |
|------|------|
| `vercel dev` 오류 | `npm i -g vercel` 후 재시도 |
| 이미지 다운로드 안됨 | `/api/image` 서버리스 함수 확인 |
| Claude 오류 | API 키 확인, 잔액 확인 |
| Tavily 검색 안됨 | 키 확인, 월 1,000회 한도 확인 |

---

## 수정 요청
앱 내 **✏️ 수정 요청** 탭을 사용하세요.
코드 수정이 필요하면 Claude에게 직접 요청하세요.
