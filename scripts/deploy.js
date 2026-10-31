/**
 * FTP Deploy Script
 * Uploads the contents of the dist/ folder to the remote server.
 *
 * Credentials are read from the .env file in the project root:
 *   FTP_HOST, FTP_USER, FTP_PASSWORD
 *
 * The production build is run here with MAGICSTACK_TTS_API pointed at the live
 * API (process env takes priority over .env in Vite), so the local .env can keep
 * the localhost value for development.
 *
 * Optionally set REMOTE_DIR below to change the target directory on the server.
 */

import { Client } from 'basic-ftp';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST_DIR = resolve(ROOT, 'dist');

// ── Remote target directory ────────────────────────────────────────────────
const REMOTE_DIR = '/';

// ── Production API URL baked into the build ────────────────────────────────
const PROD_TTS_API = 'https://texttospeech.magicrunez.com/api';

// ── Parse .env manually (no extra runtime dependency) ─────────────────────
function parseEnv(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`.env file not found at ${filePath}`);
  }
  const env = {};
  for (const line of readFileSync(filePath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    env[key] = value;
  }
  return env;
}

const env = parseEnv(resolve(ROOT, '.env'));

const { FTP_HOST, FTP_USER, FTP_PASSWORD } = env;

if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
  console.error('Missing FTP_HOST, FTP_USER, or FTP_PASSWORD in .env');
  process.exit(1);
}

// ── Build with production API ──────────────────────────────────────────────
console.log(`⚙ Building with MAGICSTACK_TTS_API=${PROD_TTS_API}`);
try {
  execSync('npm run build', {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, MAGICSTACK_TTS_API: PROD_TTS_API },
  });
} catch {
  console.error('✘ Build failed — aborting deploy.');
  process.exit(1);
}

if (!existsSync(DIST_DIR)) {
  console.error('dist/ folder not found after build.');
  process.exit(1);
}

// ── Deploy ─────────────────────────────────────────────────────────────────
async function deploy() {
  const client = new Client();
  client.ftp.verbose = false; // set to true for detailed FTP logs

  try {
    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASSWORD,
      secure: false,       // change to true if the server supports FTPS
    });

    console.log(`✔ Connected to ${FTP_HOST}`);
    console.log(`⇑ Uploading dist/ → ${REMOTE_DIR} …`);

    await client.ensureDir(REMOTE_DIR);
    await client.uploadFromDir(DIST_DIR, REMOTE_DIR);

    // Explicitly upload .htaccess — dotfiles can be silently skipped by uploadFromDir
    const htaccessLocal = resolve(DIST_DIR, '.htaccess');
    if (existsSync(htaccessLocal)) {
      await client.cd(REMOTE_DIR);
      await client.uploadFrom(htaccessLocal, '.htaccess');
      console.log('✔ .htaccess uploaded.');
    }

    console.log('✔ Deploy complete.');
  } catch (err) {
    console.error('✘ Deploy failed:', err.message);
    process.exit(1);
  } finally {
    client.close();
  }
}

deploy();
