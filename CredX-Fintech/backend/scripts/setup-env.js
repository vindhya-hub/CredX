#!/usr/bin/env node
/**
 * npm run setup:env [-- --docker | --all]
 *
 * Creates env files from their committed templates, filling every
 * "<generated-by-setup-env>" placeholder with a fresh random secret
 * (crypto.randomBytes(48).toString('hex')).
 *
 *   (default)  backend/.env        from backend/.env.example   (local development)
 *   --docker   CredX-Fintech/.env  from CredX-Fintech/.env.example (docker compose)
 *   --all      both
 *
 * Safety rules:
 *  - an existing target file is never read, modified or overwritten
 *    (the file is opened with the exclusive "wx" flag);
 *  - generated values are never printed, only the variable names;
 *  - files are created with mode 0600 where the OS supports it.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.resolve(__dirname, '..');
const APP_DIR = path.resolve(BACKEND_DIR, '..');
const PLACEHOLDER = '<generated-by-setup-env>';

const TARGETS = {
  backend: {
    template: path.join(BACKEND_DIR, '.env.example'),
    target: path.join(BACKEND_DIR, '.env'),
    nextSteps: [
      'Set DB_USER and DB_PASSWORD (and DB_NAME/DB_HOST if needed) for your PostgreSQL server.',
      'Then run: npm run dev',
    ],
  },
  docker: {
    template: path.join(APP_DIR, '.env.example'),
    target: path.join(APP_DIR, '.env'),
    nextSteps: ['Then run (from CredX-Fintech/): docker compose up --build'],
  },
};

const generateSecret = () => crypto.randomBytes(48).toString('hex');

/** Replaces KEY=<generated-by-setup-env> lines; returns the new text and the keys filled. */
function fillTemplate(text) {
  const filled = [];
  const output = text.replace(/^([A-Z0-9_]+)=(.*)$/gm, (line, key, value) => {
    if (value.trim() !== PLACEHOLDER) return line;
    filled.push(key);
    return `${key}=${generateSecret()}`;
  });
  return { output, filled };
}

function createEnvFile(name, { template, target, nextSteps }) {
  const relative = path.relative(process.cwd(), target) || target;
  if (fs.existsSync(target)) {
    console.log(`- ${relative} already exists; left unchanged.`);
    return false;
  }
  const { output, filled } = fillTemplate(fs.readFileSync(template, 'utf8'));
  try {
    fs.writeFileSync(target, output, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code === 'EEXIST') {
      console.log(`- ${relative} already exists; left unchanged.`);
      return false;
    }
    throw error;
  }
  console.log(`- Created ${relative} (${name}) with new random values for: ${filled.join(', ') || 'nothing'} (values not shown).`);
  for (const step of nextSteps) console.log(`    ${step}`);
  return true;
}

function main(argv = process.argv.slice(2)) {
  const names = argv.includes('--all') ? ['backend', 'docker'] : argv.includes('--docker') ? ['docker'] : ['backend'];
  for (const name of names) createEnvFile(name, TARGETS[name]);
  console.log('Env files are gitignored; keep them out of version control.');
}

if (require.main === module) main();

module.exports = { fillTemplate, createEnvFile, PLACEHOLDER };
