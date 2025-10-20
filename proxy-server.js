const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = 3001;

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

  // Extract target URL from query parameter
  const urlParams = new URL(req.url, `http://localhost:${PORT}`);
  const targetUrl = urlParams.searchParams.get('url');

  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing url parameter' }));
    return;
  }

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
        // Copy response headers
        res.writeHead(proxyRes.statusCode, proxyRes.headers);

        // Pipe response back
        proxyRes.pipe(res);
      });

      proxyReq.on('error', error => {
        console.error('Proxy error:', error);
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
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid URL', details: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`CORS Proxy server running on http://localhost:${PORT}`);
  console.log(`Usage: http://localhost:${PORT}?url=<encoded-target-url>`);
});
