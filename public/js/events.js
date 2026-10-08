import { api, h, dateParts, formatTime, calendarUrl, categoryTag, seatsBlock } from './common.js';

const $ = (id) => document.getElementById(id);
const list = $('events');

const state = { events: [], q: '', cat: '', hideFull: false };

// Remember filters in the address so a filtered view can be shared or refreshed.
const params = new URLSearchParams(location.search);
state.q = params.get('q') || '';
state.cat = params.get('cat') || '';
state.hideFull = params.get('open') === '1';

function syncUrl() {
  const next = new URLSearchParams();
  if (state.q) next.set('q', state.q);
  if (state.cat) next.set('cat', state.cat);
  if (state.hideFull) next.set('open', '1');
  const query = next.toString();
  history.replaceState(null, '', query ? `?${query}` : location.pathname);
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function groupLabel(iso) {
  const days = Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days <= 6) return 'This week';
  if (days <= 13) return 'Next week';
  const when = new Date(iso);
  const sameMonth = when.getMonth() === new Date().getMonth() && when.getFullYear() === new Date().getFullYear();
  const month = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(when);
  return sameMonth ? `Later this month` : month;
}

function relative(iso) {
  const ms = new Date(iso) - Date.now();
  const hours = ms / 3_600_000;
  if (hours < 1) return 'within the hour';
  if (hours < 24) return `in ${Math.round(hours)} hour${Math.round(hours) === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

function row(event) {
  const href = `/register.html?event=${event.id}`;
  const { dow, day, mon } = dateParts(event.startsAt);
  return h(
    'li',
    { class: `row${event.soldOut ? ' is-full' : ''}` },
    h('div', { class: 'when' }, h('span', { class: 'when-dow', text: dow }), h('span', { class: 'when-day', text: day }), h('span', { class: 'when-mon', text: mon })),
    h(
      'div',
      { class: 'row-main' },
      h('h3', { class: 'row-title' }, h('a', { href, text: event.title })),
      h('p', { class: 'row-meta' }, categoryTag(event.category), `${formatTime(event.startsAt)}, ${event.venue}`),
      event.description ? h('p', { class: 'row-desc', text: event.description }) : null
    ),
    h(
      'div',
      { class: 'row-side' },
      seatsBlock(event),
      event.soldOut
        ? h('span', { class: 'button is-disabled', 'aria-disabled': 'true', text: 'Sold out' })
        : h('a', { class: 'button', href, 'aria-label': `Register for ${event.title}`, text: 'Register' }),
      h('div', { class: 'row-links' }, h('a', { href: calendarUrl(event), download: '', 'aria-label': `Add ${event.title} to your calendar`, text: 'Add to calendar' }))
    )
  );
}

function matches(event) {
  if (state.cat && event.category !== state.cat) return false;
  if (state.hideFull && event.soldOut) return false;
  if (state.q) {
    const hay = `${event.title} ${event.venue} ${event.description} ${event.category}`.toLowerCase();
    return state.q
      .toLowerCase()
      .split(/\s+/)
      .every((word) => hay.includes(word));
  }
  return true;
}

function renderChips() {
  const counts = new Map();
  for (const e of state.events) counts.set(e.category, (counts.get(e.category) || 0) + 1);
  const chip = (value, label, count) =>
    h(
      'button',
      {
        class: 'filter-chip',
        type: 'button',
        'aria-pressed': String(state.cat === value),
        onclick: () => {
          state.cat = state.cat === value ? '' : value;
          render();
        },
      },
      label,
      h('small', { text: String(count) })
    );
  $('chips').replaceChildren(
    chip('', 'All', state.events.length),
    ...[...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([cat, n]) => chip(cat, cat, n))
  );
  // "All" is pressed only when no category is chosen.
  $('chips').firstChild.setAttribute('aria-pressed', String(state.cat === ''));
}

function render() {
  syncUrl();
  renderChips();
  $('clear').hidden = !(state.q || state.cat || state.hideFull);

  const shown = state.events.filter(matches);
  const open = state.events.filter((e) => !e.soldOut).length;
  const next = state.events[0];
  $('summary').textContent =
    `${state.events.length} event${state.events.length === 1 ? '' : 's'} coming up` +
    (open === state.events.length ? '. ' : `, ${open} with seats left. `) +
    `The next one starts ${relative(next.startsAt)}.`;

  if (shown.length === 0) {
    list.replaceChildren(
      h(
        'p',
        { class: 'empty' },
        'No events match those filters. ',
        h('button', { class: 'link-button', type: 'button', onclick: clearFilters, text: 'Show all events' })
      )
    );
    return;
  }

  const groups = new Map();
  for (const event of shown) {
    const label = groupLabel(event.startsAt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(event);
  }
  list.replaceChildren(
    ...[...groups.entries()].map(([label, events]) =>
      h(
        'section',
        { class: 'agenda-group' },
        h('h2', { class: 'group-title' }, label, h('small', { text: `${events.length} event${events.length === 1 ? '' : 's'}` })),
        h('ul', { class: 'rows' }, events.map(row))
      )
    )
  );
}

function clearFilters() {
  state.q = '';
  state.cat = '';
  state.hideFull = false;
  $('search').value = '';
  $('hide-full').checked = false;
  render();
}

$('search').addEventListener('input', (e) => {
  state.q = e.target.value.trim();
  render();
});
$('hide-full').addEventListener('change', (e) => {
  state.hideFull = e.target.checked;
  render();
});
$('clear').addEventListener('click', clearFilters);

async function load() {
  try {
    const { events } = await api('/api/events');
    // Events that started more than two hours ago are over; leave them out of the agenda.
    state.events = events.filter((e) => new Date(e.startsAt).getTime() > Date.now() - 2 * 3_600_000);
    if (state.events.length === 0) {
      $('summary').textContent = 'Nothing is open for registration right now. Check back soon.';
      list.replaceChildren();
      return;
    }
    $('search').value = state.q;
    $('hide-full').checked = state.hideFull;
    $('filters').hidden = false;
    render();
  } catch (err) {
    $('summary').textContent = '';
    list.replaceChildren(
      h(
        'div',
        { class: 'notice error', role: 'alert' },
        h('p', { text: err.message }),
        h('button', { class: 'button secondary', type: 'button', onclick: load, text: 'Try again' })
      )
    );
  }
}

load();
