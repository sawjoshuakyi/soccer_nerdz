require('dotenv').config();

console.log('\n🔍 Environment Configuration Check\n');
console.log('==========================================\n');

console.log('Current directory:', process.cwd());
console.log('');

console.log('Environment variables:');
console.log('  RAPIDAPI_KEY:', process.env.RAPIDAPI_KEY ? '✅ LOADED' : '❌ MISSING');
if (process.env.RAPIDAPI_KEY) {
  console.log('  Value:', process.env.RAPIDAPI_KEY.substring(0, 10) + '...');
  console.log('  Length:', process.env.RAPIDAPI_KEY.length, 'characters');
}
console.log('');

console.log('  ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '✅ LOADED' : '❌ MISSING');
if (process.env.ANTHROPIC_API_KEY) {
  console.log('  Value:', process.env.ANTHROPIC_API_KEY.substring(0, 10) + '...');
}
console.log('');

console.log('  PORT:', process.env.PORT || '(using default 3000)');
console.log('');

console.log('==========================================\n');

const fs = require('fs');
if (fs.existsSync('.env')) {
  console.log('✅ .env file exists');
  const envContent = fs.readFileSync('.env', 'utf8');
  console.log('\n.env file contents:');
  console.log('------------------------------------------');
  envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (value) {
        console.log(`${key}=${value.substring(0, 10)}...`);
      } else {
        console.log(`${key}=(empty)`);
      }
    }
  });
  console.log('------------------------------------------');
} else {
  console.log('❌ .env file NOT found!');
  console.log('   Please create .env file with:');
  console.log('   RAPIDAPI_KEY=your_api_key_here');
}

console.log('\n');