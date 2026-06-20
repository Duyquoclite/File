const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'facebook.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Find all occurrences of role="article"
const regex = /role="article"/g;
let match;
let count = 0;
while ((match = regex.exec(htmlContent)) !== null) {
  count++;
  const startIndex = Math.max(0, match.index - 100);
  const endIndex = Math.min(htmlContent.length, match.index + 200);
  console.log(`\n--- Match ${count} (offset ${match.index}): ---`);
  console.log(htmlContent.substring(startIndex, endIndex));
}

// Find all occurrences of aria-posinset
const pRegex = /aria-posinset="(\d+)"/g;
let pCount = 0;
while ((match = pRegex.exec(htmlContent)) !== null) {
  pCount++;
  if (pCount <= 5) {
    const startIndex = Math.max(0, match.index - 100);
    const endIndex = Math.min(htmlContent.length, match.index + 200);
    console.log(`\n--- aria-posinset Match ${pCount} (offset ${match.index}): ---`);
    console.log(htmlContent.substring(startIndex, endIndex));
  }
}
console.log('\nTotal aria-posinset found:', pCount);
