// MiMo V2.5 Vision recognition via CCSWITCH
// Usage: node scripts/mimo-recognize.js <image_path>

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://opencode.ai/zen/go/v1/messages';
const API_KEY = 'sk-be46KtDWAhuoard7R1r0KKbenQGRMfMmcUhBlHMBLap8gdkiftVeFgxsQ26k7ij3';
const MODEL = 'mimo-v2.5';

const MIME_MAP = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.bmp': 'image/bmp'
};

async function recognize(imagePath) {
  if (!imagePath) {
    console.log('Usage: node scripts/mimo-recognize.js <image_path>');
    process.exit(1);
  }

  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = MIME_MAP[ext] || 'image/png';
  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString('base64');

  console.log(`[MiMo V2.5] Recognizing: ${imagePath}`);
  console.log(`[MiMo V2.5] Size: ${(imageData.length / 1024).toFixed(1)} KB, Type: ${mimeType}`);
  console.log('');

  const payload = JSON.stringify({
    model: MODEL,
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64 }
          },
          {
            type: 'text',
            text: '请详细描述这张图片的内容。用中文回答。'
          }
        ]
      }
    ]
  });

  return new Promise((resolve, reject) => {
    const url = new URL(API_URL);
    const req = https.request({
      hostname: url.hostname, port: 443, path: url.pathname, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      timeout: 120000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.content && Array.isArray(parsed.content)) {
            const textParts = parsed.content.filter(c => c.type === 'text').map(c => c.text);
            const result = textParts.join('\n');
            if (result) {
              console.log('[MiMo V2.5] 识别结果：');
              console.log('---');
              console.log(result);
              console.log('---');
              console.log(`[MiMo V2.5] Model: ${parsed.model}, Tokens: ${parsed.usage?.input_tokens}+${parsed.usage?.output_tokens}`);
            } else {
              console.log('[MiMo V2.5] Raw response:');
              console.log(JSON.stringify(parsed, null, 2).substring(0, 1000));
            }
          } else if (parsed.error) {
            console.log(`[MiMo V2.5] API Error: ${parsed.error.message}`);
          } else {
            console.log('[MiMo V2.5] Unexpected:', data.substring(0, 500));
          }
        } catch (e) {
          console.log('[MiMo V2.5] Parse error:', data.substring(0, 500));
        }
        resolve();
      });
    });
    req.on('error', (e) => { console.log(`Error: ${e.message}`); reject(e); });
    req.on('timeout', () => { req.destroy(); console.log('Timeout'); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

recognize(process.argv[2]).catch(console.error);
