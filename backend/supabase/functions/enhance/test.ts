// ============================================
// LOCAL TESTING SCRIPT
// Test the Edge Function locally
// ============================================

// Make this a module
export {};

const BASE_URL = 'http://localhost:54321/functions/v1/enhance';

async function testHealth() {
  console.log('\n🏥 Testing health endpoint...');
  try {
    const response = await fetch(BASE_URL);
    const data = await response.json();
    console.log('✅ Status:', response.status);
    console.log('📦 Response:', data);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function testEnhance() {
  console.log('\n✨ Testing enhance endpoint...');
  
  const request = {
    assistants: [
      {
        id: 'task-1',
        model: 'gemini-1.5-flash',
        aiRoleId: 'grammar-corrector',
        userText: 'This are wrong and have many eror.',
        options: {
          fixMistakes: true,
          formality: 'Neutral'
        }
      }
    ]
  };

  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token-plus' // Mock token for plus tier
      },
      body: JSON.stringify(request)
    });

    const data = await response.json();
    console.log('✅ Status:', response.status);
    console.log('📦 Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function testBatch() {
  console.log('\n📚 Testing batch enhancement...');
  
  const request = {
    assistants: [
      {
        id: 'task-1',
        model: 'gemini-1.5-flash',
        aiRoleId: 'grammar-corrector',
        userText: 'This are wrong.',
        options: {
          fixMistakes: true
        }
      },
      {
        id: 'task-2',
        model: 'gemini-1.5-flash',
        aiRoleId: 'style-improver',
        userText: 'make it fancy',
        options: {
          improve: true,
          formality: 'Formal'
        }
      }
    ]
  };

  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token-premium'
      },
      body: JSON.stringify(request)
    });

    const data = await response.json();
    console.log('✅ Status:', response.status);
    console.log('📦 Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function testInvalidAuth() {
  console.log('\n🔒 Testing invalid auth...');
  
  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid'
      },
      body: JSON.stringify({ assistants: [] })
    });

    const data = await response.json();
    console.log('✅ Status:', response.status, '(expected 401)');
    console.log('📦 Response:', data);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run all tests
console.log('🚀 Starting Edge Function tests...');
await testHealth();
await testInvalidAuth();
// Uncomment when ready to test with real API keys:
// await testEnhance();
// await testBatch();
console.log('\n✨ Tests complete!\n');
