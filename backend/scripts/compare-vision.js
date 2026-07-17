// Batch image recognition: MiMo V2.5 vs GLM-4V
// Usage: node scripts/compare-vision.js <image_dir>

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://opencode.ai/zen/go/v1/messages';
const API_KEY = 'sk-be46KtDWAhuoard7R1r0KKbenQGRMfMmcUhBlHMBLap8gdkiftVeFgxsQ26k7ij3';

const MODELS = [
  { id: 'mimo-v2.5', name: 'MiMo V2.5' },
  { id: 'glm-4v-plus', name: 'GLM-4V-Plus' }
];

const MIME_MAP = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp'
};

function callModel(modelId, base64, mimeType, prompt) {
  const payload = JSON.stringify({
    model: modelId,
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: prompt }
      ]
    }]
  });

  return new Promise((resolve) => {
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
            const text = parsed.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
            if (text) {
              resolve({ ok: true, text, tokens: parsed.usage });
            } else {
              resolve({ ok: false, error: 'Empty response', raw: JSON.stringify(parsed).substring(0, 300) });
            }
          } else if (parsed.error) {
            resolve({ ok: false, error: parsed.error.message || JSON.stringify(parsed.error) });
          } else {
            resolve({ ok: false, error: data.substring(0, 300) });
          }
        } catch (e) {
          resolve({ ok: false, error: data.substring(0, 300) });
        }
      });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout 120s' }); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  const dir = process.argv[2];
  if (!dir) { console.log('Usage: node scripts/compare-vision.js <image_dir>'); process.exit(1); }

  const files = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
  console.log(`Found ${files.length} images in ${dir}\n`);

  const prompt = '请详细描述这张图片的内容，包括：1) 主要场景 2) 人物（如有）3) 关键细节。用中文回答，200字以内。';

  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(dir, file);
    const ext = path.extname(file).toLowerCase();
    const mimeType = MIME_MAP[ext] || 'image/png';
    const imageData = fs.readFileSync(filePath);
    const base64 = imageData.toString('base64');
    const sizeKB = (imageData.length / 1024).toFixed(1);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${i+1}/${files.length}] ${file} (${sizeKB} KB)`);
    console.log('='.repeat(60));

    const fileResults = { file, sizeKB, models: {} };

    for (const model of MODELS) {
      console.log(`\n--- ${model.name} (${model.id}) ---`);
      const start = Date.now();
      const result = await callModel(model.id, base64, mimeType, prompt);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      if (result.ok) {
        console.log(`  Time: ${elapsed}s`);
        console.log(`  Tokens: ${result.tokens?.input_tokens || '?'} in / ${result.tokens?.output_tokens || '?'} out`);
        console.log(`  Response:\n${result.text}`);
        fileResults.models[model.id] = { ...result, elapsed };
      } else {
        console.log(`  Time: ${elapsed}s | ERROR: ${result.error}`);
        fileResults.models[model.id] = { ok: false, error: result.error, elapsed };
      }
    }

    results.push(fileResults);
  }

  // Summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`${'File'.padEnd(30)} ${'MiMo V2.5'.padEnd(12)} ${'GLM-4V-Plus'.padEnd(12)}`);
  console.log('-'.repeat(54));
  for (const r of results) {
    const mimo = r.models['mimo-v2.5'];
    const glm = r.models['glm-4v-plus'];
    const mimoStatus = mimo?.ok ? `✅ ${mimo.elapsed}s` : '❌';
    const glmStatus = glm?.ok ? `✅ ${glm.elapsed}s` : '❌';
    console.log(`${r.file.padEnd(30)} ${mimoStatus.padEnd(12)} ${glmStatus.padEnd(12)}`);
  }
}

main().catch(console.error);
