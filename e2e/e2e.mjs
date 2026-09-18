// Browser end-to-end test: drives the real UI against the real API and database.
//
//   docker compose up --build -d          # API + Postgres + Mailhog   (LOGIN_RATE_LIMIT=1000 avoids self-throttling)
//   npm run dev                           # frontend on :3000 (proxies /api to the API)
//   cd e2e && npm install && npx playwright install chromium && npm test
//
// Override the addresses with APP_URL and MAILHOG_URL if you changed ports.

import { chromium } from 'playwright';
import fs from 'node:fs';

const APP = process.env.APP_URL ?? 'http://localhost:3000';
const MAILHOG = process.env.MAILHOG_URL ?? 'http://localhost:8025';
const OUT = './out';
fs.mkdirSync(OUT, { recursive: true });

// Smallest valid PNG, used as the receipt.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
fs.writeFileSync('./receipt.png', PNG);

const TITLE = `Playwright receipt ${Date.now()}`;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();

const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });

let step = 0;
const check = async (name, fn) => {
  step++;
  try { await fn(); console.log(`PASS ${step}. ${name}`); }
  catch (e) {
    console.log(`FAIL ${step}. ${name}\n     ${String(e.message).split('\n')[0]}`);
    await page.screenshot({ path: `${OUT}/fail-${step}.png` });
    process.exitCode = 1;
  }
};

const signIn = async (email, password = 'Password123!') => {
  await page.getByPlaceholder('you@company.ma').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
};
const signOut = async () => {
  await page.locator('header').getByRole('button').filter({ hasText: /Manager|Employee/ }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
};
const nav = (label) => page.locator('aside').getByText(label, { exact: false }).first().click();

await page.goto(APP);

await check('login screen shows; wrong password is refused with a visible error', async () => {
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  await signIn('imane.b@workflow-erp.ma', 'nope-nope-1');
  // Generous timeout: the very first request after start-up can be slow (JIT, dev-proxy warm-up).
  await page.getByRole('alert').filter({ hasText: 'Invalid email or password' }).waitFor({ timeout: 20000 });
});

await check('Imane (director) signs in and sees the live dashboard', async () => {
  await signIn('imane.b@workflow-erp.ma');
  await page.getByText('WorkFlow Operations Cockpit').waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${OUT}/1-dashboard.png` });
});

await check('audit trail shows the seeded "Expense #192 Pending -> Approved" entry from the database', async () => {
  await nav('Audit Trail');
  await page.getByText('Expense #192').first().waitFor();
  await page.getByText('Status: Approved').first().waitFor();
  await page.screenshot({ path: `${OUT}/2-audit.png` });
});

await signOut();

await check('Yassine sees a real leave balance from the API', async () => {
  await signIn('yassine.m@workflow-erp.ma');
  await page.getByText('WorkFlow Operations Cockpit').waitFor({ timeout: 10000 });
  await nav('Leave Management');
  await page.getByText('Annual Leave Balance').waitFor();
  const card = await page.locator('text=Annual Leave Balance').locator('xpath=..').innerText();
  if (!/\/ 18 days in/.test(card)) throw new Error(`unexpected balance card: ${card}`);
  await page.screenshot({ path: `${OUT}/3-leave-balance.png` });
});

await check('Yassine submits an expense with a real receipt upload', async () => {
  await nav('Expense Management');
  await page.getByRole('button', { name: 'Submit Expense' }).click();
  await page.getByPlaceholder('e.g. Azure Container Apps & Managed Redis hosting').fill(TITLE);
  await page.getByPlaceholder('0.00').fill('321.50');
  await page.locator('input[type=file]').last().setInputFiles('./receipt.png');
  await page.getByText('receipt.png').first().waitFor();
  await page.getByRole('button', { name: 'Submit for Approval' }).click();
  await page.getByText('Expense submitted.').waitFor({ timeout: 8000 });
  await page.getByText(TITLE).first().waitFor();
  await page.screenshot({ path: `${OUT}/4-expense-submitted.png` });
});

await check('reloading the page restores the session from the refresh token', async () => {
  await page.reload();
  await page.getByText('WorkFlow Operations Cockpit').waitFor({ timeout: 10000 });
  await nav('Expense Management');
  await page.getByText(TITLE).first().waitFor();
});

await check('the uploaded receipt opens (fetched with the auth header as a blob)', async () => {
  await page.locator('tr', { hasText: TITLE }).getByText('View Doc').click();
  const img = page.locator('img[alt="Receipt preview"]');
  await img.waitFor({ timeout: 8000 });
  const src = await img.getAttribute('src');
  if (!src?.startsWith('blob:')) throw new Error(`expected blob URL, got ${src}`);
  await page.getByRole('button', { name: 'Done' }).click();
});

await signOut();

await check('Karim (finance manager) approves it and the row updates', async () => {
  await signIn('karim.alami@workflow-erp.ma');
  await page.getByText('WorkFlow Operations Cockpit').waitFor({ timeout: 10000 });
  await nav('Expense Management');
  await page.locator('tr', { hasText: TITLE }).getByRole('button', { name: 'Review Claim' }).click();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await page.getByRole('button', { name: /Commit Decision/ }).click();
  await page.getByText('Expense approved.').waitFor({ timeout: 8000 });
  await page.locator('tr', { hasText: TITLE }).getByText('Approved').first().waitFor();
  await page.screenshot({ path: `${OUT}/5-approved.png` });
});

await check('Karim cannot review his own expense: no Review button on it', async () => {
  const own = page.locator('tr', { hasText: 'Client Strategy Dinner' });
  if (await own.getByRole('button', { name: 'Review Claim' }).count() !== 0) throw new Error('own claim is reviewable');
});

await check('the approval is on the audit trail with old and new value', async () => {
  await nav('Audit Trail');
  const row = page.locator('tr', { hasText: 'Karim Alami' }).filter({ hasText: 'Status: Approved' }).first();
  await row.waitFor();
  if (!(await row.innerText()).includes('Status: Pending')) throw new Error('missing old value');
});

await signOut();

await check('forgot password: email arrives in Mailhog, link sets a new password, old one stops working', async () => {
  const newPassword = `Reset-${Date.now()}`;
  await page.getByRole('button', { name: 'Forgot your password?' }).click();
  await page.getByPlaceholder('you@company.ma').fill('mehdi.c@workflow-erp.ma');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await page.getByText('a reset link is on its way').waitFor();

  let body;
  for (let i = 0; i < 20 && !body; i++) {
    const r = await (await fetch(`${MAILHOG}/api/v2/messages`)).json();
    body = r.items.find((m) => m.Content.Headers.To?.[0]?.includes('mehdi.c'))?.Content.Body;
    if (!body) await new Promise((r) => setTimeout(r, 500));
  }
  if (!body) throw new Error('no email in Mailhog');
  // Mail bodies are quoted-printable: undo soft line breaks and =XX escapes before reading the link.
  const decoded = body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const query = new URL(decoded.match(/http:\/\/\S+reset=\S+/)[0]).search;

  await page.goto(`${APP}/${query}`);
  await page.getByText('Choose a new password').waitFor();
  await page.locator('input[type=password]').fill(newPassword);
  await page.getByRole('button', { name: 'Update password' }).click();
  await page.getByText('Password updated').waitFor({ timeout: 8000 });

  await signIn('mehdi.c@workflow-erp.ma', 'Password123!'); // the original password must no longer work
  await page.getByRole('alert').filter({ hasText: 'Invalid email or password' }).waitFor();
  await page.locator('input[type=password]').fill(newPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByText('WorkFlow Operations Cockpit').waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${OUT}/6-after-reset.png` });
});

await check('no browser console errors or uncaught exceptions during the whole run', async () => {
  const real = problems.filter((p) => !/401|Invalid email|Failed to load resource/.test(p));
  if (real.length) throw new Error(real.join(' | '));
});

await browser.close();
console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');

