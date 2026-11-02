#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';

const name = process.env.BILLION_RENDER_CONTAINER;
if (!/^billion-render-[a-f0-9]{32}$/.test(name ?? '')) throw Error('Owned renderer name required');
const docker = process.env.BILLION_RENDER_DOCKER;
if (!docker?.startsWith('/')) throw Error('Absolute host Docker executable required');
const args = process.argv.slice(2);
if (!args.includes('--remote-debugging-pipe') || args.some(arg => /^(?:--no-sandbox|--disable-setuid-sandbox|--remote-debugging-port)(?:=|$)/.test(arg))) throw Error('Sandboxed pipe-only browser required');
const chromiumArgs = args.filter(arg => !arg.startsWith('--user-data-dir='));
chromiumArgs.push('--user-data-dir=/tmp/profile');
const child = spawn(docker, ['run', '--rm', '-i', '--pull=never', '--name', name,
  '--label', 'com.billion.service=campaign-renderer', '--network', 'none', '--user', 'pwuser',
  '--read-only', '--cap-drop=ALL', '--security-opt', 'no-new-privileges',
  '--security-opt', 'seccomp=' + fileURLToPath(new URL('./seccomp-browser.json', import.meta.url)),
  '--pids-limit', '128', '--memory', '1g', '--cpus', '2', '--shm-size', '256m',
  '--tmpfs', '/tmp:rw,noexec,nosuid,size=268435456,mode=1777',
  '--env', 'HOME=/tmp', '--env', 'XDG_CACHE_HOME=/tmp/cache', '--env', 'XDG_CONFIG_HOME=/tmp/config',
  '--entrypoint', '/bin/sh',
  'mcr.microsoft.com/playwright@sha256:6446946a1d9fd62d9ae501312a2d76a43ee688542b21622056a372959b65d63d',
  '-c', 'exec /ms-playwright/chromium-1208/chrome-linux/chrome "$@" 3<&0 4>&1', 'sh', ...chromiumArgs],
{ stdio: ['pipe', 'pipe', 'inherit'], env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: process.env.HOME, ...(process.env.DOCKER_HOST ? { DOCKER_HOST: process.env.DOCKER_HOST } : {}), ...(process.env.DOCKER_CONTEXT ? { DOCKER_CONTEXT: process.env.DOCKER_CONTEXT } : {}) } });
createReadStream(null, { fd: 3 }).pipe(child.stdin);
child.stdout.pipe(createWriteStream(null, { fd: 4 }));
child.on('error', () => process.exit(1));
child.on('exit', code => process.exit(code ?? 1));
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(signal, () => child.kill(signal));
