export interface PasswordRule {
  key: "length" | "upper" | "lower" | "digit" | "special";
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { key: "length", test: (p) => p.length >= 8 },
  { key: "upper", test: (p) => /[A-Z]/.test(p) },
  { key: "lower", test: (p) => /[a-z]/.test(p) },
  { key: "digit", test: (p) => /[0-9]/.test(p) },
  { key: "special", test: (p) => /[!?%&@#$*\-_+=.,;:/\\(){}\[\]<>'"`~|^]/.test(p) },
];

export function validatePassword(pw: string) {
  const results = PASSWORD_RULES.map((r) => ({ key: r.key, ok: r.test(pw) }));
  return { results, valid: results.every((r) => r.ok) };
}

export function generateStrongPassword(length = 14): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const specials = "!?%&@#$*-_+=";
  const all = upper + lower + digits + specials;
  const rnd = (set: string) => set[Math.floor(Math.random() * set.length)];
  const required = [rnd(upper), rnd(lower), rnd(digits), rnd(specials)];
  const rest = Array.from({ length: Math.max(length - required.length, 4) }, () => rnd(all));
  const arr = [...required, ...rest];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}
