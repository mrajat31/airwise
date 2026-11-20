import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mainNav, mockNetwork } from "./mocks.js";

const SECTIONS = ["Overview", "Forecast", "Neighborhoods", "Take action"];

test.beforeEach(async ({ page }) => {
  await mockNetwork(page);
});

async function openApp(page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Current air quality: 125 US AQI/ })).toBeVisible();
}

async function expectNoHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("answers 'is it OK, and when is it better?' on the first screen", async ({ page }) => {
  await openApp(page);
  const hero = page.locator(".hero");
  await expect(hero.getByText("Sensitive groups should take it easy")).toBeVisible();
  await expect(hero.getByText("Best time outdoors")).toBeVisible();
  await expect(hero.getByText(/6 AM–9 AM · about 68 AQI/)).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("every section renders without horizontal scrolling", async ({ page }) => {
  await openApp(page);
  for (const section of SECTIONS) {
    await mainNav(page).getByRole("button", { name: section }).click();
    await expect(mainNav(page).getByRole("button", { name: section })).toHaveAttribute("aria-current", "page");
    await expectNoHorizontalScroll(page);
  }
});

test("activity presets re-rank the best time", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Running" }).click();
  const stat = page.locator(".hero-stat").filter({ hasText: "Best time to run" });
  await expect(stat).toContainText("6 AM–7 AM · about 40 AQI");
  await page.reload();
  await expect(page.getByRole("button", { name: "Running" })).toHaveAttribute("aria-pressed", "true");
});

test("the share card downloads as a 1080×1080 PNG", async ({ page }) => {
  // Force the download path: headless browsers differ in Web Share support.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined });
    Object.defineProperty(navigator, "canShare", { value: undefined });
  });
  await openApp(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Share today's card" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("airwise-pune-air-quality.png");
  const png = await readFile(await download.path());
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1080);
  await expect(page.getByText(/Card saved as an image/)).toBeVisible();
});

test("official monitors appear on the map and beside the estimate", async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole("heading", { name: "Official monitors nearby" })).toBeVisible();
  await expect(page.locator(".station-list").getByText("Shivajinagar, Pune - IITM")).toBeVisible();
  await expect(page.locator(".map-station")).toHaveCount(1);
});

test("switches to Marathi and Hindi", async ({ page }) => {
  await openApp(page);
  await page.getByRole("combobox", { name: "Language" }).selectOption("mr");
  await expect(page.getByRole("heading", { level: 1, name: "पुण्यातील हवा गुणवत्ता" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "mr");
  await expectNoHorizontalScroll(page);
  await page.getByRole("combobox", { name: "भाषा" }).selectOption("hi");
  await expect(page.getByRole("heading", { level: 1, name: "पुणे की वायु गुणवत्ता" })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

for (const colorScheme of ["light", "dark"]) {
  test(`has no detectable WCAG A/AA violations in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await openApp(page);
    for (const section of SECTIONS) {
      await mainNav(page).getByRole("button", { name: section }).click();
      await expect(mainNav(page).getByRole("button", { name: section })).toHaveAttribute("aria-current", "page");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const summary = results.violations.map((violation) => ({
        id: violation.id,
        targets: violation.nodes.slice(0, 5).map((node) => node.target.join(" ")),
      }));
      expect(summary, `${section} (${colorScheme})`).toEqual([]);
    }
  });
}
