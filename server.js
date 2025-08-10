const http = require('http');
const fs = require('fs');
const port = process.env.PORT || 8080;
const requestHandler = (req, res) => {
  fs.readFile('index.html', (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Error loading index.html');
      return;
    }
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(data);
  });
};
const server = http.createServer(requestHandler);
server.listen(port, function() {
  console.log('Server listening on port ' + port);
});
