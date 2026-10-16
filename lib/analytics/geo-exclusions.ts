// Countries hidden from all traffic geo breakdowns (internal/agency traffic).
// Matches both ISO codes and full names since sources report either.
const EXCLUDED_COUNTRIES = new Set(["PH", "PHILIPPINES"]);

export const isExcludedCountry = (country: unknown): boolean =>
  typeof country === "string" && EXCLUDED_COUNTRIES.has(country.trim().toUpperCase());

export const filterExcludedCountries = <T extends { country?: unknown; key?: unknown }>(
  items: T[] | null | undefined
): T[] => (items || []).filter((item) => !isExcludedCountry(item?.country ?? item?.key));
