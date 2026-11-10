// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// BETA-SMS-15 (SPEC-SMS-SIGN-IN 3.9): no phone number in the problem log or an error report. Written first.
import { safeMessage } from '../problemLog';
import { errorReport } from '../report';

const FORMS = ['(304) 555-0100', '304-555-0100', '3045550100', '+13045550100'];

describe('BETA-SMS-15 phone numbers are scrubbed', () => {
  it.each(FORMS)('BETA-SMS-15 safeMessage keeps "[phone]" for %s', (n) => {
    const out = safeMessage(`Error sending sms to ${n}: provider said no`);
    expect(out).toContain('[phone]');
    expect(out).not.toMatch(/555|0100|304/);
  });

  it('BETA-SMS-15 safeMessage still keeps short ordinary numbers (a 6-number code count, a status)', () => {
    expect(safeMessage('status 429 after 3 tries')).toBe('status 429 after 3 tries');
  });

  it.each(['304-555-0100', '3045550100', '13045550100'])('BETA-SMS-15 an error report never carries %s in its screen or code', (n) => {
    const r = errorReport(Object.assign(new Error('x'), { code: n.replace(/\D/g, '') }), n);
    expect(JSON.stringify(r)).not.toMatch(/555|0100/);
  });
});
