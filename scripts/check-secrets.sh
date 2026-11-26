#!/usr/bin/env bash
# INTAKE-205-2 (HEA-FR301): a secret scan on every PR, over tracked files. Fails on a private key block, an
# AWS access key id, a Supabase secret key (sb_secret_...), a GitHub token, a Stripe live key, a Resend key or a
# JWT-shaped service key. Never prints the matched value, only the file and the rule. Usage: [repo_root]
# This is a small pattern scan, not gitleaks: GitHub secret scanning with push protection is the second layer.
set -u
ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT" || exit 2
if git rev-parse --git-dir >/dev/null 2>&1; then files=$(git ls-files); else files=$(find . -type f -not -path './node_modules/*' | sed 's#^\./##'); fi
rc=0
scan() { # $1 rule name, $2 extended regex
  local hits
  hits=$(printf '%s\n' "$files" | grep -vE '(^|/)(package-lock\.json|.*\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|mp4|pdf))$|^scripts/(check-secrets\.sh|tests/)|^backend/tests/|_test\.ts$' | while read -r f; do
    [ -f "$f" ] && grep -IlE -- "$2" "$f" 2>/dev/null
  done)
  if [ -n "$hits" ]; then
    while read -r f; do echo "SECRET? $1 in $f"; done <<< "$hits"
    rc=1
  fi
}
scan "private key block"      '-----BEGIN ([A-Z]+ )?PRIVATE KEY-----'
scan "AWS access key id"      '(^|[^A-Z0-9])AKIA[0-9A-Z]{16}([^A-Z0-9]|$)'
scan "Supabase secret key"    'sb_secret_[A-Za-z0-9_-]{20,}'
scan "GitHub token"           '(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}'
scan "Stripe live key"        '(sk|rk)_live_[A-Za-z0-9]{20,}'
scan "Resend API key"         're_[A-Za-z0-9]{8,}_[A-Za-z0-9]{20,}'
scan "JWT-shaped key"         'eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'
[ $rc -eq 0 ] && echo "check-secrets: ok"
exit $rc
