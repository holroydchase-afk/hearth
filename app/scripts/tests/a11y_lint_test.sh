#!/usr/bin/env bash
# A11YLINT-1..2 (intake #213): the React Native accessibility rules are on and catch the mistakes they are for.
# Writes one bad screen next to the real ones, lints it with the strict config, and removes it again.
set -uo pipefail
cd "$(dirname "$0")/../.."
bad=src/__a11y_lint_probe__.tsx
trap 'rm -f "$bad"' EXIT
cat > "$bad" <<'T'
import { Pressable, Text, TouchableOpacity } from 'react-native';
export const Probe = () => (
  <TouchableOpacity onPress={() => {}}>
    <Pressable accessibilityRole="buttn" onPress={() => {}}><Text>x</Text></Pressable>
  </TouchableOpacity>
);
T
out=$(STUDIO_LINT_STRICT=1 npx eslint "$bad" 2>&1)
fail=0
for rule in has-valid-accessibility-role has-valid-accessibility-descriptors; do
  if printf '%s\n' "$out" | grep -qF "react-native-a11y/$rule"; then echo "ok   A11YLINT $rule is reported"; else echo "FAIL A11YLINT $rule was not reported"; fail=1; fi
done
if printf '%s\n' "$out" | grep -q " error "; then echo "ok   A11YLINT-2 strict makes them errors"; else echo "FAIL A11YLINT-2 not errors in strict"; fail=1; fi
exit $fail
