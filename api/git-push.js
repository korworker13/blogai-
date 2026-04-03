// Vercel 웹 버전에서는 git push 불가
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  res.status(200).json({ success: false, message: '웹 버전에서는 지원하지 않습니다', webVersion: true });
};
