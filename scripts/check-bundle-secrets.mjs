// Fails if a built frontend bundle contains server-side secrets (spec §53: no secrets in the frontend).
// Usage: node scripts/check-bundle-secrets.mjs <dist-dir>
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const distDir = process.argv[2] ?? 'dist';

/** Patterns that must never appear in browser code. */
const FORBIDDEN = [
  { name: 'Supabase secret key', pattern: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'Stripe secret key', pattern: /\b[sr]k_(?:live|test)_[A-Za-z0-9]{10,}/ },
  { name: 'Stripe webhook secret', pattern: /\bwhsec_[A-Za-z0-9]{10,}/ },
  { name: 'Resend API key', pattern: /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{8,}/ },
  { name: 'Supabase personal access token', pattern: /\bsbp_[a-f0-9]{40}\b/ },
  { name: 'Postgres URL with password', pattern: /postgres(?:ql)?:\/\/[^\s:@/'"]+:[^\s@/'"]+@/ },
  { name: 'private key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

const JWT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

/** @param {string} dir @returns {string[]} */
function listFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

/** @param {string} token @returns {unknown} */
function jwtRole(token) {
  try {
    const payload = token.split('.')[1] ?? '';
    /** @type {unknown} */
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof parsed === 'object' && parsed !== null && 'role' in parsed
      ? parsed.role
      : undefined;
  } catch {
    return undefined;
  }
}

const findings = [];
for (const file of listFiles(distDir)) {
  const content = readFileSync(file, 'utf8');
  for (const { name, pattern } of FORBIDDEN) {
    if (pattern.test(content)) findings.push(`${relative(distDir, file)}: ${name}`);
  }
  for (const token of content.match(JWT) ?? []) {
    if (jwtRole(token) === 'service_role') {
      findings.push(`${relative(distDir, file)}: Supabase service_role JWT`);
    }
  }
}

if (findings.length > 0) {
  console.error(
    `Secrets found in the frontend bundle:\n${findings.map((f) => `- ${f}`).join('\n')}`,
  );
  process.exit(1);
}
console.log(`No secrets found in ${distDir}.`);
