const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { fillTemplate, createEnvFile, PLACEHOLDER } = require('../../scripts/setup-env');
const { looksLikePlaceholder } = require('../../src/config/config');

// Project-local scratch directory (gitignored), so tests never write elsewhere.
const tmpRoot = path.join(__dirname, '..', '.tmp', `setup-env-${crypto.randomBytes(4).toString('hex')}`);

beforeAll(() => fs.mkdirSync(tmpRoot, { recursive: true }));
afterAll(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

const template = [
  '# comment',
  `JWT_SECRET=${PLACEHOLDER}`,
  `JWT_REFRESH_SECRET=${PLACEHOLDER}`,
  'DB_PASSWORD=<your-postgres-password>',
  'PORT=5000',
  '',
].join('\n');

describe('setup-env', () => {
  test('fills only generated placeholders with distinct 96-hex-char secrets', () => {
    const { output, filled } = fillTemplate(template);
    expect(filled).toEqual(['JWT_SECRET', 'JWT_REFRESH_SECRET']);
    const values = Object.fromEntries(output.split('\n').filter((l) => l.includes('=')).map((l) => l.split('=')));
    expect(values.JWT_SECRET).toMatch(/^[0-9a-f]{96}$/);
    expect(values.JWT_REFRESH_SECRET).toMatch(/^[0-9a-f]{96}$/);
    expect(values.JWT_SECRET).not.toBe(values.JWT_REFRESH_SECRET);
    expect(values.DB_PASSWORD).toBe('<your-postgres-password>'); // left for the user
    expect(looksLikePlaceholder(values.DB_PASSWORD)).toBe(true);
    expect(values.PORT).toBe('5000');
  });

  test('creates the file once and never overwrites an existing one', () => {
    const templatePath = path.join(tmpRoot, '.env.example');
    const target = path.join(tmpRoot, '.env');
    fs.writeFileSync(templatePath, template);
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    expect(createEnvFile('test', { template: templatePath, target, nextSteps: [] })).toBe(true);
    const first = fs.readFileSync(target, 'utf8');
    expect(first).not.toContain(PLACEHOLDER);

    expect(createEnvFile('test', { template: templatePath, target, nextSteps: [] })).toBe(false);
    expect(fs.readFileSync(target, 'utf8')).toBe(first);

    // secrets are never printed
    const printed = log.mock.calls.flat().join('\n');
    const secret = first.match(/^JWT_SECRET=(.*)$/m)[1];
    expect(printed).not.toContain(secret);
  });
});
