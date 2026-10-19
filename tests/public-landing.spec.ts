import { expect, test } from "@playwright/test";

test("public landing explains the customer and business journeys", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Find your kind of place/ }),
  ).toBeVisible();
  await expect(page.getByText("Free for customers", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Rewards are for eligible participation, never for a positive rating."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Explore business tools" }),
  ).toHaveAttribute("href", "/business");

  await page.getByRole("tab", { name: "Journal" }).click();
  await expect(
    page.getByRole("tabpanel").getByRole("heading", {
      name: "Keep the moments that made it yours.",
    }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Rewards" }).click();
  await expect(
    page.getByRole("tabpanel").getByText("Partner voucher"),
  ).toBeVisible();
});

test("landing calls open the requested customer and business sign-in modes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("link", { name: "Join Dated" }).click();
  await expect(page).toHaveURL(/\/explore(?:\?|$)/);
  const customerDialog = page.getByRole("dialog");
  await expect(customerDialog).toBeVisible();
  await expect(customerDialog.getByLabel("Your name")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();

  await page.goto("/business?auth=login");
  const businessDialog = page.getByRole("dialog");
  await expect(businessDialog).toBeVisible();
  await expect(
    businessDialog.getByRole("button", { name: "Welcome back" }),
  ).toHaveClass(/selected/);
  await expect(businessDialog.getByLabel("Email address")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});
