// ============================================
// LOCAL TESTING SCRIPT
// Test the Edge Function locally
// ============================================

// Make this a module
export {};

const BASE_URL = 'http://localhost:54321/functions/v1/enhance';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

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
  if (!ACCESS_TOKEN) throw new Error('Set SUPABASE_ACCESS_TOKEN to run authenticated tests');
  
  const request = {
    assistants: [
      {
        id: 'task-1',
        model: 'gemini-flash',
        aiRoleId: 'editor',
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
        'Authorization': `Bearer ${ACCESS_TOKEN}`
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
  if (!ACCESS_TOKEN) throw new Error('Set SUPABASE_ACCESS_TOKEN to run authenticated tests');
  
  const request = {
    assistants: [
      {
        id: 'task-1',
        model: 'gemini-flash',
        aiRoleId: 'editor',
        userText: 'This are wrong.',
        options: {
          fixMistakes: true
        }
      },
      {
        id: 'task-2',
        model: 'open-router-free',
        aiRoleId: 'summarizer',
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
        'Authorization': `Bearer ${ACCESS_TOKEN}`
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
// Set SUPABASE_ACCESS_TOKEN and uncomment for authenticated requests:
// await testEnhance();
// await testBatch();
console.log('\n✨ Tests complete!\n');
