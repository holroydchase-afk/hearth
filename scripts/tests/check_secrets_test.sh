#!/usr/bin/env bash
# INTAKE-205-2: tests for scripts/check-secrets.sh. Fixture "secrets" are built from pieces so this file holds none.
# SECRET-6 runs the scan on this repo.
set -u
cd "$(dirname "$0")/../.."
G=$PWD/scripts/check-secrets.sh
pass=0; fail=0
ok()  { echo "ok      $1"; pass=$((pass+1)); }
bad() { echo "NOT OK  $1"; fail=$((fail+1)); }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fixture() { rm -rf "$T/r"; mkdir -p "$T/r/src"; echo "const a = 1;" > "$T/r/src/ok.ts"; }
run() { bash "$G" "$T/r"; }

fixture; out=$(run); rc=$?
[ $rc -eq 0 ] && ok "SECRET-1 a clean tree passes" || bad "SECRET-1 [rc=$rc: $out]"

fixture; printf '%s%s\n' '-----BEGIN RSA PRIVATE' ' KEY-----' > "$T/r/src/k.pem"
out=$(run); rc=$?
[ $rc -ne 0 ] && echo "$out" | grep -q 'k.pem' && ok "SECRET-2 a private key block fails, naming the file" || bad "SECRET-2 [rc=$rc: $out]"

fixture; printf '%s%s\n' 'sb_secret_' 'abcdefghijklmnopqrstuvwx' > "$T/r/src/s.ts"
out=$(run); rc=$?
[ $rc -ne 0 ] && echo "$out" | grep -q 'Supabase secret key' && ! echo "$out" | grep -q 'abcdefghijkl' && ok "SECRET-3 a Supabase secret key fails and the value is never printed" || bad "SECRET-3 [rc=$rc: $out]"

fixture; printf '%s%s\n' 'AK' 'IAABCDEFGHIJKLMNOP' > "$T/r/src/a.ts"
out=$(run); rc=$?
[ $rc -ne 0 ] && echo "$out" | grep -q 'AWS' && ok "SECRET-4 an AWS access key id fails" || bad "SECRET-4 [rc=$rc: $out]"

fixture; printf '%s%s\n' 'ghp_' 'abcdefghijklmnopqrstuvwxyz0123456789' > "$T/r/src/g.ts"
out=$(run); rc=$?
[ $rc -ne 0 ] && echo "$out" | grep -q 'GitHub token' && ok "SECRET-5 a GitHub token fails" || bad "SECRET-5 [rc=$rc: $out]"

out=$(bash "$G"); rc=$?
[ $rc -eq 0 ] && ok "SECRET-6 this repo has no secrets" || bad "SECRET-6 [rc=$rc: $out]"
echo "$pass passed, $fail failed"; [ $fail -eq 0 ]
