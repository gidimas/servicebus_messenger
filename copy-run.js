const fs = require('fs');
const path = require('path');

// Copy run.ps1 to dist folder after build
const runPs1Source = path.join(__dirname, 'run.ps1');
const runPs1Dest = path.join(__dirname, 'dist', 'run.ps1');

if (fs.existsSync(runPs1Source)) {
  fs.copyFileSync(runPs1Source, runPs1Dest);
  console.log('✓ run.ps1 copied to dist folder');
} else {
  console.warn('⚠ run.ps1 not found in project root');
}

// Copy proxy-server.js to dist folder after build
const proxySource = path.join(__dirname, 'proxy-server.js');
const proxyDest = path.join(__dirname, 'dist', 'proxy-server.js');

if (fs.existsSync(proxySource)) {
  fs.copyFileSync(proxySource, proxyDest);
  console.log('✓ proxy-server.js copied to dist folder');
} else {
  console.warn('⚠ proxy-server.js not found in project root');
}
