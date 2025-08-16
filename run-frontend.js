// This script runs the frontend Vite server on the port specified by PORT env variable
const { spawn } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, 'frontend');
const port = process.env.PORT || 5173;

// Check if frontend node_modules exists, if not install dependencies
const nodeModulesPath = path.join(frontendDir, 'node_modules');
if (!existsSync(nodeModulesPath)) {
  console.log('Installing frontend dependencies...');
  const installProc = spawn('npm', ['install'], {
    cwd: frontendDir,
    stdio: 'inherit'
  });
  
  installProc.on('close', (code) => {
    if (code === 0) {
      startViteServer();
    } else {
      console.error('Failed to install frontend dependencies');
      process.exit(code);
    }
  });
} else {
  startViteServer();
}

function startViteServer() {
  console.log(`Starting Vite server on port ${port}...`);
  
  const viteCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = ['vite', '--port', port, '--host'];

  const proc = spawn(viteCmd, args, {
    cwd: frontendDir,
    stdio: 'inherit',
    env: { ...process.env, PORT: port }
  });

  proc.on('close', code => {
    process.exit(code);
  });
}
