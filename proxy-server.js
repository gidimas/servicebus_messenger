const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3001;

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

const server = http.createServer((req, res) => {
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
  const urlParams = new URL(req.url, `http://localhost:${PORT}`);
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
      Object.keys(req.headers).forEach(key => {
        if (!['host', 'origin', 'referer', 'connection'].includes(key.toLowerCase())) {
          options.headers[key] = req.headers[key];
        }
      });

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

server.listen(PORT, () => {
  console.log(`CORS Proxy server running on http://localhost:${PORT}`);
  console.log(`Usage: http://localhost:${PORT}?url=<encoded-target-url>`);
});
