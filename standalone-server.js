const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

let HTTP_PORT = 3001;
let WEB_PORT = 5000;

// Function to find available port
function findAvailablePort(startPort, callback) {
  const server = http.createServer();

  server.listen(startPort, () => {
    const port = server.address().port;
    server.close(() => callback(port));
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      findAvailablePort(startPort + 1, callback);
    } else {
      callback(null);
    }
  });
}

// Storage configuration
const APP_DATA_DIR = path.join(os.homedir(), '.servicebus-messenger');
const STORAGE_FILE = path.join(APP_DATA_DIR, 'data.json');

// Ensure app data directory exists
if (!fs.existsSync(APP_DATA_DIR)) {
  fs.mkdirSync(APP_DATA_DIR, { recursive: true });
}

// Initialize storage file if it doesn't exist
if (!fs.existsSync(STORAGE_FILE)) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify({
    connections: [],
    messageHistory: [],
    selectedConnectionId: null
  }, null, 2));
}

// Storage functions
function readStorage() {
  try {
    const data = fs.readFileSync(STORAGE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading storage:', error);
    return { connections: [], messageHistory: [], selectedConnectionId: null };
  }
}

function writeStorage(data) {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing storage:', error);
    return false;
  }
}

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Proxy server for CORS
const proxyServer = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', '*');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse URL
  const urlParams = new URL(req.url, `http://localhost:${HTTP_PORT}`);
  const pathname = urlParams.pathname;

  // Handle storage API endpoints
  if (pathname === '/storage') {
    if (req.method === 'GET') {
      // Read storage
      const data = readStorage();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    } else if (req.method === 'POST') {
      // Write storage
      let body = [];
      req.on('data', chunk => body.push(chunk));
      req.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(body).toString());
          const success = writeStorage(data);
          res.writeHead(success ? 200 : 500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }
  }

  // Extract target URL from query parameter for proxy requests
  const targetUrl = urlParams.searchParams.get('url');

  if (!targetUrl) {
    console.log('[ERROR] Missing url parameter');
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing url parameter' }));
    return;
  }

  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${targetUrl}`);

  try {
    const parsedUrl = new URL(targetUrl);

    // Collect request body
    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', () => {
      const requestBody = Buffer.concat(body);

      // Prepare proxy request options
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: req.method,
        headers: {}
      };

      // Copy relevant headers (exclude host and origin)
      // Use rawHeaders to preserve original case for Azure Service Bus custom properties
      const excludeHeaders = ['host', 'origin', 'referer', 'connection'];
      if (req.rawHeaders) {
        for (let i = 0; i < req.rawHeaders.length; i += 2) {
          const headerName = req.rawHeaders[i];
          const headerValue = req.rawHeaders[i + 1];
          if (!excludeHeaders.includes(headerName.toLowerCase())) {
            options.headers[headerName] = headerValue;
          }
        }
      } else {
        // Fallback to regular headers if rawHeaders not available
        Object.keys(req.headers).forEach(key => {
          if (!excludeHeaders.includes(key.toLowerCase())) {
            options.headers[key] = req.headers[key];
          }
        });
      }

      // Make the proxied request
      const proxyReq = https.request(options, proxyRes => {
        console.log(`[${new Date().toLocaleTimeString()}] Response: ${proxyRes.statusCode} ${proxyRes.statusMessage}`);

        // Copy response headers
        res.writeHead(proxyRes.statusCode, proxyRes.headers);

        // Pipe response back
        proxyRes.pipe(res);
      });

      proxyReq.on('error', error => {
        console.error(`[${new Date().toLocaleTimeString()}] [ERROR] Proxy error:`, error.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy request failed', details: error.message }));
      });

      // Send request body if present
      if (requestBody.length > 0) {
        proxyReq.write(requestBody);
      }

      proxyReq.end();
    });

  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] [ERROR] Invalid URL:`, error.message);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid URL', details: error.message }));
  }
});

// Web server for static files
const webServer = http.createServer((req, res) => {
  let filePath = path.join(__dirname, 'dist', req.url === '/' ? 'index.html' : req.url);

  // Security: prevent directory traversal
  const distPath = path.join(__dirname, 'dist');
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(distPath)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // Try index.html for SPA routing
        fs.readFile(path.join(__dirname, 'dist', 'index.html'), (err, indexContent) => {
          if (err) {
            res.writeHead(404);
            res.end('404 - File Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(indexContent, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end('500 - Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Start servers with port detection
findAvailablePort(HTTP_PORT, (proxyPort) => {
  if (!proxyPort) {
    console.error('Failed to find available port for proxy server');
    process.exit(1);
  }
  HTTP_PORT = proxyPort;

  findAvailablePort(WEB_PORT, (webPort) => {
    if (!webPort) {
      console.error('Failed to find available port for web server');
      process.exit(1);
    }
    WEB_PORT = webPort;

    // Start proxy server
    proxyServer.listen(HTTP_PORT, () => {
      console.log('========================================');
      console.log('   Azure Service Bus Messenger');
      console.log('========================================');
      console.log('');
      console.log(`[OK] Proxy server running on http://localhost:${HTTP_PORT}`);
    });

    // Start web server
    webServer.listen(WEB_PORT, () => {
      console.log(`[OK] Web server running on http://localhost:${WEB_PORT}`);
      console.log('');
      console.log('Opening browser...');
      console.log('');
      console.log('Press ANY KEY to stop');
      console.log('========================================');

      // Open browser
      const url = `http://localhost:${WEB_PORT}`;
      const platform = process.platform;
      const cmd = platform === 'win32' ? 'start' : platform === 'darwin' ? 'open' : 'xdg-open';
      exec(`${cmd} ${url}`, (error) => {
        if (error) {
          console.log(`\nManually open: ${url}`);
        }
      });

      // Wait for any key press to exit
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', () => {
          console.log('\n\nShutting down servers...');
          proxyServer.close();
          webServer.close();
          process.exit(0);
        });
      }
    });
  });
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down servers...');
  proxyServer.close();
  webServer.close();
  process.exit(0);
});
