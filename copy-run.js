const fs = require('fs');
const path = require('path');

// Copy run.ps1 to dist folder after build
const source = path.join(__dirname, 'run.ps1');
const dest = path.join(__dirname, 'dist', 'run.ps1');

if (fs.existsSync(source)) {
  fs.copyFileSync(source, dest);
  console.log('✓ run.ps1 copied to dist folder');
} else {
  console.warn('⚠ run.ps1 not found in project root');
}
