import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const configPath = resolve('dist/server/wrangler.json');
const { ADMIN_USERNAME, ADMIN_PASSWORD_HASH, ADMIN_AUTH_SECRET, RAILWAY_VOLUME_MOUNT_PATH, PORT } = process.env;
if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH || !ADMIN_AUTH_SECRET) {
  console.error('Admin login credentials are not configured.');
  process.exit(1);
}
const secrets = { ADMIN_USERNAME, ADMIN_PASSWORD_HASH, ADMIN_AUTH_SECRET };
writeFileSync(resolve('dist/server/.dev.vars'), Object.entries(secrets).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });

const wrangler = resolve('node_modules/wrangler/bin/wrangler.js');
const command = (...args) => [process.execPath, '--import', resolve('scripts/sites-env.mjs'), wrangler, ...args];
const persistence = RAILWAY_VOLUME_MOUNT_PATH || resolve('.wrangler/state');
if (!RAILWAY_VOLUME_MOUNT_PATH) {
  console.warn('Persistent storage is not attached. Product and request storage is unavailable on Railway.');
} else {
  const args = command('d1', 'execute', 'DB', '--local', '--config', configPath, '--persist-to', persistence, '--file', resolve('scripts/railway-schema.sql'));
  const result = spawn(args[0], args.slice(1), { stdio: 'inherit' });
  const exitCode = await new Promise((resolveExit) => result.on('close', resolveExit));
  if (exitCode !== 0) process.exit(exitCode || 1);
}
const args = command('dev', '--config', configPath, '--local', '--persist-to', persistence, '--ip', '0.0.0.0', '--port', PORT || '8000', '--inspector-port', '0');
const child = spawn(args[0], args.slice(1), { stdio: 'inherit' });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
