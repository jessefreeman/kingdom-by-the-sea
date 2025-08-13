// This script runs the frontend Vite server on the port specified by FRONTEND_PORT env variable
const { spawn } = require('child_process');

const path = require('path');
const frontendDir = path.join(__dirname, 'frontend');
const port = process.env.PORT || 5173;

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
