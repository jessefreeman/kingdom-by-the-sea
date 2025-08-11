import { defineConfig } from 'vite';

const getPort = () => {
  const envPort = process.env.PORT;
  if (envPort && !Number.isNaN(Number(envPort))) return Number(envPort);
  const ports = process.env.PORTS;
  if (ports) {
    const first = String(ports).split(',')[0];
    if (first && !Number.isNaN(Number(first))) return Number(first);
  }
  return 5173; // default Vite port
};

export default defineConfig({
  server: {
    port: getPort(),
    host: true, // listen on 0.0.0.0 for platforms that proxy
    strictPort: false,
    allowedHosts: [
      'kingdom-by-the-sea.weekendcodeproject.dev',
    ],
  },
  preview: {
    port: getPort(),
    host: true,
    strictPort: false,
    allowedHosts: [
      'kingdom-by-the-sea.weekendcodeproject.dev',
    ],
  },
});
