#!/usr/bin/env bash
# EXPO-1: app/scripts/eas.sh runs the EAS CLI with only EXPO_ACCESS_TOKEN set (the name the
# Hearth environment and the notify function use). EAS CLI itself reads EXPO_TOKEN, so the
# wrapper maps it. The CLI is stubbed; nothing leaves the machine and no token is printed.
#   bash app/scripts/tests/eas_test.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
PASS=0; FAIL=0
ok()  { echo "ok   - $1"; PASS=$((PASS + 1)); }
bad() { echo "FAIL - $1"; FAIL=$((FAIL + 1)); }
check() { if (eval "$2"); then ok "$1"; else bad "$1"; fi; }

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
# Stub CLI: records which token it saw (as a label, never the value) and its arguments.
cat > "$T/eas" <<'STUB'
#!/usr/bin/env bash
echo "token=${EXPO_TOKEN:+set}${EXPO_TOKEN:-unset} args=$*" > "$STUB_OUT"
STUB
chmod +x "$T/eas"
run() { env -u EXPO_TOKEN -u EXPO_ACCESS_TOKEN STUB_OUT="$T/out" EAS_CLI="$T/eas" "$@" bash scripts/eas.sh whoami; }

check "EXPO-1: script exists" "[[ -f scripts/eas.sh ]]"

run EXPO_ACCESS_TOKEN=tok-a >/dev/null 2>&1
check "EXPO-1: EXPO_ACCESS_TOKEN alone reaches the CLI as EXPO_TOKEN" "grep -q '^token=settok-a args=whoami$' '$T/out'"

rm -f "$T/out"; run EXPO_ACCESS_TOKEN=tok-a EXPO_TOKEN=tok-b >/dev/null 2>&1
check "EXPO-1: an explicit EXPO_TOKEN wins" "grep -q '^token=settok-b ' '$T/out'"

rm -f "$T/out"; run >"$T/err" 2>&1; rc=$?
check "EXPO-1: no token fails with a clear message and never calls the CLI" "(( rc != 0 )) && [[ ! -f '$T/out' ]] && grep -q EXPO_ACCESS_TOKEN '$T/err'"

check "EXPO-1: npm run eas uses the wrapper" "grep -q '\"eas\": \"bash scripts/eas.sh\"' package.json"

check "EXPO-2: app.json links the Expo project (eas init) and adds no permissions" "python3 -I -c \"import json,sys; e=json.load(open('app.json'))['expo']; sys.exit(not (e.get('extra',{}).get('eas',{}).get('projectId')=='676e8cec-57a6-472f-9086-9a9318eaf556' and e.get('owner')=='thefreighttrains-team' and 'permissions' not in e['android']))\""

# NAME-1: store builds lock the app ID (com.chaseholroyd.family, name-neutral, Chase Nov 27) forever, so `build` and `submit` refuse until
# Chase has recorded "**App ID locked:** yes" in docs/product/ACCOUNTS.md. Everything else runs as before.
cp ../docs/product/ACCOUNTS.md "$T/accounts.bak"
sed -i 's/^\*\*App ID locked:\*\* yes/**App ID locked:** no/' ../docs/product/ACCOUNTS.md  # refusal checks run against "no", whatever the repo says
check "NAME-1: ACCOUNTS.md records the app ID lock as a yes or no" "grep -q '^\*\*App ID locked:\*\* \(yes\|no\)' ../docs/product/ACCOUNTS.md"
check "NAME-1: app.json uses the name-neutral app ID on iPhone and Android" "python3 -I -c \"import json,sys; e=json.load(open('app.json'))['expo']; sys.exit(not (e['ios']['bundleIdentifier']=='com.chaseholroyd.family' and e['android']['package']=='com.chaseholroyd.family'))\""
check "TESTFLIGHT-1: iPhone config has no applinks entry for a domain we don't own yet" "python3 -I -c \"import json,sys; e=json.load(open('app.json'))['expo']; sys.exit('associatedDomains' in e['ios'])\""
check "TESTFLIGHT-2: eas.json has a store-distribution testflight build profile" "python3 -I -c \"import json,sys; b=json.load(open('eas.json'))['build']['testflight']; sys.exit(b['distribution']!='store')\""
for cmd in build submit; do
  rm -f "$T/out"; env -u EXPO_TOKEN STUB_OUT="$T/out" EAS_CLI="$T/eas" EXPO_ACCESS_TOKEN=tok-a bash scripts/eas.sh $cmd --profile preview >"$T/err" 2>&1; rc=$?
  check "NAME-1: eas $cmd refuses until the app ID is locked, says why, and never calls the CLI" "(( rc != 0 )) && [[ ! -f '$T/out' ]] && grep -q 'App ID locked' '$T/err' && grep -q 'com.chaseholroyd.family' '$T/err'"
done
# EXPO-4: `eas update` publishes only what the App Store's Expo Go can open (saved API answers, no network).
APP_MAJOR=$(python3 -I -c "import json,re; print(re.search(r'(\d+)\.', json.load(open('package.json'))['dependencies']['expo']).group(1))")
echo "{\"expoGoSdkVersion\": \"$APP_MAJOR.0.0\"}" > "$T/go-same.json"
echo "{\"expoGoSdkVersion\": \"$((APP_MAJOR + 1)).0.0\"}" > "$T/go-newer.json"
rm -f "$T/out"; env -u EXPO_TOKEN STUB_OUT="$T/out" EAS_CLI="$T/eas" EXPO_ACCESS_TOKEN=tok-a EXPO_VERSIONS_FILE="$T/go-same.json" bash scripts/eas.sh update --branch x >/dev/null 2>&1
check "NAME-1: other EAS commands still run" "grep -q 'args=update --branch x' '$T/out'"
rm -f "$T/out"; env -u EXPO_TOKEN STUB_OUT="$T/out" EAS_CLI="$T/eas" EXPO_ACCESS_TOKEN=tok-a EXPO_VERSIONS_FILE="$T/go-newer.json" bash scripts/eas.sh update --branch x >"$T/err" 2>&1; rc=$?
check "EXPO-4: eas update refuses when Expo Go has moved past our SDK, says why, never calls the CLI" "(( rc != 0 )) && [[ ! -f '$T/out' ]] && grep -q 'Expo Go' '$T/err'"
sed -i 's/^\*\*App ID locked:\*\* no.*/**App ID locked:** yes/' ../docs/product/ACCOUNTS.md
rm -f "$T/out"; env -u EXPO_TOKEN STUB_OUT="$T/out" EAS_CLI="$T/eas" EXPO_ACCESS_TOKEN=tok-a bash scripts/eas.sh build --profile preview >/dev/null 2>&1
check "NAME-1: once the app ID is locked, eas build runs" "grep -q 'args=build --profile preview' '$T/out'"
cp "$T/accounts.bak" ../docs/product/ACCOUNTS.md

echo "eas: $PASS passed, $FAIL failed"
(( FAIL == 0 ))
