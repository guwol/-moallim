(() => {
  'use strict';

  const DISTRICTS = [
    '와부읍', '진접읍', '화도읍', '진건읍', '오남읍', '퇴계원읍',
    '별내면', '수동면', '조안면', '호평동', '평내동', '금곡동',
    '양정동', '다산1동', '다산2동', '별내동'
  ];
  const CATEGORIES = [
    { name: '문화·예술', icon: 'culture' },
    { name: '교육·강좌', icon: 'learning' },
    { name: '축제·행사', icon: 'festival' },
    { name: '스포츠', icon: 'sports' },
    { name: '가족·어린이', icon: 'family' },
    { name: '봉사·참여', icon: 'volunteer' },
    { name: '독서·도서관', icon: 'reading' }
  ];
  const ICON_PATHS = {
    culture: ['M4 19h16', 'M6 16V9l6-5 6 5v7', 'M9 19v-5h6v5'],
    learning: ['M3 6.5c3-1.4 6-.8 9 1.2v11c-3-2-6-2.6-9-1.2z', 'M21 6.5c-3-1.4-6-.8-9 1.2v11c3-2 6-2.6 9-1.2z'],
    festival: ['M12 3v2', 'M5.6 5.6 7 7', 'M3 12h2', 'M19 12h2', 'M17 7l1.4-1.4', 'M8 16l4-9 4 9', 'M9.2 13h5.6'],
    sports: ['M12 3 20 7.5v9L12 21l-8-4.5v-9z', 'm4.3 8 7.7 4.4L19.7 8', 'M12 12.4V21'],
    family: ['M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M17 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 'M3.5 19c.3-3 2.1-4.5 5.5-4.5s5.2 1.5 5.5 4.5', 'M14 15c3.7-.8 6 .5 6.5 3.5'],
    volunteer: ['M12 21s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.5-8 11-8 11z', 'M8 12h8', 'M12 8v8'],
    reading: ['M4 5.5c3-1 5.7-.3 8 1.5v12c-2.3-1.8-5-2.5-8-1.5z', 'M20 5.5c-3-1-5.7-.3-8 1.5v12c2.3-1.8 5-2.5 8-1.5z']
  };
  const STORAGE = { regions: 'moallim.regions', categories: 'moallim.categories', bookmarks: 'moallim.bookmarks' };
  const state = {
    regions: readArray(STORAGE.regions),
    categories: readArray(STORAGE.categories),
    bookmarks: readArray(STORAGE.bookmarks),
    events: [],
    view: 'home',
    eventStatus: 'upcoming',
    sort: 'soonest',
    calendar: false,
    calendarDay: seoulDay(Date.now()),
    categoryResults: false,
    subcategory: '',
    screen: 'welcome',
    dataError: false,
    toastTimer: null,
    statusTimer: null,
    selectedEventId: null,
    detailReturn: null
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const screens = { welcome: $('#screen-welcome'), districts: $('#screen-districts'), interests: $('#screen-interests'), feed: $('#screen-feed'), detail: $('#screen-detail'), discovery: $('#screen-discovery') };

  const languages = ['ko', 'en', 'ru', 'zh-Hans'];
  let language = 'ko';
  try {
    const saved = localStorage.getItem('moallim.language');
    if (languages.includes(saved)) language = saved;
  } catch { /* Language selection also works without storage. */ }

  function t(source, number) {
    const message = MOALLIM_MESSAGES[source]?.[languages.indexOf(language) - 1] ?? source;
    return number === undefined ? message : message.replace('{n}', String(number));
  }

  // Remember only text belonging to the static template. Dynamic views render
  // from the same canonical Korean names used by filters and local storage.
  const template = [];
  const walker = document.createTreeWalker($('#app'), NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const source = node.data.trim();
    if (MOALLIM_MESSAGES[source]) template.push(() => {
      node.data = node.data.replace(node.data.trim(), t(source));
    });
  }
  for (const el of $$('[aria-label], [placeholder]')) {
    for (const attr of ['aria-label', 'placeholder']) {
      const source = el.getAttribute(attr);
      if (source && MOALLIM_MESSAGES[source]) template.push(() => el.setAttribute(attr, t(source)));
    }
  }
  function translateTemplate() {
    document.documentElement.lang = language;
    document.title = language === 'ko' ? '모알림 — 놓치기 아까운 우리 동네 순간들' : 'Moallim · ' + t('남양주시');
    $('#ui-language').value = language;
    $('#language-code').textContent = {ko:'KO', en:'EN', ru:'RU', 'zh-Hans':'中文'}[language];
    template.forEach(update => update());
    $('.bottom-nav-item[data-view="saved"] span:nth-child(2)').textContent = language === 'ko' ? '저장' : t('저장 목록');
  }

  function readArray(key) {
    try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; }
    catch (_) { return []; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (_) { /* Preferences remain available for this session. */ }
  }
  function restoreListing(snapshot) {
    state.calendar = Boolean(snapshot.calendar);
    state.calendarDay = snapshot.calendarDay ?? seoulDay(Date.now());
    state.categoryResults = Boolean(snapshot.categoryResults);
    state.subcategory = snapshot.subcategory || '';
  }
  function feedHistoryState() {
    return {
      view: state.view,
      eventStatus: state.eventStatus,
      sort: state.sort,
      calendar: state.calendar, calendarDay: state.calendarDay,
      categoryResults: state.categoryResults, subcategory: state.subcategory,
      filterRegion: $('#explore-region')?.value || 'all',
      filterCategory: $('#explore-category')?.value || 'all',
      scrollY: window.scrollY
    };
  }
  function setScreen(name, push = true) {
    if (!screens[name]) return;
    state.screen = name;
    $(`#tools-${name}`).append($('#language-picker'));
    Object.entries(screens).forEach(([key, element]) => {
      element.hidden = key !== name;
      element.classList.toggle('is-active', key === name);
    });
    const hash = name === 'detail' ? `event/${encodeURIComponent(state.selectedEventId || '')}` : name === 'feed' ? state.view : name;
    if (push) {
      const entry = { screen: name, ...feedHistoryState(), eventId: state.selectedEventId };
      if (name === 'detail' && state.detailReturn) {
        entry.returnScrollY = state.detailReturn.scrollY;
        entry.returnState = state.detailReturn;
      }
      history.pushState(entry, '', `#${hash}`);
    }
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  function setView(view, push = true) {
    if (!['home', 'explore', 'saved'].includes(view)) return;
    state.view = view;
    $('#desktop-saved').textContent = t(view === 'saved' ? '추천 행사' : '저장한 행사');
    $$('.bottom-nav-item').forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    const browsing = view === 'explore' && state.categoryResults;
    $('#explore-filters').hidden = view !== 'explore' || browsing;
    $('#results-back').hidden = !browsing;
    $('#status-tabs').hidden = browsing;
    $('#feed-tools').hidden = view !== 'home';
    syncSortOptions();
    if (state.screen === 'feed' && push) history.pushState({ screen: 'feed', ...feedHistoryState() }, '', `#${view}`);
    renderEvents();
  }
  function setEventStatus(status, push = true) {
    if (!['upcoming', 'ongoing'].includes(status)) return;
    state.eventStatus = status;
    $$('.view-tab').forEach(tab => {
      const active = tab.dataset.status === status;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    state.sort = status === 'past' ? 'latest' : 'soonest';
    syncSortOptions();
    if (state.screen === 'feed' && push) history.pushState({ screen: 'feed', ...feedHistoryState() }, '', `#${state.view}/${status}`);
    renderEvents();
  }
  function syncSortOptions() {
    const select = $('#event-sort');
    const labels = state.eventStatus === 'ongoing' && !(state.view === 'explore' && state.categoryResults)
      ? ['가까운 종료순', '늦은 종료순']
      : state.eventStatus === 'past'
        ? ['오래된 종료순', '최근 종료순']
        : ['가까운 날짜순', '늦은 날짜순'];
    select.options[0].textContent = t(labels[0]);
    select.options[1].textContent = t(labels[1]);
    select.value = state.sort;
  }
  window.addEventListener('popstate', event => {
    const hashParts = location.hash.slice(1).split('/');
    const hashScreen = hashParts[0] === 'event' ? 'detail' : ['home', 'explore', 'saved'].includes(hashParts[0]) ? 'feed' : hashParts[0];
    const screen = event.state?.screen || hashScreen;
    const safeScreen = screens[screen] ? screen : 'welcome';
    if (safeScreen === 'detail') {
      state.view = event.state?.view || state.view;
      state.eventStatus = event.state?.eventStatus || state.eventStatus;
      const id = event.state?.eventId || decodeURIComponent(hashParts[1] || '');
      openDetailsById(id, false, event.state?.returnState);
      return;
    }
    if (safeScreen === 'feed') {
      const restore = state.screen === 'detail' && state.detailReturn ? state.detailReturn : event.state || {};
      state.view = restore.view || hashParts[0] || 'home';
      state.eventStatus = restore.eventStatus || hashParts[1] || 'upcoming';
      restoreListing(restore);
      $('#explore-region').value = restore.filterRegion || 'all';
      $('#explore-category').value = restore.filterCategory || 'all';
      if (restore.sort) state.sort = restore.sort;
      setView(state.view, false);
      setEventStatus(state.eventStatus, false);
      state.sort = restore.sort || state.sort;
      syncSortOptions();
      renderEvents();
      setScreen('feed', false);
      requestAnimationFrame(() => window.scrollTo(0, restore.scrollY ?? 0));
      return;
    }
    setScreen(safeScreen, false);
  });

  function button(type, label, attributes = {}) {
    const element = document.createElement('button');
    element.type = type || 'button';
    element.textContent = t(label);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }
  function renderDistricts() {
    $$('.district-node').forEach(node => {
      node.addEventListener('click', () => toggleValue('regions', node.dataset.district));
    });
    renderDistrictSummary();
  }
  function makeChip(name, removeCallback) {
    const chip = document.createElement('span'); chip.className = 'selection-chip';
    const text = document.createElement('span'); text.textContent = t(name); chip.append(text);
    if (removeCallback) {
      const remove = button('button', '×', { 'aria-label': `${t(name)} ${t('선택 해제')}` });
      remove.addEventListener('click', removeCallback); chip.append(remove);
    }
    return chip;
  }
  function renderDistrictSummary() {
    $$('.district-node').forEach(option => option.setAttribute('aria-pressed', String(state.regions.includes(option.dataset.district))));
    const chips = $('#district-chips'); chips.replaceChildren();
    state.regions.forEach(name => chips.append(makeChip(name, () => toggleValue('regions', name))));
    $('#district-count').textContent = String(state.regions.length);
    $('#district-next').disabled = state.regions.length === 0;
    renderFeedPreferences();
  }
  function renderInterests() {
    const grid = $('#interest-grid'); grid.replaceChildren();
    CATEGORIES.forEach(({ name, icon }) => {
      const card = button('button', '', { class: 'interest-card', 'aria-pressed': String(state.categories.includes(name)), 'aria-label': `${t(name)} ${t('선택')}` });
      const iconBox = document.createElement('span'); iconBox.className = 'interest-icon'; iconBox.setAttribute('aria-hidden', 'true');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24');
      ICON_PATHS[icon].forEach(pathData => { const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', pathData); svg.append(path); });
      iconBox.append(svg);
      card.dataset.category = name;
      const title = document.createElement('span'); title.className = 'interest-name'; title.textContent = t(name);
      const check = document.createElement('span'); check.className = 'interest-check'; check.setAttribute('aria-hidden', 'true'); check.textContent = '✓';
      card.append(iconBox, title, check);
      card.addEventListener('click', () => toggleValue('categories', name));
      grid.append(card);
    });
    renderInterestSummary();
  }
  const choices = {'문화·예술':['댄스','공연·연극','음악','미술·전시','공예·도예','생활문화'], '교육·강좌':['코딩·IT','요리','외국어','자격증'], '축제·행사':['지역 축제'], '독서·도서관':['독서 모임','도서관 프로그램']};
  let interests = {};
  try { interests = JSON.parse(localStorage.getItem('moallim.details')) || {}; } catch {}
  function renderChoices() {
    const panel = $('#subchoices');
    panel.replaceChildren();
    for (const category of state.categories) {
      if (!choices[category]) continue;
      const row = document.createElement('div');
      row.className = 'interest-selection';
      const label = document.createElement('strong');
      label.textContent = t(category);
      const group = document.createElement('div');
      group.className = 'chip-list';
      const selected = interests[category] || [];
      for (const option of ['전체', ...choices[category]]) {
        const active = option === '전체' ? !selected.length : selected.includes(option);
        const chip = button('button', (active ? '✓ ' : '') + t(option), {class:'selection-chip', 'aria-pressed':String(active)});
        chip.onclick = () => {
          interests[category] = option === '전체' ? [] : active ? selected.filter(v => v !== option) : [...selected, option];
          save('moallim.details', interests);
          renderChoices();
        };
        group.append(chip);
      }
      row.append(label, group); panel.append(row);
    }
  }
  function renderInterestSummary() {
    renderChoices();
    $$('.interest-card').forEach(card => card.setAttribute('aria-pressed', String(state.categories.includes(card.dataset.category))));
    $('#interest-count').textContent = t('{n}개 선택', state.categories.length);
    $('#interest-summary').textContent = state.categories.length ? state.categories.map(name => t(name)).join(' · ') : t('아직 선택한 분야가 없어요');
    $('#finish-button').disabled = state.categories.length === 0;
    renderFeedPreferences();
  }
  function toggleValue(key, value) {
    const current = state[key];
    state[key] = current.includes(value) ? current.filter(item => item !== value) : [...current, value];
    save(STORAGE[key], state[key]);
    if (key === 'regions') renderDistrictSummary(); else renderInterestSummary();
    if (state.screen === 'feed') renderEvents();
  }
  function renderFeedPreferences() {
    const districtChips = $('#feed-district-chips'); const categoryChips = $('#feed-interest-chips');
    if (!districtChips || !categoryChips) return;
    districtChips.textContent = state.regions.map(name => t(name)).join(' · ');
    categoryChips.textContent = state.categories.flatMap(name => interests[name]?.length ? interests[name].map(sub => t(sub)) : [t(name) + ' · ' + t('전체')]).join(' · ');

  }
  function populateFilters() {
    const regions = $('#explore-region'); const categories = $('#explore-category');
    DISTRICTS.forEach(name => { const option = document.createElement('option'); option.value = name; option.textContent = t(name); regions.append(option); });
    CATEGORIES.forEach(({ name }) => { const option = document.createElement('option'); option.value = name; option.textContent = t(name); categories.append(option); });
  }
  async function loadEvents() {
    try {
      let data;
      if (location.protocol === 'file:') {
        data = window.moallimOfflineEvents;
      } else {
        const response = await fetch('./events.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('행사 목록을 읽을 수 없습니다.');
        data = await response.json();
      }
      if (!Array.isArray(data)) throw new Error('events.json must contain an array');
      state.events = data.filter(isValidEvent);
      state.dataError = false;
      scheduleStatusRefresh();
    } catch (error) {
      console.error('모알림 행사 데이터를 불러오지 못했습니다.', error);
      state.events = [];
      state.dataError = true;
    }
    renderEvents();
  }
  function isValidEvent(event) {
    return Boolean(event && typeof event.id === 'string' && typeof event.title === 'string' && Array.isArray(event.categories) && Array.isArray(event.regions));
  }
  function parseDate(value) {
    if (!value || typeof value !== 'string') return null;
    let normalized = value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) normalized = `${value}T00:00:00+09:00`;
    else if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) normalized = `${value}+09:00`;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function eventStatus(event, now = Date.now()) {
    const start = parseDate(event.startDate);
    const end = parseDate(event.endDate) || (start && new Date(start.toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'}) + 'T23:59:59.999+09:00'));
    if (!start || !end) return null;
    if (now < start.getTime()) return 'upcoming';
    if (now < end.getTime() + (event.endDate?.length === 10 ? 86400000 : 0)) return 'ongoing';
    return 'past';
  }
  function isVisibleEvent(event) {
    return !['unpublished', 'draft', 'cancelled'].includes(event.status) && Boolean(eventStatus(event));
  }
  function scheduleStatusRefresh() {
    clearTimeout(state.statusTimer);
    const now = Date.now();
    const boundaries = state.events.flatMap(event => [parseDate(event.startDate), parseDate(event.endDate), parseDate(event.registrationStart), registrationDeadline(event)])
      .filter(date => date && date.getTime() > now)
      .map(date => date.getTime());
    boundaries.push((seoulDay(now) + 1) * 86400000 - 9 * 3600000);
    const delay = Math.min(Math.min(...boundaries) - now + 250, 2147483000);
    state.statusTimer = setTimeout(() => {
      renderEvents();
      if (state.screen === 'detail') {
        const selected = state.events.find(event => event.id === state.selectedEventId);
        if (selected) renderDetail(selected);
      }
      scheduleStatusRefresh();
    }, Math.max(250, delay));
  }
  function matchesPreferences(event) {
    if (!state.regions.length || !state.categories.length) return false;
    const regionMatch = event.scope === 'citywide' || event.regions.includes('남양주시 전체') || event.regions.some(region => state.regions.includes(region));
    const categoryMatch = event.categories.some(category => state.categories.includes(category) && (!interests[category]?.length || interests[category].some(value => event.subcategories?.[category]?.includes(value))));
    return regionMatch && categoryMatch;
  }
  function matchingEvents() {
    let events = state.events.filter(isVisibleEvent);
    const browsing = state.view === 'explore' && state.categoryResults;
    events = events.filter(event => browsing ? eventStatus(event) !== 'past' : eventStatus(event) === state.eventStatus);
    if (state.view === 'home') events = events.filter(matchesPreferences);
    if (state.view === 'saved') events = events.filter(event => state.bookmarks.includes(event.id));
    if (state.view === 'explore') {
      const region = $('#explore-region').value;
      const category = $('#explore-category').value;
      if (region !== 'all') events = events.filter(event => event.scope === 'citywide' || event.regions.includes('남양주시 전체') || event.regions.includes(region));
      if (browsing && state.subcategory) events = events.filter(event => event.subcategories?.[category]?.includes(state.subcategory));
      if (category !== 'all') events = events.filter(event => event.categories.includes(category));
    }
    return events.sort((a, b) => {
      if (state.view === 'home' && state.eventStatus === 'upcoming') {
        const priority = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
        if (priority) return priority;
      }
      const dateField = browsing || state.eventStatus === 'upcoming' ? 'startDate' : 'endDate';
      const first = parseDate(a[dateField])?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const second = parseDate(b[dateField])?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return state.sort === 'latest' ? second - first : first - second;
    });
  }
  function formatDate(value, mode = 'event') {
    const date = parseDate(value); if (!date) return t('일정 미정');
    const dateText = new Intl.DateTimeFormat(language, { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(date);
    if (mode === 'date' || value.length === 10) return dateText;
    const timeText = new Intl.DateTimeFormat(language, { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit', hour12: language === 'ko' || language === 'en' }).format(date);
    return `${dateText} · ${timeText}`;
  }
  function participantLabel(event) {
    const current = event.applicationCount ?? event.participantCount;
    const maximum = Number(event.maxParticipants);
    return Number.isFinite(current) && Number.isFinite(maximum) && current >= 0 && maximum > 0
      ? t(event.applicationCount != null ? '신청 {n}명' : '{n}명', current + '/' + maximum)
      : '';
  }
  function renderCalendar(events) {
    const selected = new Date(state.calendarDay * 86400000);
    const year = selected.getUTCFullYear();
    const month = selected.getUTCMonth();
    const first = new Date(Date.UTC(year, month, 1));
    const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const grid = $('#calendar-days');
    grid.replaceChildren();
    const weekdays = '일월화수목금토';
    for (const label of weekdays) {
      const header = document.createElement('span');
      header.textContent = language === 'ko' ? label : new Intl.DateTimeFormat(language, { weekday:'short', timeZone:'UTC' }).format(Date.UTC(2026, 10, 1 + weekdays.indexOf(label)));
      grid.append(header);
    }
    for (let i = 0; i < first.getUTCDay(); i++) grid.append(document.createElement('span'));
    $('#calendar-month').textContent = new Intl.DateTimeFormat(language, {year:'numeric', month:'long', timeZone:'UTC'}).format(first);
    const byDay = new Map();
    for (const event of events) {
      const start = seoulDay(parseDate(event.startDate).getTime());
      const end = parseDate(event.endDate);
      let last = end ? seoulDay(end.getTime()) : start;
      // A timed event ending at midnight does not occupy the following day.
      if (end && event.endDate.length > 10 && last > start) last = seoulDay(end.getTime() - 1);
      const weekly = /^([일월화수목금토](?:·[일월화수목금토])*)(?:요일)?\s+\d/.exec(event.schedule || '');
      const monthStart = first.getTime() / 86400000;
      for (let day = Math.max(monthStart, start); day <= Math.min(monthStart + days - 1, last); day++) {
        if (weekly && !weekly[1].includes(weekdays[(day + 4) % 7])) continue;
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day).push(event);
      }
    }
    for (let number = 1; number <= days; number++) {
      const day = first.getTime() / 86400000 + number - 1;
      const count = byDay.get(day)?.length || 0;
      const label = new Intl.DateTimeFormat(language, {month:'long', day:'numeric', timeZone:'UTC'}).format(day * 86400000);
      const cell = button('button', String(number), {
        class: 'calendar-day' + (count ? ' has-events' : ''),
        'aria-label': label + ', ' + t('{n}개', count),
        'aria-pressed': String(day === state.calendarDay)
      });
      cell.onclick = () => {
        selectCalendarDay(day);
        $('#calendar-days button[aria-pressed="true"]')?.focus();
      };
      grid.append(cell);
    }
    $('#calendar-date').textContent = new Intl.DateTimeFormat(language, {month:'long', day:'numeric', timeZone:'UTC'}).format(selected) + ' · ' + t('행사');
    return byDay.get(state.calendarDay) || [];
  }

  function rememberFeed() {
    history.replaceState({ screen: 'feed', ...feedHistoryState() }, '');
  }
  function selectCalendarDay(day) {
    state.calendarDay = day;
    rememberFeed();
    renderEvents();
  }
  function setCalendarMode(enabled) {
    state.calendar = enabled;
    rememberFeed();
    renderEvents();
  }
  function moveMonth(offset) {
    const date = new Date(state.calendarDay * 86400000);
    selectCalendarDay(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1) / 86400000);
  }

  function browseCategory(category, subcategory = '') {
    if (state.screen === 'feed') history.replaceState({ screen: 'feed', ...feedHistoryState() }, '');
    $('#explore-category').value = category;
    $('#explore-region').value = 'all';
    state.categoryResults = true;
    state.subcategory = subcategory;
    setScreen('feed', false);
    setView('explore');
  }

  function renderDirectory() {
    const directory = $('#category-directory');
    directory.replaceChildren();
    const normalize = value => value.replace(/[\s·]/g, '').toLowerCase();
    const query = normalize($('#category-query').value || '');
    for (const { name } of CATEGORIES) {
      const subs = choices[name] || [];
      const matchesQuery = value => [value, t(value)].some(label => normalize(label).includes(query));
      const mainMatch = matchesQuery(name);
      const matches = mainMatch ? subs : subs.filter(matchesQuery);
      if (!mainMatch && !matches.length) continue;
      const group = document.createElement('details');
      group.open = Boolean(query);
      const heading = document.createElement('summary');
      heading.textContent = t(name);
      group.append(heading);
      for (const sub of ['', ...matches]) {
        const link = button('button', sub || '전체 행사 보기', { class: 'text-button' });
        link.onclick = () => browseCategory(name, sub);
        group.append(link);
      }
      directory.append(group);
    }
    if (!directory.childElementCount) directory.textContent = t('검색 결과가 없어요.');
  }

  function renderEvents() {
    if (!$('#event-list')) return;
    const list = $('#event-list'); list.replaceChildren();
    const calendar = state.view === 'home' && state.calendar;
    $('#calendar-panel').hidden = !calendar || state.dataError;
    $('#list-mode').setAttribute('aria-pressed', String(!calendar));
    $('#calendar-mode').setAttribute('aria-pressed', String(calendar));
    const matches = matchingEvents();
    const events = calendar ? renderCalendar(matches) : matches;
    const viewCopy = {
      home: ['YOUR PICKS', '추천 행사'],
      explore: ['LOCAL EVENTS', $('#explore-category').value === 'all' ? '모든 행사 보기' : (t($('#explore-category').value) + (state.categoryResults && state.subcategory ? ' · ' + t(state.subcategory) : language === 'ko' ? ' 전체 행사' : ' · ' + t('행사')))],
      saved: ['BOOKMARKED', '저장한 행사']
    }[state.view];
    const heading = $('#events-title');
    heading.textContent = t(viewCopy[1]);
    heading.classList.toggle('picks-heading', state.view === 'home');
    $('#event-count').textContent = t('{n}개', events.length);
    $('#saved-bottom-count').textContent = String(state.bookmarks.length);
    $('#saved-bottom-count').hidden = state.bookmarks.length === 0;
    if (state.dataError) {
      list.append(emptyState('행사 정보를 불러오지 못했어요', '잠시 후 다시 시도해 주세요.', '다시 시도', loadEvents));
      return;
    }
    if (!events.length) {
      let heading; let description; let action;
      if (calendar) {
        heading = '이 날짜에는 맞춤 행사가 없어요.'; description = '다른 날짜를 선택해 보세요.';
      } else if (state.view === 'saved') {
        heading = '아직 저장한 행사가 없어요'; description = '마음에 드는 행사의 북마크를 눌러 다시 볼 수 있도록 담아두세요.';
      } else if (state.view === 'home') {
        heading = '아직 조건에 맞는 행사가 없어요.'; description = '관심 지역이나 분야를 조금 넓히면 새로운 소식을 만날 수 있어요.'; action = '관심 설정 바꾸기';
      } else {
        heading = '조건에 맞는 예시가 없어요'; description = '다른 지역이나 분야를 선택해 다시 살펴보세요.';
      }
      list.append(emptyState(heading, description, action, action ? editPreferences : null));
      return;
    }
    events.forEach(event => list.append(createEventCard(event)));
  }
  function emptyState(heading, description, actionLabel, onAction) {
    const wrap = document.createElement('div'); wrap.className = 'empty-state';
    const visual = document.createElement('div'); visual.className = 'empty-visual'; visual.setAttribute('aria-hidden', 'true'); visual.textContent = state.view === 'saved' ? '♡' : '⌖';
    const title = document.createElement('h3'); title.textContent = t(heading);
    const copy = document.createElement('p'); copy.textContent = t(description);
    wrap.append(visual, title, copy);
    if (actionLabel && onAction) { const action = button('button', actionLabel, { class: 'button button-primary' }); action.addEventListener('click', onAction); wrap.append(action); }
    return wrap;
  }
  function createEventCard(event) {
    const article = document.createElement('article'); article.className = 'event-card listing-row';
    article.tabIndex = 0;
    article.setAttribute('aria-label', `${t(event.title)} · ${t('상세 보기')}`);
    article.addEventListener('click', clickEvent => {
      if (clickEvent.target.closest('button, a, select')) return;
      openDetails(event);
    });
    article.addEventListener('keydown', keyEvent => {
      if (keyEvent.target !== article || !['Enter', ' '].includes(keyEvent.key)) return;
      keyEvent.preventDefault();
      openDetails(event);
    });
    const top = document.createElement('div'); top.className = 'event-card-top';
    const category = document.createElement('span'); category.className = 'event-category'; category.textContent = [...event.categories, ...Object.values(event.subcategories || {}).flat()].map(name => t(name)).join(' · ');
    const region = document.createElement('span'); region.className = 'event-region'; region.textContent = event.scope === 'citywide' || event.regions.includes('남양주시 전체') ? t('남양주시 전체') : event.regions.map(name => t(name)).join(' · ');
    const bookmark = button('button', state.bookmarks.includes(event.id) ? '♥' : '♡', { class: 'bookmark-button', 'aria-pressed': String(state.bookmarks.includes(event.id)), 'aria-label': `${t(event.title)} · ${t(state.bookmarks.includes(event.id) ? '저장 해제' : '저장')}` });
    bookmark.addEventListener('click', eventObj => { eventObj.stopPropagation(); toggleBookmark(event.id); });
    top.append(category);
    const titleButton = button('button', event.title, { class: 'card-open', 'aria-label': `${t(event.title)} · ${t('상세 보기')}` });
    titleButton.style.cssText = 'border:0;background:transparent;padding:0;text-align:left;cursor:pointer;font:inherit';
    titleButton.addEventListener('click', () => openDetails(event));
    const title = document.createElement('h3'); title.className = 'event-title'; title.append(titleButton);

    const meta = document.createElement('div'); meta.className = 'event-meta-row';
    if (event.schedule && event.startDate?.length === 10) addMeta(meta, '◷', event.schedule);
    addMeta(meta, event.schedule && event.startDate?.length === 10 ? '' : '◷', event.startDate ? `${formatDate(event.startDate)}${event.endDate && formatDate(event.startDate, 'date') !== formatDate(event.endDate, 'date') ? ` – ${formatDate(event.endDate, 'date')}` : ''}` : '일정 미정');
    
    meta.append(region);
    const footer = document.createElement('div');
    footer.className = 'listing-facts';
    const free = event.fee === 0 || event.fee === '무료';
    const paid = typeof event.fee === 'number' ? event.fee > 0 : /[1-9][0-9,]*\s*원|유료/.test(event.fee || '');
    const facts = [participantLabel(event), free ? '무료' : paid ? '유료' : '', event.originalStartDate && state.view !== 'explore' ? '예시 일정' : ''];
    footer.textContent = facts.filter(Boolean).map(value => t(value)).join(' · ');
    const status = registrationStatusText(event);
    if (status) {
      const label = document.createElement('span');
      label.className = 'event-status';
      label.textContent = status;
      top.append(label);
    }
    const more = button('button','같은 분야 더 보기 →',{class:'text-button'});
    more.onclick = () => browseCategory(event.categories[0]);

    const body = document.createElement('div');
    body.className = 'listing-body';
    body.append(top, title, meta);
    if (state.view === 'explore' && event.previewNote) {
      const preview = document.createElement('div');
      preview.className = 'event-meta-row';
      preview.textContent = t(event.previewNote);
      body.append(preview);
    }
    const actions = document.createElement('div');
    actions.className = 'listing-actions';
    actions.append(more, bookmark);
    article.append(body, footer, actions);
    return article;
  }
  function addMeta(parent, iconText, value) {
    const item = document.createElement('span'); item.className = 'event-meta-item';
    const icon = document.createElement('span'); icon.className = 'meta-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = iconText;
    const text = document.createElement('span'); text.textContent = t(value);
    item.append(icon, text); parent.append(item);
  }
  function isValidHttpUrl(value) {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol); }
    catch (_) { return false; }
  }
  function toggleBookmark(id) {
    state.bookmarks = state.bookmarks.includes(id) ? state.bookmarks.filter(item => item !== id) : [...state.bookmarks, id];
    save(STORAGE.bookmarks, state.bookmarks); renderEvents();
    if (state.screen === 'detail') {
      const selected = state.events.find(event => event.id === state.selectedEventId);
      if (selected) renderDetail(selected);
    }
    toast(state.bookmarks.includes(id) ? '저장한 행사에 담았어요.' : '저장을 해제했어요.');
  }
  const DETAIL_ICON_PATHS = {
    calendar: ['M7 3v3', 'M17 3v3', 'M4 8h16', 'M5 5h14v15H5z'],
    location: ['M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0z', 'M12 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
    people: ['M16 20v-1.5a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4V20', 'M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M16 4.3a3.5 3.5 0 0 1 0 6.8', 'M20 20v-1.5a4 4 0 0 0-2.8-3.8'],
    won: ['M6 8h12', 'M6 12h12', 'M9 5 7 19', 'M17 5l-2 14', 'M7 16h11'],
    clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
    organizer: ['M4 20h16', 'M6 20V8l6-4 6 4v12', 'M9 10h1', 'M14 10h1', 'M10 20v-5h4v5']
  };
  function detailFact(parent, iconName, label, value) {
    if (value === null || value === undefined || value === '') return;
    const row = document.createElement('div'); row.className = `detail-fact${iconName ? '' : ' detail-fact-no-icon'}`;
    if (iconName) {
      const iconBox = document.createElement('span'); iconBox.className = 'detail-fact-icon'; iconBox.setAttribute('aria-hidden', 'true');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24');
      (DETAIL_ICON_PATHS[iconName] || DETAIL_ICON_PATHS.calendar).forEach(pathData => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', pathData); svg.append(path);
      });
      iconBox.append(svg); row.append(iconBox);
    }
    const name = document.createElement('span'); name.className = 'detail-fact-label'; name.textContent = t(label);
    const data = document.createElement('span'); data.className = 'detail-fact-value'; data.textContent = t(value);
    row.append(name, data); parent.append(row);
  }
  function formatEventRange(event) {
    const start = event.startDate ? formatDate(event.startDate) : '';
    const end = event.endDate ? formatDate(event.endDate) : '';
    if (start && end) return `${start} – ${end}`;
    return start || end;
  }
  // Korea uses UTC+9 throughout the year. Count calendar days, not 24-hour intervals.
  function seoulDay(time) {
    return Math.floor((time + 9 * 3600000) / 86400000);
  }
  function registrationDeadline(event) {
    if (event.registrationEnd?.length === 10) return parseDate(event.registrationEnd + 'T23:59:59.999+09:00');
    return parseDate(event.registrationEnd);
  }
  function registrationStatusText(event) {
    const now = Date.now();
    const start = parseDate(event.registrationStart)?.getTime();
    const end = registrationDeadline(event)?.getTime();
    if ((end && now >= end) || event.registrationStatus === '모집 마감') return t('모집 마감');
    if (start && now < start) return t('접수 예정');
    if (end) {
      const days = seoulDay(end) - seoulDay(now);
      return days === 0 ? t('접수 마감 D-Day') : t('접수 마감 D-{n}', days);
    }
    if (event.registrationStatus) return event.registrationStatus;
    return '';
  }
  function renderDetail(event) {
    state.selectedEventId = event.id;
    $('#detail-category').textContent = t(event.categories?.[0] || '지역 행사');
    $('#detail-title').textContent = t(event.title);
    $('#detail-region').textContent = event.scope === 'citywide' || event.regions.includes('남양주시 전체') ? t('남양주시 전체') : event.regions.map(name => t(name)).join(' · ');
    const status = eventStatus(event);
    const statusLabel = { upcoming: '예정', ongoing: '진행 중', past: '종료' }[status] || '';
    const statusElement = $('#detail-status'); statusElement.textContent = t(statusLabel);
    statusElement.className = `detail-status${status === 'ongoing' ? ' status-ongoing' : status === 'past' ? ' status-past' : ''}`;
    const demo = Boolean(event.isDemo || event.status === 'demo');
    $('#detail-demo-note').hidden = !demo;
    const factList = $('#detail-facts'); factList.replaceChildren();
    detailFact(factList, 'calendar', event.originalStartDate ? '예시 일정' : '행사 일정', formatEventRange(event));
    if (event.originalStartDate) detailFact(factList,'calendar','실제 행사일',formatDate(event.originalStartDate));
    detailFact(factList,'clock','운영 시간',event.schedule);
    detailFact(factList,'people','출연자',event.performers);
    detailFact(factList,'organizer','문의',event.contact);
    detailFact(factList,'clock','예매 안내',event.bookingInfo);
    detailFact(factList, 'location', '행사 장소', event.location);
    detailFact(factList, 'location', '주소', event.address);
    detailFact(factList, 'organizer', '주최·주관', event.organizer);
    detailFact(factList, 'people', '참가 대상', event.targetAudience);
    const feeText = event.fee === 0 ? '무료' : typeof event.fee === 'number' ? new Intl.NumberFormat(language, { style:'currency', currency:'KRW', maximumFractionDigits:0 }).format(event.fee) : event.fee;
    detailFact(factList, 'won', event.performers ? '관람료' : '참가비', feeText);
    if (event.registrationStart || event.registrationEnd) {
      const regStart = event.registrationStart ? formatDate(event.registrationStart) : '시작일 미정';
      const regEnd = event.registrationEnd ? formatDate(event.registrationEnd) : '마감일 미정';
      detailFact(factList, 'clock', '신청 기간', `${regStart} – ${regEnd}`);
    }
    const registrationStatus = registrationStatusText(event);
    if (registrationStatus) detailFact(factList, 'clock', '신청 상태', registrationStatus);
    const participants = participantLabel(event);
    if (participants) detailFact(factList, null, event.applicationCount != null ? '신청 현황' : '참가 인원', participants);
    $('#detail-description-section h3').textContent = t(event.performers ? '공연 소개' : '행사 소개');
    $('#detail-description').textContent = t(event.description || '');
    $('#detail-description-section').hidden = !event.description;
    const action = $('#detail-action'); action.replaceChildren();
    const externalUrl = event.registrationUrl && isValidHttpUrl(event.registrationUrl)
      ? event.registrationUrl
      : event.sourceUrl && isValidHttpUrl(event.sourceUrl) ? event.sourceUrl : null;
    if (externalUrl && event.isVerified) {
      const link = document.createElement('a'); link.href = externalUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = t(event.registrationUrl ? '신청 페이지로 이동' : '공식 안내 확인하기');
      action.append(link);
      if (isValidHttpUrl(event.bookingGuideUrl)) {
        const guide = link.cloneNode(false);
        guide.href = event.bookingGuideUrl;
        guide.textContent = t('문화재단 예매 안내');
        action.append(guide);
      }
    } else if (!demo) {
      const message = document.createElement('span'); message.className = 'detail-no-link';
      message.textContent = t('공식 안내가 등록되지 않았어요.');
      action.append(message);
    }
    const bookmark = $('#detail-bookmark');
    const saved = state.bookmarks.includes(event.id);
    bookmark.textContent = saved ? '♥' : '♡';
    bookmark.setAttribute('aria-pressed', String(saved));
    bookmark.setAttribute('aria-label', t(saved ? '저장 해제' : '행사 저장'));
  }
  function openDetails(event) {
    state.detailReturn = feedHistoryState();
    renderDetail(event);
    setScreen('detail');
  }
  function openDetailsById(id, push = false, returnState = null) {
    const event = state.events.find(item => item.id === id);
    if (!event) return;
    if (returnState) state.detailReturn = returnState;
    renderDetail(event);
    setScreen('detail', push);
  }
  function restoreDetailReturn() {
    const snapshot = state.detailReturn;
    if (snapshot) {
      state.view = snapshot.view || 'home';
      state.eventStatus = snapshot.eventStatus || 'upcoming';
      state.sort = snapshot.sort || (state.eventStatus === 'past' ? 'latest' : 'soonest');
      restoreListing(snapshot);
      $('#explore-region').value = snapshot.filterRegion || 'all';
      $('#explore-category').value = snapshot.filterCategory || 'all';
      setView(state.view, false);
      setEventStatus(state.eventStatus, false);
      state.sort = snapshot.sort || state.sort;
      syncSortOptions();
      setScreen('feed', false);
      requestAnimationFrame(() => window.scrollTo(0, snapshot.scrollY || 0));
    } else {
      setScreen('feed', false);
    }
  }
  function toast(message) {
    const element = $('#toast'); element.textContent = t(message); element.classList.add('is-visible');
    clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => element.classList.remove('is-visible'), 2100);
  }
  function editPreferences() {
    setScreen('districts');
  }

  $('#calendar-mode').onclick = () => setCalendarMode(true);
  $('#list-mode').onclick = () => setCalendarMode(false);
  $('#prev-month').onclick = () => moveMonth(-1);
  $('#next-month').onclick = () => moveMonth(1);
  $('#category-search').onclick = () => {
    history.replaceState({ screen: 'feed', ...feedHistoryState() }, '');
    $('#category-query').value = '';
    renderDirectory();
    setScreen('discovery');
    $('#category-query').focus();
  };
  $('#discovery-back').onclick = $('#results-back').onclick = () => history.back();
  $('#category-query').oninput = renderDirectory;
  $('#start-button').addEventListener('click', () => setScreen('districts'));
  $('[data-action="go-welcome"]').addEventListener('click', () => setScreen('welcome'));
  $('[data-action="go-districts"]').addEventListener('click', () => setScreen('districts'));
  $('#district-next').addEventListener('click', () => { if (state.regions.length) setScreen('interests'); });
  $('#finish-button').addEventListener('click', () => {
    if (!state.categories.length) return;
    renderFeedPreferences(); setScreen('feed'); setView('home', false); renderEvents();
  });
  $('#edit-preferences').addEventListener('click', editPreferences);
  $('#edit-preferences-top').addEventListener('click', editPreferences);
  $$('.view-tab').forEach(item => item.addEventListener('click', () => setEventStatus(item.dataset.status)));
  $$('.bottom-nav-item').forEach(item => item.addEventListener('click', () => { state.categoryResults = false; state.subcategory = ''; setView(item.dataset.view); }));
  $('#event-sort').addEventListener('change', event => { state.sort = event.target.value; renderEvents(); });
  $('#explore-region').addEventListener('change', renderEvents);
  $('#explore-category').addEventListener('change', renderEvents);
  $('#desktop-saved').onclick = () => setView(state.view === 'saved' ? 'home' : 'saved');
  $('#detail-action').addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
        event.shiftKey || event.altKey || window.innerWidth < 761) return;

    const width = 393;
    const height = Math.min(820, window.screen.availHeight - 90);
    const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    const preview = window.open('', '_blank', `popup,width=${width},height=${height},left=${left},top=${top}`);
    if (!preview) return; // Let the original link handle blocked popups.
    preview.opener = null;
    const destination = preview.document.createElement('a');
    destination.href = link.href;
    destination.rel = 'noreferrer noopener';
    preview.document.body.append(destination);
    destination.click();
    event.preventDefault();
  });
  $('#detail-back').addEventListener('click', () => {
    if (history.state?.screen === 'detail') history.back();
    else restoreDetailReturn();
  });
  $('#detail-bookmark').addEventListener('click', () => {
    if (state.selectedEventId) toggleBookmark(state.selectedEventId);
  });
  $$('.brand').forEach(brand => brand.addEventListener('click', event => {
    event.preventDefault();
    if (brand.getAttribute('href') === '#home' && state.screen === 'feed') setView('home');
    else setScreen('welcome');
  }));

  $('#ui-language').addEventListener('change', event => {
    language = event.target.value;
    try { localStorage.setItem('moallim.language', language); } catch {}
    translateTemplate();
    renderDistrictSummary();
    renderInterests();
    for (const option of $$('#explore-category option, #explore-region option')) {
      if (option.value !== 'all') option.textContent = t(option.value);
    }
    setView(state.view, false);
    if (state.screen === 'discovery') renderDirectory();
    if (state.screen === 'detail') renderDetail(state.events.find(item => item.id === state.selectedEventId));
  });
  translateTemplate();
  renderDistricts(); renderInterests(); populateFilters(); renderFeedPreferences(); syncSortOptions();
  if (state.regions.length && state.categories.length) {
    // Keep the welcome screen available on a fresh visit; saved preferences are ready to use immediately.
    // A returning user can reach their personalized feed through the existing start flow.
  }
  loadEvents();
})();
