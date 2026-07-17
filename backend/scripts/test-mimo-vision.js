// Test MiMo V2.5 via CCSWITCH (OpenCode API)
// Usage: node scripts/test-mimo-vision.js

const https = require('https');

const API_URL = 'https://opencode.ai/zen/go/v1/messages';
const API_KEY = 'sk-be46KtDWAhuoard7R1r0KKbenQGRMfMmcUhBlHMBLap8gdkiftVeFgxsQ26k7ij3';
const MODEL = 'mimo-v2.5';

async function testVision() {
  console.log('========================================');
  console.log('  MiMo V2.5 Vision Test via OpenCode');
  console.log('========================================');
  console.log(`URL: ${API_URL}`);
  console.log(`Model: ${MODEL}`);
  console.log('');

  // Test 1: Simple text request (basic connectivity)
  console.log('[Test 1] Basic text connectivity...');
  try {
    const textPayload = JSON.stringify({
      model: MODEL,
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: 'What model are you? Reply in one sentence.'
        }
      ]
    });

    const textResult = await makeRequest(textPayload);
    console.log(`  Status: ${textResult.status}`);
    console.log(`  Body: ${textResult.body}`);
    console.log('');
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    console.log('');
  }

  // Test 2: Image recognition with base64 test image
  console.log('[Test 2] Image recognition (1x1 red pixel PNG)...');
  try {
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

    const visionPayload = JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: testImageBase64
              }
            },
            {
              type: 'text',
              text: 'Describe this image in detail. What do you see?'
            }
          ]
        }
      ]
    });

    const visionResult = await makeRequest(visionPayload);
    console.log(`  Status: ${visionResult.status}`);
    console.log(`  Body: ${visionResult.body}`);
    console.log('');
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    console.log('');
  }

  // Test 3: Check model capabilities
  console.log('[Test 3] Model capabilities check...');
  try {
    const capPayload = JSON.stringify({
      model: MODEL,
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: 'Can you see and analyze images? Reply with YES or NO only.'
        }
      ]
    });

    const capResult = await makeRequest(capPayload);
    console.log(`  Status: ${capResult.status}`);
    console.log(`  Body: ${capResult.body}`);
    console.log('');
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    console.log('');
  }

  console.log('========================================');
  console.log('  Test Complete');
  console.log('========================================');
}

function makeRequest(payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      timeout: 60000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.content && Array.isArray(parsed.content)) {
            const textParts = parsed.content
              .filter(c => c.type === 'text')
              .map(c => c.text);
            resolve({
              status: res.statusCode,
              body: textParts.join('\n') || JSON.stringify(parsed).substring(0, 500)
            });
          } else if (parsed.error) {
            resolve({ status: res.statusCode, body: `API Error: ${parsed.error.message || JSON.stringify(parsed.error)}` });
          } else {
            resolve({ status: res.statusCode, body: data.substring(0, 800) });
          }
        } catch (e) {
          resolve({ status: res.statusCode, body: data.substring(0, 800) });
        }
      });
    });

    req.on('error', (e) => reject(new Error(`Connection failed: ${e.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout (60s)')); });

    req.write(payload);
    req.end();
  });
}

testVision().catch(console.error);
