const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const chokidar = require('chokidar');
const port = process.env.PORT || 8080;

const getContentType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html';
    case '.js': return 'application/javascript';
    case '.css': return 'text/css';
    case '.json': return 'application/json';
    case '.png': return 'image/png';
    case '.jpg': case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.ico': return 'image/x-icon';
    default: return 'text/plain';
  }
};

// --- Simple Server-Sent Events live reload ---
const clients = new Set();
function sseHandler(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
}
function broadcastReload() {
  for (const res of clients) {
    try { res.write('data: reload\n\n'); } catch (_) {}
  }
}

// Watch files (ignore node_modules and dotfiles)
const watcher = chokidar.watch(['**/*.{html,js,css}'], {
  ignored: /(^|[/\\])\.|node_modules/,
  ignoreInitial: true,
});
watcher.on('change', (file) => {
  console.log('[live-reload] change detected:', file);
  broadcastReload();
});

const LIVE_SNIPPET = (
  '<script>(function(){try{var es=new EventSource("/__livereload");es.onmessage=function(e){if(e&&e.data==="reload"){location.reload()}}}catch(e){console.warn("livereload disabled",e)}})();</script>'
);

function injectLiveSnippet(html) {
  if (!html.includes('/__livereload')) {
    const i = html.lastIndexOf('</body>');
    if (i !== -1) return html.slice(0, i) + LIVE_SNIPPET + html.slice(i);
    return html + LIVE_SNIPPET;
  }
  return html;
}

const requestHandler = (req, res) => {
  const parsedUrl = url.parse(req.url);
  let filePath = parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname.slice(1);
  
  // Debug logging
  console.log('Request URL:', req.url);
  console.log('File path:', filePath);

  // SSE endpoint
  if (parsedUrl.pathname === '/__livereload') return sseHandler(req, res);
  
  // Security: prevent directory traversal
  if (filePath.includes('..')) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.log('File not found:', filePath, err.code);
      res.writeHead(404);
      res.end('File not found');
      return;
    }
    
    const contentType = getContentType(filePath);
    const headers = {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    };
    // Inject live snippet for HTML
    if (contentType === 'text/html') {
      const html = injectLiveSnippet(data.toString('utf8'));
      res.writeHead(200, headers);
      res.end(html);
      return;
    }
    res.writeHead(200, headers);
    res.end(data);
  });
};

const server = http.createServer(requestHandler);
server.listen(port, function() {
  console.log('Server listening on port ' + port);
});
