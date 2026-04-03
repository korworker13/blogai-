// Vercel 웹 버전에서는 파일 저장 불가 — 클라이언트에서 처리
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  res.status(200).json({ success: true, message: '웹 버전: 브라우저에서 직접 복사하세요', webVersion: true });
};
