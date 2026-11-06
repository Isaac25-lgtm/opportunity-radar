import { expect, test, type Page } from '@playwright/test';

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function signUp(page: Page, name = 'E2E Tester') {
  const email = `e2e-${uid()}@example.test`;
  await page.goto('/signup');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Password1234');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/app\/onboarding/);
  return email;
}

test.describe('public site', () => {
  test('home page renders, links work and there is no horizontal overflow', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('professional CV builder');
    await expect(page.getByRole('link', { name: /Create my CV/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
    await page.goto('/pricing');
    await expect(page.getByText('UGX 10,000').first()).toBeVisible();
    await page.goto('/opportunities');
    await expect(page.getByText(/results?$/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('keyboard users can skip to content and see focus', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard check on desktop');
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  });

  test('unknown routes show a 404 page and protected routes redirect to sign-in', async ({ page }) => {
    await page.goto('/does-not-exist');
    await expect(page.getByText('This page could not be found')).toBeVisible();
    await page.goto('/app/cvs');
    await expect(page).toHaveURL(/\/signin\?next=/);
  });
});

test.describe('job seeker journey', () => {
  test('sign up, create a career profile and see explained matches', async ({ page }) => {
    await signUp(page);
    await page.getByRole('button', { name: /Fill in my career profile manually/ }).click();
    await expect(page.getByRole('heading', { name: 'Career profile' })).toBeVisible();
    await page.getByLabel('Professional headline').fill('Procurement Officer');
    await page.getByLabel('Nationality').fill('Ugandan');
    const skills = page.getByLabel('Skills', { exact: true });
    for (const s of ['procurement', 'report writing', 'excel', 'contract management', 'data analysis']) {
      await skills.fill(s);
      await skills.press('Enter');
    }
    await page.getByRole('button', { name: 'Create profile' }).click();
    await expect(page.getByText('Profile saved')).toBeVisible();

    await page.goto('/app/opportunities?view=career');
    await expect(page.getByText(/\d+ results?/)).toBeVisible();
    const first = page.locator('article').first();
    await expect(first).toBeVisible();
    await first.getByRole('link').first().click();
    await expect(page.getByText('Source & verification')).toBeVisible();
    await expect(page.getByText(/Your career profile/i)).toBeVisible();
    await page.getByRole('button', { name: /^Save$/ }).click();
    await expect(page.getByRole('button', { name: /Saved/ })).toBeVisible();
    await page.goto('/app/saved');
    await expect(page.locator('article')).toHaveCount(1);
  });
});

test.describe('CV builder', () => {
  test.skip(
    ({ isMobile }) => isMobile,
    'editor flow verified on desktop; mobile layout covered by screenshots',
  );

  test('imports a PDF CV, reviews it, edits, switches template and opens the print view', async ({
    page,
    context,
  }) => {
    await signUp(page, 'Brian Okello');
    await page.goto('/app/cvs/import');
    await page.locator('input[type=file]').setInputFiles('tests/fixtures/sample-cv.pdf');
    await expect(page.getByRole('heading', { name: 'Check what we found' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByLabel('Full name')).toHaveValue('Brian Okello');
    await expect(page.getByText(/Employment history \(2\)/)).toBeVisible();
    await page.getByRole('button', { name: 'Confirm and save' }).click();
    await expect(page).toHaveURL(/\/app\/cvs\/.+\/edit/, { timeout: 30000 });

    await page
      .getByLabel(/Write 2–4 short/)
      .fill('Accountant with five years of NGO audit and reporting experience.');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Select template' }).click();
    await page.getByRole('button', { name: /Clarity/ }).click();
    await page.getByRole('button', { name: 'Back to editor' }).click();

    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('button', { name: 'Download PDF' }).first().click(),
    ]);
    await popup.waitForLoadState();
    await expect(popup.getByText('Save as PDF')).toBeVisible();
    await expect(popup.getByText('Brian Okello').first()).toBeVisible();

    // The career profile was filled from the reviewed CV.
    await page.goto('/app/profiles/career');
    await expect(page.getByLabel('Professional headline')).toHaveValue('Accountant');
  });

  test('imports a Word CV', async ({ page }) => {
    await signUp(page);
    await page.goto('/app/cvs/import');
    await page.locator('input[type=file]').setInputFiles('tests/fixtures/sample-cv.docx');
    await expect(page.getByRole('heading', { name: 'Check what we found' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByLabel('Email')).toHaveValue('brian.sample@example.com');
  });

  test('rejects an unsupported file', async ({ page }) => {
    await signUp(page);
    await page.goto('/app/cvs/import');
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'cv.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(page.getByRole('alert')).toContainText('Please choose a PDF or Word (.docx) file.');
  });
});

test.describe('billing (development payment simulator)', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop only');
  test('upgrading activates the plan only after server-side confirmation', async ({ page }) => {
    await signUp(page);
    await page.goto('/app/billing');
    await page.getByRole('button', { name: 'Choose' }).first().click();
    await expect(page).toHaveURL(/\/mock-checkout\//);
    await page.getByRole('button', { name: 'Simulate successful payment' }).click();
    await expect(page.getByText('Payment confirmed')).toBeVisible({ timeout: 20000 });
    await page.goto('/app/billing');
    await expect(page.getByText('Active until')).toBeVisible();
  });
});

test.describe('admin console', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop only');
  test('an administrator sees metrics and sources; a normal user is redirected', async ({ page }) => {
    await signUp(page);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/app(\/onboarding)?$/);
    await page.context().clearCookies();
    await page.goto('/signin');
    await page.getByLabel('Email').fill(process.env.E2E_ADMIN_EMAIL ?? 'admin@example.test');
    await page.getByLabel('Password').fill(process.env.E2E_ADMIN_PASSWORD ?? 'Password1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Admin overview' })).toBeVisible();
    await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Sources' }).click();
    await expect(page.getByText('World Bank procurement notices (East Africa)')).toBeVisible();
  });
});
