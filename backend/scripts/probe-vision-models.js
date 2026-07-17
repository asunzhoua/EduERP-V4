// Quick probe: find available vision models on OpenCode
// Usage: node scripts/probe-vision-models.js <image_path>

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://opencode.ai/zen/go/v1/messages';
const API_KEY = 'sk-be46KtDWAhuoard7R1r0KKbenQGRMfMmcUhBlHMBLap8gdkiftVeFgxsQ26k7ij3';

// Common vision model IDs to test
const CANDIDATE_MODELS = [
  'glm-4v-plus', 'glm-4v-flash', 'glm-4v', 'glm-4v-0520',
  'glm-4v-air', 'glm-4v-airx', 'glm-4v-long',
  'Qwen/Qwen2.5-VL-7B-Instruct', 'Qwen/Qwen2.5-VL-32B-Instruct',
  'qwen-vl-max', 'qwen-vl-plus', 'qwen2.5-vl-72b-instruct',
  'gpt-4o', 'gpt-4o-mini', 'gpt-4-vision-preview',
  'deepseek-vl2', 'internvl2.5-mpo-78b',
  'Phi-3.5-vision-instruct', 'llava-1.6-34b'
];

const testBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

async function probeModel(modelId) {
  const payload = JSON.stringify({
    model: modelId,
    max_tokens: 50,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: testBase64 } },
        { type: 'text', text: 'What is this? Reply in one word.' }
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
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.content) {
            const text = parsed.content.filter(c => c.type === 'text').map(c => c.text).join('');
            resolve({ model: modelId, ok: true, text: text.substring(0, 80), modelReturned: parsed.model });
          } else if (parsed.error) {
            resolve({ model: modelId, ok: false, error: parsed.error.message?.substring(0, 60) });
          } else {
            resolve({ model: modelId, ok: false, error: 'Unknown response' });
          }
        } catch (e) {
          resolve({ model: modelId, ok: false, error: data.substring(0, 60) });
        }
      });
    });
    req.on('error', (e) => resolve({ model: modelId, ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ model: modelId, ok: false, error: 'Timeout' }); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('Probing vision models on OpenCode...\n');
  console.log(`${'Model'.padEnd(42)} ${'Status'.padEnd(8)} ${'Actual Model'.padEnd(25)} Response`);
  console.log('-'.repeat(100));

  for (const model of CANDIDATE_MODELS) {
    const r = await probeModel(model);
    const status = r.ok ? '✅' : '❌';
    const actual = r.modelReturned || '';
    const resp = r.ok ? r.text : (r.error || '');
    console.log(`${model.padEnd(42)} ${status.padEnd(8)} ${actual.padEnd(25)} ${resp}`);
  }
}

main().catch(console.error);
