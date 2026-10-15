const SORTS = new Map([
  ['newest', 'p.created_at DESC, p.id DESC'],
  ['price_asc', 'p.price ASC, p.id ASC'],
  ['price_desc', 'p.price DESC, p.id DESC'],
  ['name_asc', 'p.name ASC, p.id ASC']
]);

export function parseProductsQuery(query) {
  const page = parseInteger(query.page, 1, 1, 100_000);
  const pageSize = parseInteger(query.pageSize, 20, 1, 100);
  const search = normalizeText(query.search, 100);
  const category = normalizeSlug(query.category, 80);
  const minPrice = parseMoney(query.minPrice, 0);
  const maxPrice = parseMoney(query.maxPrice, undefined);
  const sort = query.sort === undefined ? 'newest' : normalizeText(query.sort, 20);

  if (maxPrice !== undefined && minPrice > maxPrice) {
    const error = new Error('minPrice must be less than or equal to maxPrice');
    error.statusCode = 400;
    error.code = 'INVALID_PRICE_RANGE';
    throw error;
  }

  if (!SORTS.has(sort)) {
    const error = new Error('sort must be one of: newest, price_asc, price_desc, name_asc');
    error.statusCode = 400;
    error.code = 'INVALID_SORT';
    throw error;
  }

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    search,
    category,
    minPrice,
    maxPrice,
    orderBy: SORTS.get(sort)
  };
}

export function parsePositiveId(value, field = 'id') {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > Number.MAX_SAFE_INTEGER) {
    const error = new Error(`${field} must be a positive integer`);
    error.statusCode = 400;
    error.code = `INVALID_${field.toUpperCase()}`;
    throw error;
  }
  return Number(value);
}

function parseInteger(value, fallback, min, max) {
  if (value === undefined || value === '') {
    return fallback;
  }
  if (!/^\d+$/.test(String(value))) {
    const error = new Error('Expected an integer query parameter');
    error.statusCode = 400;
    error.code = 'INVALID_INTEGER';
    throw error;
  }
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) {
    const error = new Error(`Integer must be between ${min} and ${max}`);
    error.statusCode = 400;
    error.code = 'INTEGER_OUT_OF_RANGE';
    throw error;
  }
  return result;
}

function parseMoney(value, fallback) {
  if (value === undefined || value === '') {
    return fallback;
  }
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    const error = new Error('Price must be a non-negative number with up to 2 decimal places');
    error.statusCode = 400;
    error.code = 'INVALID_PRICE';
    throw error;
  }
  const result = Number(text);
  if (!Number.isFinite(result) || result > 1_000_000_000) {
    const error = new Error('Price is out of range');
    error.statusCode = 400;
    error.code = 'PRICE_OUT_OF_RANGE';
    throw error;
  }
  return result;
}

function normalizeText(value, maxLength) {
  if (value === undefined) {
    return undefined;
  }
  const text = String(value).trim();
  if (text.length > maxLength) {
    const error = new Error(`Value must not exceed ${maxLength} characters`);
    error.statusCode = 400;
    error.code = 'VALUE_TOO_LONG';
    throw error;
  }
  return text || undefined;
}

function normalizeSlug(value, maxLength) {
  const text = normalizeText(value, maxLength);
  if (text === undefined) return undefined;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text)) {
    const error = new Error('category must be a valid slug');
    error.statusCode = 400;
    error.code = 'INVALID_CATEGORY';
    throw error;
  }
  return text;
}

export function escapeLikePattern(value) {
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_');
}
