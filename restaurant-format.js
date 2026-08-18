// canonical presentation logic for both consumers; `cortex export-restaurants` include_str!s this file

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseTags(tags) {
  if (Array.isArray(tags)) return tags;
  if (typeof tags !== 'string' || tags === '') return [];
  const trimmed = tags.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  // the corpus stores plenty of tag lists comma-separated rather than as JSON
  return trimmed
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

const isGroupTag = (tag) => tag.startsWith('group_') || tag.startsWith('chef_');

export function displayTags(tags) {
  return parseTags(tags).filter((t) => !isGroupTag(t));
}

export function groupTags(tags) {
  return parseTags(tags).filter(isGroupTag);
}

export function formatTag(tag) {
  return tag.replace(/_/g, ' ');
}

export function formatGroupName(tag) {
  const cleaned = tag.replace(/^(group_|chef_)/, '');
  const formatted = cleaned
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return tag.startsWith('chef_') ? `Chef: ${formatted}` : formatted;
}

// 1-4, so callers can style by tier without re-parsing the symbol
export function priceTier(price) {
  if (typeof price !== 'string') return 0;
  const dollars = price.match(/\$/g);
  return dollars ? Math.min(dollars.length, 4) : 0;
}

const NEW_WINDOW_DAYS = 365;

export function openingInfo(openingDate, now = null) {
  if (!openingDate) return { isNew: false, label: '' };
  const opened = new Date(openingDate);
  if (Number.isNaN(opened.getTime())) return { isNew: false, label: '' };
  const ref = now ? new Date(now) : new Date();
  const days = (ref.getTime() - opened.getTime()) / 86400000;
  return {
    isNew: days >= 0 && days <= NEW_WINDOW_DAYS,
    label: opened.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
  };
}

function to12Hour(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm.trim();
  let h = Number(m[1]);
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return m[2] === '00' ? `${h} ${suffix}` : `${h}:${m[2]} ${suffix}`;
}

function prettyRange(value) {
  if (typeof value !== 'string') return '';
  const v = value.trim();
  if (!v || /^closed$/i.test(v)) return 'Closed';
  const parts = v.split('-');
  if (parts.length !== 2) return v;
  return `${to12Hour(parts[0])} – ${to12Hour(parts[1])}`;
}

/**
 * Hours are stored two ways in the corpus: a JSON object keyed by weekday, or a
 * free-text string. Returns { rows: [{label, value, isToday}], text } — `rows` is
 * empty for the free-text form, which callers render via `text` instead.
 */
export function formatHours(hours, todayIndex = null) {
  if (!hours || typeof hours !== 'string') return { rows: [], text: '' };
  const trimmed = hours.trim();
  if (!trimmed) return { rows: [], text: '' };

  if (trimmed.startsWith('{')) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { rows: [], text: trimmed };
    }
    const idx = todayIndex === null ? new Date().getDay() : todayIndex;
    const rows = DAYS.map((day, i) => ({
      label: DAY_LABELS[i],
      value: prettyRange(parsed[day]),
      isToday: i === idx,
    })).filter((r) => r.value);
    return { rows, text: '' };
  }

  return { rows: [], text: trimmed };
}

export function matchesSearch(restaurant, term) {
  if (!term) return true;
  const q = term.toLowerCase();
  const haystack = [
    restaurant.name,
    restaurant.cuisine_type,
    restaurant.description,
    restaurant.area,
    restaurant.address,
    ...parseTags(restaurant.tags).map(formatTag),
  ];
  return haystack.some((f) => typeof f === 'string' && f.toLowerCase().includes(q));
}

export function compareRestaurants(a, b, column, order = 'asc') {
  const dir = order === 'desc' ? -1 : 1;
  let result = 0;

  if (column === 'price_range') {
    result = priceTier(a.price_range) - priceTier(b.price_range);
  } else if (column === 'opening_date') {
    const av = a.opening_date ? new Date(a.opening_date).getTime() : 0;
    const bv = b.opening_date ? new Date(b.opening_date).getTime() : 0;
    result = av - bv;
  } else {
    const av = (a[column] ?? '').toString().toLowerCase();
    const bv = (b[column] ?? '').toString().toLowerCase();
    result = av.localeCompare(bv);
  }

  if (result !== 0) return result * dir;
  return (a.name ?? '').localeCompare(b.name ?? '');
}
