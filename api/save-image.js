// Vercel 웹 버전에서는 파일 저장 불가
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  res.status(200).json({ success: true, message: '웹 버전: 이미지를 길게 눌러 저장하세요', webVersion: true });
};
