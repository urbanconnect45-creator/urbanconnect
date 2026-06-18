import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { prepareWebOutput } from './build-web-output.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expoCli = path.join(rootDir, 'node_modules', 'expo', 'bin', 'cli');
const nodeOptions = [
  process.env.NODE_OPTIONS,
  '--max-old-space-size=4096',
  '--max-semi-space-size=256',
].filter(Boolean).join(' ');

const child = spawn(
  process.execPath,
  [expoCli, 'export', '--platform', 'web', '--max-workers', process.env.EXPO_MAX_WORKERS ?? '1'],
  {
    cwd: rootDir,
    env: {
      ...process.env,
      CI: process.env.CI ?? '1',
      EXPO_NO_TELEMETRY: process.env.EXPO_NO_TELEMETRY ?? '1',
      NODE_OPTIONS: nodeOptions,
    },
    stdio: 'inherit',
  },
);

child.on('exit', async (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  if (code !== 0) {
    process.exit(code ?? 1);
    return;
  }

  try {
    await prepareWebOutput(rootDir);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
});
