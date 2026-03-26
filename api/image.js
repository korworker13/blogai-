const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, style } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt 없음' });

  // 스타일별 suffix — 카드뉴스 포함 5가지
  const styleSuffix = {
    thumbnail: 'professional blog thumbnail, eye-catching composition, warm lighting, photography mixed with subtle graphic overlay, high quality',
    photo:     'realistic travel photography, natural golden hour lighting, vivid landscape, candid people, high resolution DSLR shot, no text no logo',
    infographic: 'clean Korean infographic design, flat illustration, bold data visualization, pastel color palette, icons and charts, white background, modern layout',
    card:      'Korean card news style, bold headline typography, strong gradient background, social media card design, 1:1 ratio, striking colors',
    variety:   'mixed media blog image, collage of photography and graphic elements, dynamic composition, vibrant colors, editorial style'
  };

  const suffix = styleSuffix[style] || styleSuffix['thumbnail'];
  const fullPrompt = `${prompt}, ${suffix}`;
  const encoded = encodeURIComponent(fullPrompt);
  const seed = Date.now() + Math.floor(Math.random() * 99999);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&enhance=true&seed=${seed}`;

  try {
    const imgRes = await fetch(url);
    if (!imgRes.ok) return res.status(502).json({ error: '이미지 생성 실패' });
    const buffer = await imgRes.buffer();
    res.json({ base64: buffer.toString('base64'), mimeType: 'image/jpeg' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
