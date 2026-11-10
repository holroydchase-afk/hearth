#!/usr/bin/env bash
# PRIV-R1 (privacy-security review of text sign-in, SPEC-SMS-SIGN-IN, DEC-56): config.toml's [auth.sms] must not
# auto-confirm phone numbers. With enable_confirmations = false, Supabase Auth's password sign-up
# (POST /auth/v1/signup {phone, password}) makes an account for ANY unregistered number with no code sent, which
# defeats the phone-bound invite (BETA-SMS-8: "only this number can open the invite") and lets someone squat a
# grandparent's number. Hearth has no passwords, so nothing legitimate needs it. Also: texts ship off, the
# provider's credentials come from env only, and the fixed test code never goes live.
#   bash tests/auth_config_test.sh
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; FAIL=0
ok() { if [ "$1" = 0 ]; then PASS=$((PASS+1)); echo "ok      $2"; else FAIL=$((FAIL+1)); echo "NOT OK  $2"; fi; }
CFG=supabase/config.toml
# The lines of one [section] (up to the next header line).
section() { awk -v h="[$1]" '$0==h{on=1;next} /^\[/{on=0} on' "$CFG"; }

section auth.sms | grep -qx 'enable_confirmations = true'; ok $? "PRIV-R1 [auth.sms] enable_confirmations = true (no phone account without a texted code)"
section auth.sms.twilio_verify | grep -qx 'enabled = false'; ok $? "PRIV-R1 the text provider ships off (SPEC-SMS-SIGN-IN 3.1)"
! section auth.sms.twilio_verify | grep -E '^(account_sid|message_service_sid|auth_token) = ' | grep -vq '"env('; ok $? "PRIV-R1 Twilio credentials only from env(), never a value in git"
! grep -qx '\[auth.sms.test_otp\]' "$CFG"; ok $? "PRIV-R1 the fixed test code stays commented out (it would be a backdoor if it shipped)"

echo
echo "AUTH CONFIG TEST RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" = 0 ]
