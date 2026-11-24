import { Page } from '@playwright/test';

/**
 * Confirm dialog: pehle dialog ke saare checkbox tick karta hai (jaise "I approve this action"),
 * phir Cancel/Close/icon buttons chhor kar aakhri text wala button dabata hai.
 */
export async function confirmDialog(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });

  const boxes = dialog.getByRole('checkbox');
  const boxCount = await boxes.count();
  for (let i = 0; i < boxCount; i++) await boxes.nth(i).check();

  const buttons = dialog.getByRole('button');
  const names = await buttons.evaluateAll((els) =>
    els.map((e) => (e.getAttribute('aria-label') ?? e.textContent ?? '').trim()),
  );
  let pick = -1;
  names.forEach((n, i) => {
    if (n.length > 0 && !/cancel|close|dismiss|^no$/i.test(n)) pick = i;
  });
  if (pick < 0) throw new Error('Confirm button not found in dialog: ' + JSON.stringify(names));

  await buttons.nth(pick).click();
  await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
}