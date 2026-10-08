// Shared helpers. All DOM is built with createElement/textContent, never innerHTML,
// so event names and attendee names can't inject markup.

const TOKEN_KEY = 'organizerToken';

export const session = {
  get token() {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set token(value) {
    try {
      if (value) sessionStorage.setItem(TOKEN_KEY, value);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable: the session just won't survive a reload */
    }
  },
};

export async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && session.token) headers.Authorization = `Bearer ${session.token}`;

  let res;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    const err = new Error('Can’t reach the server. Check your connection and try again.');
    err.status = 0;
    err.code = 'NETWORK';
    throw err;
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    const err = new Error(data?.error?.message || 'Something went wrong. Try again.');
    err.status = res.status;
    err.code = data?.error?.code;
    throw err;
  }
  return data;
}

export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const whenFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});
const stampFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
const clockFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export const formatWhen = (iso) => whenFormat.format(new Date(iso));
export const formatStamp = (iso) => stampFormat.format(new Date(iso));
export const formatClock = (iso) => clockFormat.format(new Date(iso));

export function timeAgo(iso) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

const dowFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const dayFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric' });
const monFormat = new Intl.DateTimeFormat(undefined, { month: 'short' });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const longFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });

export const formatTime = (iso) => timeFormat.format(new Date(iso));
export const formatLong = (iso) => longFormat.format(new Date(iso));
export const dateParts = (iso) => {
  const d = new Date(iso);
  return { dow: dowFormat.format(d), day: dayFormat.format(d), mon: monFormat.format(d) };
};

export const calendarUrl = (event) => `/api/events/${event.id}/calendar.ics`;

/** Colour-coded category label. The colour comes from CSS keyed on data-cat. */
export function categoryTag(category) {
  return h('span', { class: 'tag', 'data-cat': category, text: category });
}

/** Seat count: a plain number, plus a yellow flag only when the event is nearly full. */
export function seatsBlock(event) {
  if (event.soldOut) {
    return h('p', { class: 'seats' }, h('strong', { text: 'Full' }), ' ', h('span', { text: `all ${event.capacity} seats taken` }));
  }
  const few = event.remaining <= Math.max(5, Math.ceil(event.capacity * 0.1));
  return h(
    'p',
    { class: 'seats' },
    few ? h('span', { class: 'flag', text: `Only ${event.remaining} left` }) : h('strong', { text: `${event.remaining} left` }),
    few ? null : ' ',
    few ? null : h('span', { text: `of ${event.capacity}` })
  );
}
