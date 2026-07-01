// Shared person-search utilities used across every people picker.
// Do NOT introduce alternative sort/filter logic – route everything through here.

export interface PersonLike {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  short_code?: string | null;
  is_active?: boolean | null;
}

export function getPersonDisplayName(u?: PersonLike | null): string {
  if (!u) return "–";
  const name = `${u.last_name ?? ""}, ${u.first_name ?? ""}`.replace(/^, |, $/g, "").trim();
  if (name && name !== ",") return name;
  return u.email || u.short_code || u.user_id || "–";
}

export function getPersonFullName(u?: PersonLike | null): string {
  if (!u) return "–";
  const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  return name || u.email || u.short_code || u.user_id || "–";
}

export interface PersonFilterOptions {
  excludeIds?: string[];
  activeOnly?: boolean;
  extraFilter?: (u: PersonLike) => boolean;
}

export function sortAndFilterPersons<T extends PersonLike>(
  users: T[] | undefined | null,
  query: string,
  opts: PersonFilterOptions = {},
): T[] {
  if (!users) return [];
  const { excludeIds = [], activeOnly = true, extraFilter } = opts;
  const excludeSet = new Set(excludeIds);
  const q = query.trim().toLowerCase();

  let list = users.filter((u) => {
    if (!u?.user_id) return false;
    if (activeOnly && u.is_active === false) return false;
    if (excludeSet.has(u.user_id)) return false;
    if (extraFilter && !extraFilter(u)) return false;
    return true;
  });

  if (q) {
    list = list.filter((u) =>
      (u.first_name || "").toLowerCase().includes(q) ||
      (u.last_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.short_code || "").toLowerCase().includes(q),
    );
  }

  return list.slice().sort((a, b) => {
    const ln = (a.last_name || "").localeCompare(b.last_name || "", "de");
    if (ln !== 0) return ln;
    return (a.first_name || "").localeCompare(b.first_name || "", "de");
  });
}
