const fs = require('fs');
const path = require('path');

// Release information
const releaseInfo = {
  version: 'v1.0.0',
  name: 'LaptoPilot v1.0.0 - AI-Powered Laptop Recommendation Assistant',
  description: 'Production-ready AI-powered laptop recommendation assistant with Google Gemini',
  assets: [
    'release/LaptoPilot Setup.exe',
    'release/LaptoPilot Setup 0.0.0.exe.blockmap',
    'release/LaptoPilot.exe'
  ]
};

// Read the GitHub release notes
const releaseNotes = fs.readFileSync(path.join(__dirname, '..', 'GITHUB_RELEASE.md'), 'utf8');

console.log('=== LaptoPilot Release Creator ===');
console.log('Version:', releaseInfo.version);
console.log('Name:', releaseInfo.name);
console.log('');

console.log('To create a release on GitHub, follow these steps:');
console.log('');
console.log('1. Ensure you have the GitHub CLI installed (https://cli.github.com/)');
console.log('2. Run the following command:');
console.log('');
console.log(`gh release create "${releaseInfo.version}" \\`);
console.log(`  --repo "zSayf/laptopilot" \\`);
console.log(`  --title "${releaseInfo.name}" \\`);
console.log(`  --notes-file "GITHUB_RELEASE.md" \\`);

// Add asset files
releaseInfo.assets.forEach((asset, index) => {
  console.log(`  "${asset}"${index < releaseInfo.assets.length - 1 ? ' \\' : ''}`);
});

console.log('');
console.log('Alternatively, create the release manually:');
console.log('1. Go to https://github.com/zSayf/laptopilot/releases/new');
console.log(`2. Set Tag version to ${releaseInfo.version}`);
console.log(`3. Set Release title to "${releaseInfo.name}"`);
console.log('4. Copy the content of GITHUB_RELEASE.md to the description');
console.log('5. Upload the following files as assets:');
releaseInfo.assets.forEach(asset => {
  console.log(`   - ${asset}`);
});
console.log('6. Publish the release');
console.log('');
console.log('Release notes preview:');
console.log('=====================');
console.log(releaseNotes.substring(0, 500) + '...');
console.log('');
console.log('=====================');