// Maps known account/card digits to a friendly name; anything not listed
// here just falls back to the raw digits.
const ACCOUNT_NAMES_BY_DIGITS: Record<string, string> = {
  "7300": "Checking",
};

export function friendlyAccountLabel(digits: string): string {
  return ACCOUNT_NAMES_BY_DIGITS[digits] ?? digits;
}
