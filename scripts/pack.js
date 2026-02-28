#!/usr/bin/env node
/**
 * Packs the app for deployment: copies project (excluding dev/runtime junk) into deploy/
 * and creates aswp-deploy.zip. Run "npm run build" first to include built client/server,
 * or run "npm run pack" alone to pack source (then build on server after unzip).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const deployDir = path.join(root, 'deploy');
const zipName = 'aswp-deploy.zip';
const zipPath = path.join(root, zipName);

const EXCLUDE = new Set([
  'node_modules',
  '.git',
  '.env',
  'deploy',
  'aswp-deploy.zip',
  '.DS_Store',
  '*.log',
  'server/data',
  'server/server/data',
  '.vscode',
  '.idea',
  'scripts',
]);

function shouldExclude(name, relativePath) {
  if (EXCLUDE.has(name)) return true;
  if (relativePath.includes('server' + path.sep + 'data')) return true;
  if (relativePath.includes('server' + path.sep + 'server' + path.sep + 'data')) return true;
  if (name.endsWith('.log')) return true;
  return false;
}

function copyRecursive(src, dest, relative = '') {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    const name = path.basename(src);
    if (shouldExclude(name, relative)) return;
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(
        path.join(src, child),
        path.join(dest, child),
        relative ? relative + path.sep + child : child
      );
    }
  } else {
    const name = path.basename(src);
    if (shouldExclude(name, relative)) return;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

const clientDist = path.join(root, 'client', 'dist');
const serverDist = path.join(root, 'server', 'dist');
if (!fs.existsSync(clientDist) || !fs.existsSync(serverDist)) {
  console.warn('Warning: client/dist or server/dist missing. Run "npm run build" first to include built files, or build on server after unzip.');
}

console.log('Creating deploy folder...');
if (fs.existsSync(deployDir)) fs.rmSync(deployDir, { recursive: true });
fs.mkdirSync(deployDir, { recursive: true });

const dirs = ['client', 'server'];
const files = ['DEPLOYMENT.md'];
for (const d of dirs) {
  const src = path.join(root, d);
  if (fs.existsSync(src)) copyRecursive(src, path.join(deployDir, d), d);
}
for (const f of files) {
  const src = path.join(root, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(deployDir, f));
}

// Ensure server has env.example (copy from server/env.example)
const envExample = path.join(root, 'server', 'env.example');
if (fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, path.join(deployDir, 'server', 'env.example'));
}

// Deploy root package.json: start = run server from root so cwd is correct for client/dist
const deployPkg = {
  name: 'aswp-deploy',
  version: '1.0.0',
  private: true,
  scripts: { start: 'node server/dist/index.js' },
  engines: { node: '>=18' },
};
fs.writeFileSync(path.join(deployDir, 'package.json'), JSON.stringify(deployPkg, null, 2));

console.log('Creating zip...');
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

const isWindows = process.platform === 'win32';
try {
  if (isWindows) {
    execSync(`powershell -Command "Compress-Archive -Path '${deployDir.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force"`, {
      stdio: 'inherit',
      cwd: root,
    });
  } else {
    execSync(`zip -rq "${zipPath}" deploy`, { stdio: 'inherit', cwd: root });
  }
} catch (e) {
  console.warn('Zip command failed. Install PowerShell (Windows) or zip (Mac/Linux), or use the deploy/ folder as-is.');
  process.exitCode = 1;
}

if (fs.existsSync(zipPath)) {
  console.log('Done. Deployment pack: ' + zipName);
  console.log('');
  console.log('To run on your server:');
  console.log('  1. Unzip ' + zipName);
  console.log('  2. cd deploy && cd server && npm install --production && cd ..');
  console.log('  3. NODE_ENV=production JWT_SECRET=your-32-char-secret FRONTEND_URL=https://your-domain.com npm start');
}
