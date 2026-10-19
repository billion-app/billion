// Address, voting, and privacy flows on the actual Expo web app.
//
//   BASE_URL=http://localhost:8097 node scripts/capture-address-privacy-flows.cjs
//
// Writes screenshots to OUT_DIR (default /tmp/billion-address-audit-fixes).
// tRPC is intercepted: ballot availability is live and every voter lookup
// fails, so no provider is called and nothing is written outside the browser.
// Browser geolocation is denied, then granted; web reverse geocoding has no
// street-address provider, so the granted path proves the field stays a
// manual draft and is never submitted on the person's behalf.
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const assert = require("node:assert/strict");

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8097";
const OUT_DIR = process.env.OUT_DIR ?? "/tmp/billion-address-audit-fixes";
const WIDTHS = [320, 390];
const LONG_ADDRESS =
  "1600 Pennsylvania Avenue Northwest, Apartment 4021, Sacramento, CA 95814";

// Copied from the app catalog so the script fails loudly if copy drifts.
const L = {
  en: {
    useLocation: "Use my location",
    save: "Save",
    cancel: "Cancel",
    change: "Change address",
    readPolicy: "Read full Privacy Policy",
    privacyTitle: "Privacy Policy",
    tosTitle: "Terms of Service",
    addAddress: "Add address",
    editAddress: "Edit registered address",
    editLocation: "Edit or clear your address",
    deadlines: "DEADLINES TO CHECK",
    registrationDeadline: "Registration deadline",
  },
  es: {
    useLocation: "Usar mi ubicación",
    save: "Guardar",
    cancel: "Cancelar",
    change: "Cambiar dirección",
    readPolicy: "Leer la Política de privacidad completa",
    privacyTitle: "Política de privacidad",
    tosTitle: "Términos del servicio",
    addAddress: "Agregar dirección",
    editAddress: "Editar la dirección registrada",
    editLocation: "Edita o borra tu dirección",
    deadlines: "FECHAS LÍMITE QUE DEBES CONSULTAR",
    registrationDeadline: "Fecha límite de inscripción",
  },
  zh: {
    useLocation: "使用我的位置",
    save: "保存",
    cancel: "取消",
    change: "更改地址",
    readPolicy: "阅读完整隐私政策",
    privacyTitle: "隐私政策",
    tosTitle: "服务条款",
    addAddress: "添加地址",
    editAddress: "编辑登记地址",
    editLocation: "编辑或清除你的地址",
    deadlines: "需要确认的截止日期",
    registrationDeadline: "登记截止日期",
  },
};

function trpcBody(url) {
  const procedures = new URL(url).pathname.split("/api/trpc/")[1].split(",");
  return procedures.map((procedure) =>
    procedure === "civic.getBallotAvailability"
      ? { result: { data: { json: { lookupEnabled: true } } } }
      : procedure === "civic.getVoterInfo"
        ? {
            error: {
              json: {
                message: "Fixture lookup failure",
                code: -32603,
                data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
              },
            },
          }
        : { result: { data: { json: null } } },
  );
}

async function newContext(browser, { language, width, address, geo }) {
  const context = await browser.newContext({
    viewport: { width, height: 760 },
    ...(geo
      ? {
          permissions: ["geolocation"],
          geolocation: { latitude: 38.5767, longitude: -121.4934 },
        }
      : {}),
  });
  await context.addInitScript(
    ({ language, address }) => {
      localStorage.setItem("billion.language.v1", language);
      localStorage.setItem(
        "billion.onboarding.v1",
        JSON.stringify({
          completed: true,
          vectors: [],
          sectors: [],
          topics: [],
          alerts: { instant: false, digest: false },
          deferredClaim: true,
        }),
      );
      if (address) localStorage.setItem("user_address", address);
      else localStorage.removeItem("user_address");
    },
    { language, address },
  );
  await context.route("**/api/trpc/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(trpcBody(route.request().url())),
    }),
  );
  return context;
}

let browser;
(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const errors = [];
  const shots = [];

  for (const language of Object.keys(L)) {
    const l = L[language];
    for (const width of WIDTHS) {
      const tag = `${language}-${width}`;
      const open = async (context, path) => {
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(`${tag} ${error.message}`));
        await page.goto(`${BASE_URL}${path}`, {
          waitUntil: "networkidle",
          timeout: 180000,
        });
        return page;
      };
      const shot = async (page, name, fullPage = false) => {
        const path = `${OUT_DIR}/${tag}-${name}.png`;
        await page.screenshot({ path, fullPage });
        shots.push(path);
      };

      // Privacy summary → controls → policy opens at the privacy section.
      {
        const context = await newContext(browser, { language, width });
        const page = await open(context, "/settings/privacy");
        await page.getByText(l.readPolicy).last().waitFor();
        await shot(page, "01-privacy", true);
        await page.getByText(l.readPolicy).last().click();
        await page.waitForURL(/section=privacy/);
        const headings = page.getByRole("heading");
        await headings.first().waitFor();
        const order = await headings.allInnerTexts();
        const privacyAt = order.indexOf(l.privacyTitle);
        const termsAt = order.indexOf(l.tosTitle);
        assert.ok(privacyAt >= 0 && termsAt > privacyAt, `${tag}: ${order}`);
        await shot(page, "02-policy-privacy-first");
        await page.goBack();
        await page.getByText(l.editLocation).last().click();
        await page.waitForURL(/settings\/location/);
        await shot(page, "03-privacy-to-location");
        await context.close();
      }

      // Location denied → manual entry → save → change → cancel.
      {
        const context = await newContext(browser, { language, width });
        const page = await open(context, "/settings/location");
        const field = page.getByRole("textbox").last();
        await field.waitFor();
        await page.getByRole("button", { name: l.useLocation }).last().click();
        await page.getByRole("alert").last().waitFor({ timeout: 20000 });
        assert.equal(await field.isEditable(), true, `${tag}: denied field`);
        await shot(page, "04-location-denied");
        await field.fill(LONG_ADDRESS);
        await shot(page, "05-location-manual-draft");
        await page.getByRole("button", { name: l.save }).last().click();
        await page.getByText(LONG_ADDRESS).last().waitFor();
        await shot(page, "06-location-saved");
        await page.getByText(l.change).last().click();
        await page.getByRole("button", { name: l.cancel }).last().click();
        await page.getByText(LONG_ADDRESS).last().waitFor();
        await context.close();
      }

      // Location granted: web has no geocoder, so the draft stays manual.
      {
        const context = await newContext(browser, {
          language,
          width,
          geo: true,
        });
        const page = await open(context, "/settings/location");
        const field = page.getByRole("textbox").last();
        await field.waitFor();
        await page.getByRole("button", { name: l.useLocation }).last().click();
        await page.getByRole("alert").last().waitFor({ timeout: 30000 });
        assert.equal(await field.inputValue(), "", `${tag}: auto-filled`);
        assert.equal(
          await page.evaluate(() => localStorage.getItem("user_address")),
          null,
          `${tag}: GPS path saved an address`,
        );
        await shot(page, "07-location-gps-no-street-address");
        await context.close();
      }

      // How to Vote: edit has Cancel; a long saved address wraps.
      {
        const context = await newContext(browser, { language, width });
        const page = await open(context, "/how-to-vote");
        await page.getByText(l.addAddress).last().click();
        await page.getByRole("textbox").last().waitFor();
        await shot(page, "08-how-to-vote-edit");
        await page.getByRole("button", { name: l.cancel }).last().click();
        await page.getByText(l.addAddress).last().waitFor();
        await context.close();

        const saved = await newContext(browser, {
          language,
          width,
          address: LONG_ADDRESS,
        });
        const lookup = await open(saved, "/how-to-vote");
        await lookup
          .getByRole("button", { name: l.editAddress })
          .last()
          .waitFor({ timeout: 60000 });
        await shot(lookup, "09-how-to-vote-error-address-wrap");
        await saved.close();
      }

      // Guide: generic deadline rows link to official sources.
      {
        const context = await newContext(browser, { language, width });
        const page = await open(context, "/how-to-vote-guide");
        const heading = page.getByText(l.deadlines).last();
        await heading.scrollIntoViewIfNeeded();
        assert.equal(
          await page
            .getByRole("link", {
              name: new RegExp(`^${l.registrationDeadline}`),
            })
            .count(),
          1,
          `${tag}: registration deadline link`,
        );
        await shot(page, "10-guide-deadlines");
        await context.close();
      }
    }
  }

  assert.deepEqual(errors, []);
  console.log(shots.join("\n"));
  console.log(`${shots.length} screenshots in ${OUT_DIR}`);
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => browser?.close());
