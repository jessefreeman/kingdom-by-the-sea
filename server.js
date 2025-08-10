const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
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

const requestHandler = (req, res) => {
  const parsedUrl = url.parse(req.url);
  let filePath = parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname.slice(1);
  
  // Debug logging
  console.log('Request URL:', req.url);
  console.log('File path:', filePath);
  
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
    res.writeHead(200, {'Content-Type': contentType});
    res.end(data);
  });
};

const server = http.createServer(requestHandler);
server.listen(port, function() {
  console.log('Server listening on port ' + port);
});
