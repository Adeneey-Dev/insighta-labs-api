/**
 * Query Normalizer
 *
 * Problem: Two queries that mean the same thing produce different cache keys.
 * "Nigerian females between ages 20 and 45" and "Women aged 20–45 from Nigeria"
 * both parse to the same filters but would create different cache keys if we
 * just stringified the raw query object.
 *
 * Solution: After parsing, sort all filter keys alphabetically and coerce
 * values to consistent types before building the key string. Two queries that
 * resolve to the same filters will always produce the same cache key.
 */

export interface NormalizedFilters {
  gender?: string;
  age_group?: string;
  country_id?: string;
  min_age?: number;
  max_age?: number;
  min_gender_probability?: number;
  min_country_probability?: number;
  sort_by: string;
  order: string;
  page: number;
  limit: number;
}

/**
 * Takes raw query params (strings from HTTP) and returns a normalized,
 * typed filter object. This is the single source of truth for what a
 * query means — used by both the cache key generator and the DB query builder.
 */
export function normalizeFilters(
  query: Record<string, any>,
): NormalizedFilters {
  const normalized: NormalizedFilters = {
    page: Math.max(1, parseInt(String(query.page || '1')) || 1),
    limit: Math.min(
      50,
      Math.max(1, parseInt(String(query.limit || '10')) || 10),
    ),
    sort_by: ['age', 'created_at', 'gender_probability'].includes(query.sort_by)
      ? query.sort_by
      : 'created_at',
    order: query.order === 'asc' ? 'asc' : 'desc',
  };

  // Gender — lowercase, only accept valid values
  if (query.gender) {
    const g = String(query.gender).toLowerCase().trim();
    if (g === 'male' || g === 'female') normalized.gender = g;
  }

  // Age group — lowercase, only accept valid values
  if (query.age_group) {
    const ag = String(query.age_group).toLowerCase().trim();
    if (['child', 'teenager', 'adult', 'senior'].includes(ag))
      normalized.age_group = ag;
  }

  // Country ID — always uppercase 2-letter ISO code
  if (query.country_id) {
    normalized.country_id = String(query.country_id).toUpperCase().trim();
  }

  // Age range — integers, drop if NaN or negative
  if (query.min_age !== undefined && query.min_age !== '') {
    const v = parseInt(String(query.min_age));
    if (!isNaN(v) && v >= 0) normalized.min_age = v;
  }
  if (query.max_age !== undefined && query.max_age !== '') {
    const v = parseInt(String(query.max_age));
    if (!isNaN(v) && v >= 0) normalized.max_age = v;
  }

  // Probability thresholds — floats clamped to 0–1
  if (
    query.min_gender_probability !== undefined &&
    query.min_gender_probability !== ''
  ) {
    const v = parseFloat(String(query.min_gender_probability));
    if (!isNaN(v))
      normalized.min_gender_probability = Math.min(1, Math.max(0, v));
  }
  if (
    query.min_country_probability !== undefined &&
    query.min_country_probability !== ''
  ) {
    const v = parseFloat(String(query.min_country_probability));
    if (!isNaN(v))
      normalized.min_country_probability = Math.min(1, Math.max(0, v));
  }

  return normalized;
}

/**
 * Builds a stable, deterministic cache key from a normalized filter object.
 *
 * Keys are sorted alphabetically so key order never matters.
 * Undefined values are represented as empty strings so missing filters
 * produce a consistent key regardless of whether the param was absent or empty.
 *
 * Example output:
 * "profiles:age_group=adult:country_id=NG:gender=female:limit=10:
 *  max_age=45:min_age=20:min_country_probability=:min_gender_probability=:
 *  order=desc:page=1:sort_by=created_at"
 */
export function buildCacheKey(
  prefix: string,
  filters: NormalizedFilters,
): string {
  const parts = Object.keys(filters)
    .sort()
    .map((key) => `${key}=${(filters as any)[key] ?? ''}`)
    .join(':');
  return `${prefix}:${parts}`;
}

/**
 * Builds a cache key for NLP search queries.
 * The raw query string is normalized (trimmed, lowercased, collapsed whitespace)
 * before being combined with the parsed filters so that "Young Males from NIGERIA"
 * and "young males from nigeria" hit the same cache entry.
 */
export function buildSearchCacheKey(
  rawQuery: string,
  filters: NormalizedFilters,
): string {
  const normalizedQuery = rawQuery.toLowerCase().trim().replace(/\s+/g, ' ');
  const filterKey = buildCacheKey('search', filters);
  return `${filterKey}:q=${normalizedQuery}`;
}
