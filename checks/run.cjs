// 고정 검사 T01~T10 실행기. 기대값은 SPEC.md와 같다. 수정 금지.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const KEY = 'photo-editor-templates';
const FAIL_MSG = '템플릿 저장에 실패했어요';

async function openTab4(page) {
  await page.goto(BASE);
  await page.getByRole('button', { name: '4. 실제 템플릿 관리' }).click();
  await page.getByText('템플릿 관리', { exact: true }).waitFor();
}
async function reload(page) { await page.reload(); await openTab4(page); }
async function save(page, name) {
  await page.getByPlaceholder('새 템플릿 이름').fill(name);
  await page.getByRole('button', { name: '현재 설정 저장' }).click();
  await page.waitForTimeout(150);
}
async function setRange(page, idx, v) {
  await page.locator('input[type=range]').nth(idx).evaluate((el, val) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(val));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
}
async function setColor(page, v) {
  await page.locator('input[type=color]').evaluate((el, val) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
}
const names = (page) => page.locator('div[style*="text-overflow: ellipsis"][style*="font-size: 13px"]').allInnerTexts();
async function names2(page) {
  // 템플릿 항목의 이름 줄: 불러오기 버튼이 있는 행의 첫 번째 텍스트
  const rows = page.locator('button[title="불러오기"]');
  const n = await rows.count();
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push((await rows.nth(i).locator('xpath=preceding-sibling::div[1]/div[1]').innerText()).trim());
  }
  return out;
}
async function hasFail(page) { return (await page.getByText(FAIL_MSG).count()) > 0; }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const tests = {
  T01: async (p) => { await save(p, 'A'); return eq(await names2(p), ['A']) && !(await hasFail(p)); },
  T02: async (p) => { await save(p, ''); return eq(await names2(p), ['템플릿 1']); },
  T03: async (p) => { await save(p, 'A'); await reload(p); return eq(await names2(p), ['A']); },
  T04: async (p) => { await save(p, 'A'); await save(p, 'B'); await reload(p); return eq(await names2(p), ['A', 'B']); },
  T05: async (p) => {
    await p.locator('textarea').fill('안녕');
    await setRange(p, 0, 10); await setRange(p, 2, 9); await setColor(p, '#ff0000');
    await p.getByRole('button', { name: '4:5', exact: true }).click();
    await save(p, 'S');
    await p.locator('textarea').fill('바뀜'); await setRange(p, 0, 70); await setRange(p, 2, 15); await setColor(p, '#00ff00');
    await p.getByRole('button', { name: '1:1', exact: true }).click();
    const load = p.locator('button[title="불러오기"]');
    if ((await load.count()) === 0) return false;
    await load.first().click();
    const ok1 = (await p.locator('textarea').inputValue()) === '안녕';
    const ok2 = (await p.getByText('가로 위치 10%').count()) === 1;
    const ok3 = (await p.getByText('희망 크기 9%').count()) === 1;
    const ok4 = (await p.locator('input[type=color]').inputValue()) === '#ff0000';
    const ok5 = (await p.getByText('화면 미리보기 (4:5)').count()) === 1;
    return ok1 && ok2 && ok3 && ok4 && ok5;
  },
  T06: async (p) => {
    await save(p, 'A'); await save(p, 'B');
    const del = p.locator('button[title="삭제"]');
    if ((await del.count()) === 0) return false;
    await del.first().click(); await p.waitForTimeout(150);
    await reload(p); return eq(await names2(p), ['B']);
  },
  T07: async (p) => { await p.locator('textarea').fill(''); await save(p, 'E'); return (await p.getByText('(빈 문구)').count()) >= 1; },
  T08: async (p) => { await save(p, '   '); return eq(await names2(p), ['템플릿 1']); },
  T09: async (p) => {
    await setRange(p, 2, 2); await save(p, 'min');
    await setRange(p, 2, 20); await save(p, 'max');
    const load = p.locator('button[title="불러오기"]');
    if ((await load.count()) < 2) return false;
    await setRange(p, 2, 9);
    await load.nth(0).click(); const a = (await p.getByText('희망 크기 2%').count()) === 1;
    await load.nth(1).click(); const b = (await p.getByText('희망 크기 20%').count()) === 1;
    return a && b;
  },
  T10: async (p) => {
    await p.evaluate((k) => localStorage.setItem(k, '{not json'), KEY);
    await reload(p);
    return (await p.getByText('아직 저장된 템플릿이 없어요').count()) === 1 && (await p.getByText('템플릿 관리', { exact: true }).count()) === 1;
  },
};

(async () => {
  const browser = await chromium.launch();
  const results = {};
  for (const [id, fn] of Object.entries(tests)) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try { await openTab4(page); results[id] = (await fn(page)) ? 'PASS' : 'FAIL'; }
    catch (e) { results[id] = 'FAIL'; results[id + '_error'] = String(e.message).split('\n')[0]; }
    await ctx.close();
  }
  await browser.close();
  const pass = Object.entries(results).filter(([k, v]) => /^T\d+$/.test(k) && v === 'PASS').length;
  console.log(JSON.stringify(results, null, 1)); console.log(`PASS ${pass}/10`);
  fs.writeFileSync(process.env.OUT || 'checks/last-result.json', JSON.stringify({ at: new Date().toISOString(), pass, results }, null, 1));
})();
