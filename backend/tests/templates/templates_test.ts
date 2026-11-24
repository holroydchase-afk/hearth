// deno test --allow-read tests/templates/
// JOIN-2 / NOTIFY-7: the sign-in email carries the 6-number code in plain words, and
// no link (Supabase's default sends a link, and a link-only email looks like a scam).
const root = new URL("../../supabase/", import.meta.url);
const read = (p: string) => Deno.readTextFileSync(new URL(p, root));

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error(m); }

for (const name of ["magic_link", "confirmation"]) {
  Deno.test(`JOIN-2: ${name} email has the code, plain words, and no link`, () => {
    const html = read(`templates/${name}.html`);
    assert(html.includes("{{ .Token }}"), "has the code");
    assert(!/ConfirmationURL|TokenHash|SiteURL|RedirectTo/.test(html), "no link variables");
    assert(!/href=|https?:\/\//i.test(html), "no links at all");
    assert(/font-size:\s*(3[2-9]|[4-9]\d)px/.test(html), "the code is big (32px+)");
    assert(/Hearth will never ask for a password/.test(html), "says what we never do");
    assert(/didn.t ask/i.test(html), "tells you what to do if you didn't ask");
    assert(html.includes("Never read this code to anyone who calls or texts you. Only type it into Hearth."), "scam warning");
  });
}

Deno.test("JOIN-2: config.toml uses both templates with a code in the subject", () => {
  const cfg = read("config.toml");
  for (const name of ["magic_link", "confirmation"]) {
    const block = cfg.split(`[auth.email.template.${name}]`)[1]?.split("\n[")[0] ?? "";
    assert(block.includes(`content_path = "./supabase/templates/${name}.html"`), `${name} content_path`);
    assert(/subject = ".*\{\{ \.Token \}\}.*"/.test(block), `${name} subject shows the code`);
  }
  assert(/otp_length = 6/.test(cfg), "6-number codes");
});

// BETA-SMS-7 (SPEC-SMS-SIGN-IN 3.5): the sign-in text. Code first (so the phone's autofill finds it), the scam
// warning, one segment (160 characters of the GSM-7 alphabet: no emoji, no curly quotes).
// Only config.toml's [auth.sms] template can be checked here. With Twilio Verify (SMS-PROVIDER.md) Twilio's own
// template sends the text; that one is checked by hand once known (BETA-SMS-7 provider half, see the QA report).
const GSM7 = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
Deno.test("BETA-SMS-7: the [auth.sms] template, with code 123456, is Hearth's words in one GSM-7 segment", () => {
  const cfg = read("config.toml");
  const block = cfg.split("[auth.sms]")[1]?.split("\n[")[0] ?? "";
  const tpl = /^template = "(.*)"$/m.exec(block)?.[1];
  assert(tpl !== undefined, "[auth.sms] has a template line");
  const text = tpl.replace(/\{\{ \.Code \}\}/g, "123456");
  assert(text.startsWith("Hearth code: 123456"), `starts "Hearth code: 123456" (got "${text}")`);
  assert(text.includes("Never read this code to anyone"), "says never read the code to anyone");
  assert(text.length <= 160, `at most 160 characters (got ${text.length})`);
  const bad = [...text].filter((ch) => !GSM7.includes(ch));
  assert(bad.length === 0, `all GSM-7 (not: ${bad.join(" ")})`);
});

// TS-GUX-R1 (grandparent-ux, Nov 19 text sign-in review): the exact words, in config.toml AND in the custom-template
// request filed with Twilio (docs/eng/SMS-PROVIDER.md), so the live text and the email teach one rule.
const TS_GUX_R1 = "Hearth code: 123456. Only type it into Hearth. Never read this code to anyone who calls or texts you, even family.";
function gsm7Segment(text: string) {
  assert(text.length <= 160, `at most 160 characters (got ${text.length})`);
  const bad = [...text].filter((ch) => !GSM7.includes(ch));
  assert(bad.length === 0, `all GSM-7 (not: ${bad.join(" ")})`);
}
Deno.test("TS-GUX-R1 / BETA-SMS-7: the [auth.sms] template, with code 123456, is exactly the R1 words", () => {
  const block = read("config.toml").split("[auth.sms]")[1]?.split("\n[")[0] ?? "";
  const tpl = /^template = "(.*)"$/m.exec(block)?.[1] ?? "";
  const text = tpl.replace(/\{\{ \.Code \}\}/g, "123456");
  assert(text === TS_GUX_R1, `config.toml text is the R1 words (got "${text}")`);
  gsm7Segment(text);
});
Deno.test("TS-GUX-R1 / BETA-SMS-7: SMS-PROVIDER.md's Twilio template request body is exactly the R1 words", () => {
  const doc = Deno.readTextFileSync(new URL("../../../docs/eng/SMS-PROVIDER.md", import.meta.url));
  const body = /Template request body[^\n]*\n```\n(.*)\n```/.exec(doc)?.[1] ?? "";
  assert(body !== "", "SMS-PROVIDER.md has a template request body block");
  const text = body.replace(/\{\{\s*code\s*\}\}/g, "123456");
  assert(text === TS_GUX_R1, `request body is the R1 words (got "${text}")`);
  gsm7Segment(text);
});
