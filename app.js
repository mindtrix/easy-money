/* Бюджет — интерфейс. Логика расчётов — в logic.js (window.BudgetLogic). */
(function () {
  'use strict';

  var L = window.BudgetLogic;
  var APP_VERSION = '1.0.0';
  var KEY = 'budget.v1';
  var KEY_PREV = 'budget.v1.prev';
  var KEY_EXPORT = 'budget.lastExport';
  var M = L.fmtMoney;

  var ICON = {
    mic: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>',
    gear: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>',
    chev: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    pencil: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    archive: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/></svg>'
  };

  /* ================= хранение ================= */

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return L.migrate(JSON.parse(raw));
    } catch (e) { /* повреждённые данные — начинаем с чистого листа, предыдущая копия остаётся в KEY_PREV */ }
    return L.seedState();
  }

  function save() {
    try {
      var prev = localStorage.getItem(KEY);
      if (prev) localStorage.setItem(KEY_PREV, prev);
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      toast('Не удалось сохранить данные: ' + e.message);
    }
  }

  function getLastExport() {
    try { return +localStorage.getItem(KEY_EXPORT) || 0; } catch (e) { return 0; }
  }

  var state = load();
  var ui = { tab: 'tek', pview: 'current', feedOpen: false, sheet: null, form: {}, flashId: null, scroll: {}, persisted: null, toast: null };
  var toastTimer = null, flashTimer = null, rec = null;

  function roll(announce) {
    var had = !!state.current;
    var n = L.rollPeriods(state, new Date());
    if (n || !had) save();
    if (n && announce) toast(n === 1 ? 'Прошлый период закрыт и ушёл в архив' : 'Закрыто периодов: ' + n + '. Они в архиве');
    return n;
  }

  /* ================= помощники ================= */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cur() { return state.current; }
  function catById(id) { for (var i = 0; i < state.categories.length; i++) if (state.categories[i].id === id) return state.categories[i]; return null; }
  function planPeriod() { return L.nextPeriod(state.current); }
  function srcFor(view) { return view === 'plan' ? state.templates[planPeriod().type] : cur(); }
  function typeQ(type) { return '«' + L.typeName(type) + '»'; }
  function barColor(pct) { return pct >= 1 ? 'var(--bad)' : pct >= 0.75 ? 'var(--warn)' : 'var(--ok)'; }
  function pl(n, a, b, c) { return n + ' ' + L.plural(n, a, b, c); }

  function whenText(ts) {
    var d = new Date(ts), now = new Date();
    var day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var diff = Math.round((today - day) / 86400000);
    var hm = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    if (diff === 0) return 'сегодня, ' + hm;
    if (diff === 1) return 'вчера, ' + hm;
    return d.getDate() + ' ' + L.MONTHS_SHORT[d.getMonth()] + ', ' + hm;
  }

  function dot(color, sm) { return '<i class="dot' + (sm ? ' sm' : '') + '" style="--c:' + esc(color) + '" aria-hidden="true"></i>'; }

  /* ================= экраны ================= */

  function renderTop() {
    return '<header class="top">' +
      '<nav class="seg" aria-label="Разделы">' +
      '<button type="button" data-act="tab" data-tab="tek"' + (ui.tab === 'tek' ? ' aria-current="page"' : '') + '>Текучка</button>' +
      '<button type="button" data-act="tab" data-tab="period"' + (ui.tab === 'period' ? ' aria-current="page"' : '') + '>Период</button>' +
      '</nav>' +
      '<button type="button" class="icon-btn soft" data-act="settings" aria-label="Настройки">' + ICON.gear + '</button>' +
      '</header>';
  }

  function renderTek() {
    var c = cur();
    var t = L.totals(c, state.categories);
    var days = L.daysLeft(c, new Date());
    var h = '<main class="screen screen-tek"><div class="scroll">';

    h += '<section class="hero">' +
      '<div class="hero-row"><span class="hero-period">Период ' + L.periodLabel(c) + '</span>' +
      '<button type="button" class="pill" data-act="tab" data-tab="period">' + L.typeName(c.type) + ' · ещё ' + pl(days, 'день', 'дня', 'дней') + ICON.chev + '</button></div>';
    if (t.tek > 0) {
      h += '<div class="hero-label">Свободно на текучку</div>' +
        '<div class="hero-num' + (t.freeTek < 0 ? ' neg' : '') + '">' + M(t.freeTek) + '</div>' +
        '<div class="hero-sub">потрачено ' + M(t.spent) + ' из ' + M(t.tek) + '</div>';
    } else {
      h += '<div class="hero-label">Потрачено за период</div>' +
        '<div class="hero-num">' + M(t.spent) + '</div>' +
        '<div class="hero-sub">лимиты текучки пока не заданы</div>';
    }
    h += '</section>';

    if (t.tek === 0 && c.ops.length === 0) {
      h += '<div class="hint-card"><b>С чего начать</b><ol>' +
        '<li>На вкладке «Период» внеси приход, кредиты и обязательные платежи.</li>' +
        '<li>Задай лимиты категорий: кнопка «Лимит» на карточке или «Текучка, лимиты» в периоде.</li>' +
        '<li>Вноси траты тапом по категории или голосом.</li></ol>' +
        '<button type="button" class="text-btn" data-act="tab" data-tab="period">Заполнить период' + ICON.chev + '</button></div>';
    }

    h += '<div class="list-head"><span>Категории</span><span>Осталось</span></div>';
    if (!state.categories.length) {
      h += '<div class="hint-card">Категорий пока нет.<button type="button" class="text-btn" data-act="cat" data-id="">Добавить категорию' + ICON.chev + '</button></div>';
    }
    state.categories.forEach(function (cat) {
      var lim = c.limits[cat.id] || 0;
      var sp = t.spentBy[cat.id] || 0;
      var left = lim - sp;
      var leftHtml = lim
        ? (left < 0 ? '<span class="cat-left neg">' + M(-left) + ' сверх</span>' : '<span class="cat-left">' + M(left) + '</span>')
        : '<span class="cat-left none">без лимита</span>';
      var bar = lim ? '<span class="bar"><span style="width:' + (Math.min(sp / lim, 1) * 100).toFixed(1) + '%;background:' + barColor(sp / lim) + '"></span></span>' : '';
      var sub = lim ? 'потрачено ' + M(sp) + ' из ' + M(lim) : (sp ? 'потрачено ' + M(sp) : 'нажми, чтобы внести трату');
      h += '<div class="card-wrap">' +
        '<button type="button" class="cat-card" style="--c:' + esc(cat.color) + '" data-act="spend" data-id="' + esc(cat.id) + '" aria-label="Внести трату: ' + esc(cat.name) + '">' +
        '<span class="cat-top"><span class="cat-name">' + dot(cat.color) + '<span>' + esc(cat.name) + '</span></span>' + leftHtml + '</span>' +
        bar + '<span class="cat-sub">' + sub + '</span></button>' +
        '<button type="button" class="limit-btn" data-act="limit" data-id="' + esc(cat.id) + '" aria-label="Лимит: ' + esc(cat.name) + '">' + ICON.pencil + 'Лимит</button>' +
        '</div>';
    });
    h += '</div>';

    var ops = c.ops.slice().sort(function (a, b) { return b.ts - a.ts; });
    if (!ui.feedOpen) {
      h += '<div class="feed"><button type="button" class="feed-handle" data-act="feed" aria-label="Показать все операции" aria-expanded="false"><span></span></button>';
      if (ops.length) {
        var o = ops[0], oc = catById(o.cat);
        h += '<button type="button" class="peek' + (o.id === ui.flashId ? ' flash' : '') + '" data-act="feed">' +
          '<span class="op-main"><span class="peek-label">Последняя · ' + whenText(o.ts) + '</span>' +
          '<span class="op-title">' + dot(oc ? oc.color : '#9A9DA3', true) + '<span>' + esc(oc ? oc.name : 'Удалённая категория') + '</span></span></span>' +
          '<span class="op-amt">−' + M(o.amount) + '</span></button>';
      } else {
        h += '<button type="button" class="peek" data-act="feed"><span class="op-when">В этом периоде операций пока нет</span></button>';
      }
      h += '</div>';
    } else {
      h += '<div class="feed-scrim" data-act="feed"></div>' +
        '<div class="feed" role="region" aria-label="Операции периода">' +
        '<button type="button" class="feed-handle" data-act="feed" aria-label="Свернуть" aria-expanded="true"><span></span></button>' +
        '<div class="feed-head"><h2>Операции периода</h2><span class="op-when">' + pl(ops.length, 'операция', 'операции', 'операций') + '</span></div>' +
        '<div class="feed-list">';
      if (!ops.length) h += '<div class="empty">Операций пока нет</div>';
      ops.forEach(function (op) {
        var oc2 = catById(op.cat);
        h += '<button type="button" class="op-row' + (op.id === ui.flashId ? ' flash' : '') + '" data-act="op" data-id="' + esc(op.id) + '">' +
          '<span class="op-main"><span class="op-title">' + dot(oc2 ? oc2.color : '#9A9DA3', true) + '<span>' + esc(oc2 ? oc2.name : 'Удалённая категория') + '</span></span>' +
          '<span class="op-when">' + whenText(op.ts) + (op.src === 'voice' ? ' · голосом' : '') + '</span></span>' +
          '<span class="op-amt">−' + M(op.amount) + '</span></button>';
      });
      h += '</div></div>';
    }

    h += '<div class="actionbar"><button type="button" class="mic-btn" data-act="voice">' + ICON.mic + '<span>Сказать трату</span></button></div>';
    h += '</main>';
    return h;
  }

  function itemRow(it, isPlan) {
    var top = '<span class="item-top"><span class="item-name">' + esc(it.name || 'Без названия') + '</span><span class="item-amt">' + M(it.amount || 0) + '</span></span>';
    if (isPlan) {
      return '<div class="item-row"><button type="button" class="item-main noc" data-act="item" data-view="plan" data-id="' + esc(it.id) + '">' +
        top + (it.note ? '<span class="item-sub">' + esc(it.note) + '</span>' : '') + '</button></div>';
    }
    var paid = it.paid || 0;
    var done = it.amount > 0 && paid >= it.amount;
    var partial = paid > 0 && !done;
    var red = it.group === 'carry' && !done;
    var sub;
    if (done) sub = it.note ? it.note + ' · оплачено' : 'оплачено';
    else if (partial) sub = 'внесено ' + M(paid) + ' · осталось ' + M(it.amount - paid);
    else if (red) sub = 'не оплачено вовремя · ' + (it.note || 'с прошлого периода');
    else sub = it.note || 'не оплачено';
    return '<div class="item-row' + (done ? ' done' : '') + (red ? ' red' : '') + '">' +
      '<button type="button" class="check' + (done ? ' on' : '') + (red ? ' red' : '') + '" role="checkbox" aria-checked="' + done + '" data-act="paid" data-id="' + esc(it.id) + '" aria-label="' + (done ? 'Снять отметку: ' : 'Отметить оплаченным: ') + esc(it.name) + '"><i>' + (done ? ICON.check : '') + '</i></button>' +
      '<button type="button" class="item-main" data-act="item" data-view="current" data-id="' + esc(it.id) + '">' + top +
      '<span class="item-sub">' + esc(sub) + '</span>' +
      (partial ? '<span class="mini-bar"><span style="width:' + Math.min(paid / it.amount * 100, 100).toFixed(1) + '%"></span></span>' : '') +
      '</button></div>';
  }

  function renderPeriod() {
    var c = cur();
    var pp = planPeriod();
    var isPlan = ui.pview === 'plan';
    var src = isPlan ? state.templates[pp.type] : c;
    var t = L.totals(src, state.categories);
    var view = isPlan ? 'plan' : 'current';
    var h = '<main class="screen">';

    h += '<div class="ptabs" role="tablist" aria-label="Период">' +
      '<button type="button" class="ptab" role="tab" aria-selected="' + !isPlan + '" data-act="pview" data-v="current"><b>' + L.periodLabel(c) + '</b><small>' + L.typeName(c.type) + ' · сейчас</small></button>' +
      '<button type="button" class="ptab" role="tab" aria-selected="' + isPlan + '" data-act="pview" data-v="plan"><b>' + L.periodLabel(pp) + '</b><small>' + L.typeName(pp.type) + ' · план</small></button>' +
      '</div><div class="scroll">';

    h += '<section class="summary">' +
      '<button type="button" class="sum-income" data-act="income" data-view="' + view + '">' +
      '<span class="k"><span class="eyebrow">Приход</span><b>' + ((isPlan ? pp.type : c.type) === 'salary' ? 'Зарплата' : 'Аванс') + '</b></span>' +
      (t.income ? '<span class="v">' + M(t.income) + '</span>' : '<span class="v empty-v">внести</span>') + '</button>' +
      '<div class="sep"></div>';
    if (!isPlan && t.carry > 0) h += '<div class="sum-row debt"><span>− Долг с прошлого периода</span><b>' + M(t.carry) + '</b></div>';
    h += '<div class="sum-row"><span>− Кредиты</span><b>' + M(t.credits) + '</b></div>' +
      '<div class="sum-row"><span>− Обязательные</span><b>' + M(t.musts) + '</b></div>' +
      '<button type="button" class="sum-row link" data-act="limits" data-view="' + view + '"><span>− Текучка, лимиты</span><b>' + M(t.tek) + '</b></button>';
    if (!t.income) {
      h += '<div class="result idle"><span>Внеси приход</span><b>нужно ' + M(t.plan + t.tek) + '</b></div>';
    } else if (t.rest >= 0) {
      h += '<div class="result ok"><span>Остаётся</span><b>' + M(t.rest) + '</b></div>';
    } else {
      h += '<div class="result bad"><span>Перерасход</span><b>' + M(-t.rest) + '</b></div>';
    }
    if (!isPlan && t.itemCount) {
      h += '<div class="paid-line"><div class="row"><span>Оплачено ' + t.doneCount + ' из ' + t.itemCount + '</span><span>' + M(t.paid) + ' из ' + M(t.plan) + '</span></div>' +
        '<span class="bar"><span style="width:' + (t.plan ? (t.paid / t.plan * 100).toFixed(1) : 0) + '%;background:var(--accent)"></span></span></div>';
    }
    h += '</section>';

    if (isPlan) {
      h += '<p class="plan-note">План следующего периода. С ним период откроется сам ' + L.parseYmd(pp.start).getDate() + ' ' + L.MONTHS_GEN[L.parseYmd(pp.start).getMonth()] + '. Неоплаченное из текущего добавится отдельно.</p>';
    }

    var groups = [];
    if (!isPlan && src.items.some(function (i) { return i.group === 'carry'; })) groups.push({ g: 'carry', title: 'Перенесено с прошлого периода' });
    groups.push({ g: 'credit', title: 'Кредиты', add: 'Добавить кредит' });
    groups.push({ g: 'must', title: 'Обязательные', add: 'Добавить платёж' });
    groups.forEach(function (gd) {
      var its = src.items.filter(function (i) { return i.group === gd.g; });
      var total = its.reduce(function (a, i) { return a + (i.amount || 0); }, 0);
      h += '<section class="group' + (gd.g === 'carry' ? ' carry' : '') + '">' +
        '<div class="group-head"><span>' + gd.title + '</span><span>' + M(total) + '</span></div><div class="group-box">';
      its.forEach(function (it) { h += itemRow(it, isPlan); });
      if (gd.add) h += '<button type="button" class="add-row" data-act="item-new" data-view="' + view + '" data-group="' + gd.g + '">' + ICON.plus + '<span>' + gd.add + '</span></button>';
      h += '</div></section>';
    });

    if (!isPlan) {
      h += '<button type="button" class="archive-btn" data-act="archive"><span style="display:flex;align-items:center;gap:10px">' + ICON.archive + 'Архив периодов</span><small>' + (state.archive.length ? state.archive.length : 'пока пусто') + '</small></button>';
    }
    h += '</div></main>';
    return h;
  }

  function render() {
    var app = document.getElementById('app');
    var key = ui.tab === 'period' ? 'period-' + ui.pview : 'tek';
    var old = app.querySelector('.scroll');
    if (old && app.dataset.key) ui.scroll[app.dataset.key] = old.scrollTop;
    app.innerHTML = renderTop() + (ui.tab === 'tek' ? renderTek() : renderPeriod());
    app.dataset.key = key;
    document.body.setAttribute('data-tab', ui.tab);
    updateBodyFlags();
    var sc = app.querySelector('.scroll');
    if (sc && ui.scroll[key]) sc.scrollTop = ui.scroll[key];
  }

  /* ================= листы ================= */

  function keypadHtml() {
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'];
    return '<div class="keypad">' + keys.map(function (k) {
      return '<button type="button" data-act="key" data-k="' + k + '" aria-label="' + (k === 'del' ? 'Стереть' : k === ',' ? 'Запятая' : k) + '">' + (k === 'del' ? '⌫' : k) + '</button>';
    }).join('') + '</div>';
  }

  function displayAmount(str) {
    if (!str) return '0 ₽';
    var parts = str.split(',');
    var int = (parts[0] || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return int + (parts.length > 1 ? ',' + parts[1] : '') + ' ₽';
  }

  function checkline(field, label) {
    return '<label class="checkline"><input type="checkbox" data-field="' + field + '"' + (ui.form[field] ? ' checked' : '') + '><span>' + label + '</span></label>';
  }

  function head(title, sub, opts) {
    opts = opts || {};
    return '<div class="sheet-head">' +
      (opts.back ? '<button type="button" class="icon-btn soft" data-act="' + opts.back + '" aria-label="Назад">' + ICON.back + '</button>' : '') +
      '<div style="flex:1;min-width:0"><h2 id="sheet-title">' + title + '</h2>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' +
      '<button type="button" class="icon-btn soft" data-act="close-sheet" aria-label="Закрыть">' + ICON.close + '</button></div>';
  }

  var SHEETS = {
    spend: function (sh) {
      var c = cur(), cat = catById(sh.catId);
      if (!cat) return head('Категория удалена');
      var lim = c.limits[cat.id] || 0;
      var sp = L.totals(c, state.categories).spentBy[cat.id] || 0;
      var sub = lim ? (lim - sp >= 0 ? 'осталось ' + M(lim - sp) : 'уже сверх лимита на ' + M(sp - lim)) : 'лимит не задан';
      return head(dot(cat.color) + esc(cat.name), sub) +
        '<div id="amt" class="amount-display' + (ui.form.amount ? '' : ' zero') + '">' + displayAmount(ui.form.amount) + '</div>' +
        keypadHtml() +
        '<button type="button" class="primary" data-act="spend-save" data-needs-amount' + (L.parseMoney(ui.form.amount) ? '' : ' disabled') + '>Записать трату</button>';
    },

    limit: function (sh) {
      var c = cur(), cat = catById(sh.catId);
      if (!cat) return head('Категория удалена');
      var sp = L.totals(c, state.categories).spentBy[cat.id] || 0;
      return head(dot(cat.color) + 'Лимит: ' + esc(cat.name), 'на период ' + L.periodLabel(c) + ' · потрачено ' + M(sp)) +
        '<div id="amt" class="amount-display' + (ui.form.amount ? '' : ' zero') + '">' + displayAmount(ui.form.amount) + '</div>' +
        keypadHtml() +
        checkline('applyPlan', 'Сохранить и в плане периодов ' + typeQ(c.type)) +
        '<button type="button" class="primary" data-act="limit-save">' + 'Сохранить лимит' + '</button>';
    },

    voice: function () {
      var f = ui.form;
      var listening = f.vstate === 'listening';
      var unsupported = f.vstate === 'unsupported';
      return head('Голосовой ввод') +
        '<div class="voice-top"><button type="button" class="voice-orb' + (listening ? ' listening' : '') + '" data-act="voice-start" aria-label="Говорить"' + (unsupported ? ' disabled' : '') + '>' + ICON.mic + '</button>' +
        '<div class="voice-state"><b>' + (listening ? 'Слушаю…' : unsupported ? 'Голос недоступен' : 'Нажми и скажи') + '</b><small>Категория и сумма: «продукты 500»</small></div></div>' +
        (unsupported ? '<div class="note-box">Этот браузер не распознаёт речь. Впиши фразу вручную — разберу так же.</div>' : '') +
        '<label class="field"><span>Распознанная фраза</span><input id="voice-text" type="text" data-field="text" value="' + esc(f.text || '') + '" placeholder="или впиши вручную" enterkeyhint="done" autocomplete="off"></label>' +
        (f.error ? '<div class="alert" role="alert"><span>' + esc(f.error) + '</span>' + (unsupported ? '' : '<button type="button" class="secondary" data-act="voice-start">Повторить</button>') + '</div>' : '') +
        '<button type="button" class="primary dark" data-act="voice-submit">Записать</button>';
    },

    op: function (sh) {
      var op = findOp(sh.id);
      if (!op) return head('Операция не найдена');
      var chips = state.categories.map(function (cat) {
        var on = ui.form.cat === cat.id;
        return '<button type="button" class="chip" style="--c:' + esc(cat.color) + '" aria-pressed="' + on + '" data-act="op-cat" data-id="' + esc(cat.id) + '">' + dot(cat.color, true) + esc(cat.name) + '</button>';
      }).join('');
      return head('Операция', whenText(op.ts) + (op.src === 'voice' ? ' · внесена голосом' : '')) +
        '<label class="field"><span>Сумма</span><input class="big" type="text" inputmode="decimal" data-field="amount" value="' + esc(ui.form.amount) + '" autocomplete="off"></label>' +
        '<div class="field"><span>Категория</span><div class="chips">' + chips + '</div></div>' +
        '<button type="button" class="primary" data-act="op-save">Сохранить</button>' +
        '<button type="button" class="danger" data-act="op-delete">Удалить операцию</button>';
    },

    income: function (sh) {
      var c = cur();
      var isPlan = sh.view === 'plan';
      var type = isPlan ? planPeriod().type : c.type;
      return head(type === 'salary' ? 'Зарплата' : 'Аванс', isPlan ? 'план периода ' + L.periodLabel(planPeriod()) : 'приход в период ' + L.periodLabel(c)) +
        '<label class="field"><span>Сумма прихода</span><input class="big" type="text" inputmode="decimal" data-field="amount" value="' + esc(ui.form.amount) + '" placeholder="0" autocomplete="off"></label>' +
        (isPlan ? '' : checkline('applyPlan', 'Сохранить и как обычный приход для периодов ' + typeQ(c.type))) +
        '<button type="button" class="primary" data-act="income-save">Сохранить</button>';
    },

    limits: function (sh) {
      var isPlan = sh.view === 'plan';
      var c = cur();
      var rows = state.categories.map(function (cat) {
        return '<div class="limit-line"><label for="lim-' + esc(cat.id) + '">' + dot(cat.color) + '<span>' + esc(cat.name) + '</span></label>' +
          '<input id="lim-' + esc(cat.id) + '" type="text" inputmode="decimal" data-field="lim_' + esc(cat.id) + '" value="' + esc(ui.form['lim_' + cat.id] || '') + '" placeholder="0" autocomplete="off"></div>';
      }).join('');
      return head('Лимиты текучки', isPlan ? 'план периода ' + L.periodLabel(planPeriod()) : 'на период ' + L.periodLabel(c)) +
        (state.categories.length ? '<div class="limits-list">' + rows + '</div>' : '<div class="note-box">Сначала добавь категории в настройках.</div>') +
        (isPlan ? '' : checkline('applyPlan', 'Сохранить и в плане периодов ' + typeQ(c.type))) +
        '<button type="button" class="primary" data-act="limits-save">Сохранить</button>';
    },

    item: function (sh) {
      var isPlan = sh.view === 'plan';
      var c = cur();
      var it = sh.id ? findItem(sh.view, sh.id) : null;
      var group = it ? it.group : sh.group;
      var isCarry = group === 'carry';
      var title = it ? esc(it.name || 'Без названия') : (group === 'credit' ? 'Новый кредит' : 'Новый платёж');
      var sub = isPlan ? 'план периода ' + L.periodLabel(planPeriod()) : 'период ' + L.periodLabel(c);
      var otherT = L.otherType(isPlan ? planPeriod().type : c.type);
      var h = head(title, sub) +
        '<label class="field"><span>Название</span><input type="text" data-field="name" value="' + esc(ui.form.name) + '" placeholder="' + (group === 'credit' ? 'Например, Тбанк' : 'Например, Квартира') + '" autocomplete="off"></label>' +
        '<label class="field"><span>' + (isCarry ? 'Сумма долга' : 'Сумма в плане') + '</span><input class="big" type="text" inputmode="decimal" data-field="amount" value="' + esc(ui.form.amount) + '" placeholder="0" autocomplete="off"></label>' +
        '<label class="field"><span>Примечание</span><input type="text" data-field="note" value="' + esc(ui.form.note) + '" placeholder="дата платежа, ставка, как платить" autocomplete="off"></label>';
      if (!isPlan) {
        h += '<label class="field"><span>Уже оплачено в этом периоде</span><input type="text" inputmode="decimal" data-field="paid" value="' + esc(ui.form.paid) + '" placeholder="0" autocomplete="off"></label>';
        if (!isCarry) h += checkline('applyPlan', it ? 'Изменить и в плане следующих периодов ' + typeQ(c.type) : 'Добавлять в каждый период ' + typeQ(c.type));
      }
      h += '<button type="button" class="primary" data-act="item-save">Сохранить</button>';
      if (it) {
        h += '<div class="row-btns">' +
          (isCarry ? '' : '<button type="button" class="secondary" data-act="item-move">Перенести в период ' + typeQ(otherT) + '</button>') +
          '<button type="button" class="danger" data-act="item-delete">Удалить</button></div>';
      }
      return h;
    },

    settings: function () {
      var last = getLastExport();
      var cats = state.categories.map(function (cat) {
        return '<button type="button" class="list-row" data-act="cat" data-id="' + esc(cat.id) + '">' + dot(cat.color) +
          '<span class="grow"><b>' + esc(cat.name) + '</b><small>' + (cat.aliases ? 'голосом: ' + esc(cat.aliases) : 'слова для голоса не заданы') + '</small></span>' + ICON.chev + '</button>';
      }).join('');
      var canShare = false;
      try { canShare = !!(navigator.canShare && window.File && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] })); } catch (e) { canShare = false; }
      return head('Настройки') +
        '<div class="section-title">Категории текучки</div>' +
        '<div class="list">' + cats +
        '<button type="button" class="list-row" data-act="cat" data-id="">' + ICON.plus + '<span class="grow"><b>Добавить категорию</b></span></button></div>' +
        '<div class="section-title">Данные</div>' +
        '<div class="note-box">Все данные хранятся только на этом телефоне, в браузере. Раз в пару недель сохраняй копию: при очистке данных Chrome они пропадут.<br><br>' +
        'Последняя копия: <b>' + (last ? new Date(last).toLocaleDateString('ru-RU') : 'ещё не было') + '</b><br>' +
        'Защита от автоочистки: <b>' + (ui.persisted === true ? 'включена' : ui.persisted === false ? 'не включена' : 'неизвестно') + '</b></div>' +
        '<div class="row-btns"><button type="button" class="secondary" data-act="export">Сохранить копию</button>' +
        (canShare ? '<button type="button" class="secondary" data-act="share">Отправить копию</button>' : '') + '</div>' +
        '<button type="button" class="secondary" data-act="import">Восстановить из файла</button>' +
        '<div class="section-title">Приложение</div>' +
        '<div class="note-box">Версия ' + APP_VERSION + '. Периоды: с 15-го (после зарплаты) и с 30-го (после аванса), в коротком месяце — с последнего дня. Голос распознаёт Chrome, для этого нужен интернет.</div>' +
        '<button type="button" class="danger" data-act="reset">Удалить все данные</button>';
    },

    cat: function (sh) {
      var isNew = !sh.id;
      var used = !isNew && cur().ops.some(function (o) { return o.cat === sh.id; });
      var sw = L.PALETTE.map(function (col) {
        var on = ui.form.color === col;
        return '<button type="button" class="swatch" style="--c:' + col + '" aria-pressed="' + on + '" aria-label="Цвет ' + col + '" data-act="cat-color" data-c="' + col + '">' + (on ? ICON.check : '') + '</button>';
      }).join('');
      return head(isNew ? 'Новая категория' : 'Категория', '', { back: 'settings' }) +
        '<label class="field"><span>Название</span><input type="text" data-field="name" value="' + esc(ui.form.name) + '" placeholder="Например, Еда в городе" autocomplete="off"></label>' +
        '<label class="field"><span>Слова для голоса, через запятую</span><input type="text" data-field="aliases" value="' + esc(ui.form.aliases) + '" placeholder="кафе, обед, столовая" autocomplete="off"></label>' +
        '<div class="field"><span>Цвет</span><div class="swatches">' + sw + '</div></div>' +
        '<button type="button" class="primary" data-act="cat-save">Сохранить</button>' +
        (isNew ? '' : (used
          ? '<div class="note-box">Удалить нельзя: в текущем периоде есть траты в этой категории. Перенеси их в другую категорию через ленту операций.</div>'
          : '<button type="button" class="danger" data-act="cat-delete">Удалить категорию</button>'));
    },

    archive: function () {
      if (!state.archive.length) {
        return head('Архив периодов') + '<div class="empty">Закрытых периодов пока нет. Период уходит сюда сам, когда начинается следующий.</div>';
      }
      var rows = state.archive.map(function (r, i) {
        var t = L.totals(r, r.categories || state.categories);
        var unpaid = r.items.filter(function (it) { return (it.amount || 0) - (it.paid || 0) > 0; }).length;
        return '<button type="button" class="list-row" data-act="arch" data-i="' + i + '"><span class="grow"><b>' + L.periodLabel(r) + ' · ' + L.typeName(r.type) + '</b>' +
          '<small>приход ' + M(t.income) + ' · текучка ' + M(t.spent) + (t.tek ? ' из ' + M(t.tek) : '') +
          (unpaid ? ' · <span style="color:var(--bad-ink);font-weight:700">не оплачено: ' + unpaid + '</span>' : '') + '</small></span>' + ICON.chev + '</button>';
      }).join('');
      return head('Архив периодов', 'новые сверху') + '<div class="list">' + rows + '</div>';
    },

    arch: function (sh) {
      var r = state.archive[sh.i];
      if (!r) return head('Период не найден', '', { back: 'archive' });
      var cats = r.categories || state.categories;
      var t = L.totals(r, cats);
      var catName = function (id) { for (var i = 0; i < cats.length; i++) if (cats[i].id === id) return cats[i]; return catById(id); };
      var h = head(L.periodLabel(r, true), L.typeName(r.type) + ' · закрыт ' + new Date(r.closedAt).toLocaleDateString('ru-RU'), { back: 'archive' });
      h += '<div>' +
        '<div class="kv"><span>Приход</span><b>' + M(t.income) + '</b></div>' +
        '<div class="kv"><span>Платежи по плану</span><b>' + M(t.plan) + '</b></div>' +
        '<div class="kv"><span>Оплачено</span><b>' + M(t.paid) + '</b></div>' +
        (t.plan - t.paid > 0 ? '<div class="kv bad"><span>Перенесено в следующий период</span><b>' + M(t.plan - t.paid) + '</b></div>' : '') +
        '<div class="kv"><span>Текучка: потрачено</span><b>' + M(t.spent) + (t.tek ? ' из ' + M(t.tek) : '') + '</b></div></div>';
      h += '<div class="section-title">Текучка по категориям</div><div class="list">';
      var ids = Object.keys(t.spentBy);
      if (!ids.length) h += '<div class="empty">Трат не было</div>';
      ids.forEach(function (id) {
        var cat = catName(id), lim = (r.limits || {})[id] || 0;
        h += '<div class="list-row">' + dot(cat ? cat.color : '#9A9DA3') + '<span class="grow"><b>' + esc(cat ? cat.name : 'Удалённая категория') + '</b>' +
          (lim ? '<small>лимит ' + M(lim) + '</small>' : '') + '</span><b>' + M(t.spentBy[id]) + '</b></div>';
      });
      h += '</div><div class="section-title">Платежи</div><div class="list">';
      if (!r.items.length) h += '<div class="empty">Платежей не было</div>';
      r.items.forEach(function (it) {
        var left = (it.amount || 0) - (it.paid || 0);
        h += '<div class="list-row"><span class="grow"><b>' + esc(it.name) + '</b><small' + (left > 0 ? ' style="color:var(--bad-ink);font-weight:700"' : '') + '>' +
          (left > 0 ? 'не оплачено ' + M(left) : 'оплачено') + (it.group === 'carry' ? ' · был долгом' : '') + '</small></span><b>' + M(it.amount || 0) + '</b></div>';
      });
      h += '</div><div class="section-title">Операции</div><div class="list">';
      var ops = (r.ops || []).slice().sort(function (a, b) { return b.ts - a.ts; });
      if (!ops.length) h += '<div class="empty">Операций не было</div>';
      ops.forEach(function (op) {
        var cat = catName(op.cat);
        h += '<div class="list-row">' + dot(cat ? cat.color : '#9A9DA3', true) + '<span class="grow"><b>' + esc(cat ? cat.name : 'Удалённая категория') + '</b><small>' +
          new Date(op.ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</small></span><b>−' + M(op.amount) + '</b></div>';
      });
      return h + '</div>';
    }
  };

  function updateBodyFlags() {
    document.body.classList.toggle('toast-top', !!ui.sheet || (ui.tab === 'tek' && ui.feedOpen));
  }

  function renderSheet() {
    var root = document.getElementById('sheet-root');
    updateBodyFlags();
    if (!ui.sheet) { root.innerHTML = ''; return; }
    var builder = SHEETS[ui.sheet.type];
    root.innerHTML = '<div class="sheet-wrap"><div class="sheet-scrim" data-act="close-sheet"></div>' +
      '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">' + builder(ui.sheet) + '</div></div>';
  }

  function openSheet(type, data, form) {
    if (!ui.sheet) { try { history.pushState({ sheet: 1 }, ''); } catch (e) { /* в превью история может быть недоступна */ } }
    stopVoice();
    ui.sheet = Object.assign({ type: type }, data || {});
    ui.form = form || {};
    renderSheet();
  }

  function closeSheet() {
    stopVoice();
    if (ui.sheet) {
      ui.sheet = null;
      renderSheet();
      try { if (history.state && history.state.sheet) history.back(); } catch (e) { /* ничего */ }
    }
  }

  window.addEventListener('popstate', function () {
    if (ui.sheet) { stopVoice(); ui.sheet = null; renderSheet(); }
  });

  /* ================= уведомления ================= */

  function renderToast() {
    var root = document.getElementById('toast-root');
    if (!ui.toast) { root.innerHTML = ''; return; }
    root.innerHTML = '<div class="toast"><span>' + esc(ui.toast.text) + '</span>' + (ui.toast.undo ? '<button type="button" data-act="undo">Отменить</button>' : '') + '</div>';
  }

  function toast(text, undo) {
    ui.toast = { text: text, undo: undo || null };
    renderToast();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { ui.toast = null; renderToast(); }, undo ? 5000 : 3200);
  }

  /* ================= данные: операции и платежи ================= */

  function findOp(id) { var o = cur().ops; for (var i = 0; i < o.length; i++) if (o[i].id === id) return o[i]; return null; }
  function findItem(view, id) { var it = srcFor(view).items; for (var i = 0; i < it.length; i++) if (it[i].id === id) return it[i]; return null; }

  function addOp(catId, amount, src) {
    roll(true);
    var op = { id: L.uid(), ts: Date.now(), cat: catId, amount: amount, src: src };
    cur().ops.push(op);
    save();
    ui.flashId = op.id;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { ui.flashId = null; if (ui.tab === 'tek') render(); }, 2500);
    var cat = catById(catId);
    toast((cat ? cat.name : '') + ' −' + M(amount), function () {
      cur().ops = cur().ops.filter(function (o) { return o.id !== op.id; });
      save(); render();
    });
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) { /* без вибрации */ }
  }

  function pressKey(k) {
    var a = ui.form.amount || '';
    if (k === 'del') a = a.slice(0, -1);
    else if (k === ',') { if (a.indexOf(',') < 0) a = (a || '0') + ','; }
    else {
      var parts = a.split(',');
      if (parts.length > 1 && parts[1].length >= 2) return;
      if (parts.length === 1 && parts[0].length >= 8) return;
      if (a === '0') a = '';
      a += k;
    }
    ui.form.amount = a;
    var el = document.getElementById('amt');
    if (el) { el.textContent = displayAmount(a); el.classList.toggle('zero', !a); }
    var btn = document.querySelector('[data-needs-amount]');
    if (btn) btn.disabled = !L.parseMoney(a);
  }

  /* ================= голос ================= */

  function voiceErr(code) {
    switch (code) {
      case 'not-allowed':
      case 'service-not-allowed': return 'Нет доступа к микрофону. Разреши его для этого сайта в настройках Chrome.';
      case 'network': return 'Для распознавания нужен интернет. Можно вписать фразу вручную.';
      case 'no-speech': return 'Ничего не услышал. Нажми на микрофон и повтори.';
      case 'audio-capture': return 'Микрофон недоступен.';
      case 'aborted': return '';
      default: return 'Распознавание не сработало (' + code + '). Можно вписать фразу вручную.';
    }
  }

  function stopVoice() {
    if (!rec) return;
    var r = rec;
    rec = null;
    try { r.onresult = null; r.onerror = null; r.onend = null; r.abort(); } catch (e) { /* уже остановлен */ }
  }

  function startVoice() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    ui.form.error = '';
    if (!SR) { ui.form.vstate = 'unsupported'; renderSheet(); return; }
    stopVoice();
    var r;
    try {
      r = new SR();
      r.lang = 'ru-RU';
      r.interimResults = true;
      r.maxAlternatives = 3;
      r.continuous = false;
    } catch (e) { ui.form.vstate = 'unsupported'; renderSheet(); return; }
    rec = r;
    var finals = null;
    ui.form.vstate = 'listening';
    ui.form.text = '';
    renderSheet();
    r.onresult = function (e) {
      var text = '';
      for (var i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      ui.form.text = text;
      var inp = document.getElementById('voice-text');
      if (inp) inp.value = text;
      var last = e.results[e.results.length - 1];
      if (last.isFinal) {
        finals = [];
        for (var j = 0; j < last.length; j++) finals.push(last[j].transcript);
      }
    };
    r.onerror = function (e) {
      ui.form.vstate = 'idle';
      ui.form.error = voiceErr(e.error);
      if (rec === r) rec = null;
      if (ui.sheet && ui.sheet.type === 'voice') renderSheet();
    };
    r.onend = function () {
      var wasListening = ui.form.vstate === 'listening';
      if (rec === r) rec = null;
      if (!ui.sheet || ui.sheet.type !== 'voice') return;
      ui.form.vstate = 'idle';
      if (!wasListening) return;
      var cands = finals && finals.length ? finals : (ui.form.text ? [ui.form.text] : []);
      if (cands.length) submitPhrase(cands);
      else { ui.form.error = 'Ничего не услышал. Нажми на микрофон и повтори.'; renderSheet(); }
    };
    try { r.start(); } catch (e) { ui.form.vstate = 'idle'; ui.form.error = 'Не удалось включить микрофон.'; rec = null; renderSheet(); }
  }

  function submitPhrase(cands) {
    var firstErr = null;
    for (var i = 0; i < cands.length; i++) {
      var res = L.parsePhrase(cands[i], state.categories);
      if (res.catId) {
        closeSheet();
        addOp(res.catId, res.amount, 'voice');
        render();
        return;
      }
      if (!firstErr) firstErr = res.error;
    }
    ui.form.text = cands[0];
    ui.form.error = firstErr;
    renderSheet();
  }

  /* ================= копия данных ================= */

  function backupFile() {
    var name = 'budget-' + L.ymd(new Date()) + '.json';
    var data = JSON.stringify(state, null, 2);
    return { name: name, data: data };
  }

  function doExport() {
    var f = backupFile();
    var blob = new Blob([f.data], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    try { localStorage.setItem(KEY_EXPORT, String(Date.now())); } catch (e) { /* не страшно */ }
    toast('Копия ' + f.name + ' сохранена в «Загрузки»');
    renderSheet();
  }

  function doShare() {
    var f = backupFile();
    var file = new File([f.data], f.name, { type: 'application/json' });
    navigator.share({ files: [file], title: 'Копия бюджета' }).then(function () {
      try { localStorage.setItem(KEY_EXPORT, String(Date.now())); } catch (e) { /* не страшно */ }
      renderSheet();
    }).catch(function () { /* отменили */ });
  }

  document.getElementById('import-file').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var obj;
      try { obj = JSON.parse(reader.result); } catch (err) { toast('Это не файл копии: не читается как JSON'); return; }
      if (!L.looksLikeBackup(obj)) { toast('В файле нет данных бюджета'); return; }
      if (!window.confirm('Заменить все текущие данные данными из файла «' + file.name + '»?')) return;
      state = L.migrate(obj);
      roll(false);
      save();
      closeSheet();
      render();
      toast('Данные восстановлены из файла');
    };
    reader.readAsText(file);
  });

  /* ================= действия ================= */

  function applyTplItem(type, it, fields) {
    var tp = state.templates[type];
    var ti = null;
    if (it.tplId) for (var i = 0; i < tp.items.length; i++) if (tp.items[i].id === it.tplId) ti = tp.items[i];
    if (ti) { ti.name = fields.name; ti.note = fields.note; ti.amount = fields.amount; }
    else {
      var nid = L.uid();
      tp.items.push({ id: nid, group: it.group, name: fields.name, note: fields.note, amount: fields.amount });
      it.tplId = nid;
    }
  }

  function removeTplItem(type, tplId) {
    if (!tplId) return;
    var tp = state.templates[type];
    tp.items = tp.items.filter(function (x) { return x.id !== tplId; });
  }

  var ACTIONS = {
    tab: function (el) { ui.tab = el.dataset.tab; ui.feedOpen = false; render(); },
    pview: function (el) { ui.pview = el.dataset.v; render(); },
    feed: function () { ui.feedOpen = !ui.feedOpen; render(); },
    settings: function () { openSheet('settings'); },
    'close-sheet': function () { closeSheet(); },
    undo: function () { var u = ui.toast && ui.toast.undo; ui.toast = null; renderToast(); if (u) u(); },

    spend: function (el) { openSheet('spend', { catId: el.dataset.id }, { amount: '' }); },
    limit: function (el) {
      var lim = cur().limits[el.dataset.id] || 0;
      openSheet('limit', { catId: el.dataset.id }, { amount: L.moneyToInput(lim), applyPlan: false });
    },
    key: function (el) { pressKey(el.dataset.k); },
    'spend-save': function () {
      var amt = L.parseMoney(ui.form.amount);
      if (!amt) return;
      var catId = ui.sheet.catId;
      closeSheet();
      addOp(catId, amt, 'tap');
      render();
    },
    'limit-save': function () {
      var amt = L.parseMoney(ui.form.amount) || 0;
      var id = ui.sheet.catId, c = cur();
      if (amt) c.limits[id] = amt; else delete c.limits[id];
      if (ui.form.applyPlan) {
        var tl = state.templates[c.type].limits;
        if (amt) tl[id] = amt; else delete tl[id];
      }
      save(); closeSheet(); render();
      toast(amt ? 'Лимит сохранён' : 'Лимит убран');
    },

    voice: function () { openSheet('voice', {}, { text: '', error: '', vstate: 'idle' }); startVoice(); },
    'voice-start': function () { startVoice(); },
    'voice-submit': function () {
      stopVoice();
      var text = (ui.form.text || '').trim();
      ui.form.vstate = 'idle';
      if (!text) { ui.form.error = 'Скажи или впиши фразу: категория и сумма.'; renderSheet(); return; }
      submitPhrase([text]);
    },

    op: function (el) {
      var op = findOp(el.dataset.id);
      if (!op) return;
      openSheet('op', { id: op.id }, { amount: L.moneyToInput(op.amount), cat: op.cat });
    },
    'op-cat': function (el) { ui.form.cat = el.dataset.id; renderSheet(); },
    'op-save': function () {
      var op = findOp(ui.sheet.id);
      var amt = L.parseMoney(ui.form.amount);
      if (!op) return;
      if (!amt) { toast('Укажи сумму больше нуля'); return; }
      op.amount = amt;
      if (catById(ui.form.cat)) op.cat = ui.form.cat;
      save(); closeSheet(); render();
      toast('Операция изменена');
    },
    'op-delete': function () {
      var op = findOp(ui.sheet.id);
      if (!op) return;
      var c = cur(), idx = c.ops.indexOf(op);
      c.ops.splice(idx, 1);
      save(); closeSheet(); render();
      toast('Операция удалена', function () { c.ops.splice(idx, 0, op); save(); render(); });
    },

    paid: function (el) {
      var it = findItem('current', el.dataset.id);
      if (!it) return;
      var done = it.amount > 0 && (it.paid || 0) >= it.amount;
      it.paid = done ? 0 : it.amount;
      save(); render();
    },
    item: function (el) {
      var it = findItem(el.dataset.view, el.dataset.id);
      if (!it) return;
      openSheet('item', { view: el.dataset.view, id: it.id }, {
        name: it.name, amount: L.moneyToInput(it.amount), note: it.note || '', paid: L.moneyToInput(it.paid || 0), applyPlan: false
      });
    },
    'item-new': function (el) {
      openSheet('item', { view: el.dataset.view, id: null, group: el.dataset.group }, { name: '', amount: '', note: '', paid: '', applyPlan: true });
    },
    'item-save': function () {
      var sh = ui.sheet, f = ui.form;
      var fields = { name: (f.name || '').trim() || 'Без названия', note: (f.note || '').trim(), amount: L.parseMoney(f.amount) || 0 };
      if (f.amount && L.parseMoney(f.amount) === null) { toast('Сумма введена с ошибкой'); return; }
      if (sh.view === 'plan') {
        var tp = state.templates[planPeriod().type];
        if (sh.id) { var ti = findItem('plan', sh.id); if (ti) { ti.name = fields.name; ti.note = fields.note; ti.amount = fields.amount; } }
        else tp.items.push({ id: L.uid(), group: sh.group, name: fields.name, note: fields.note, amount: fields.amount });
      } else {
        var c = cur();
        var paid = L.parseMoney(f.paid) || 0;
        var it = sh.id ? findItem('current', sh.id) : null;
        if (!it) {
          it = { id: L.uid(), group: sh.group, name: '', note: '', amount: 0, paid: 0 };
          c.items.push(it);
        }
        it.name = fields.name; it.note = fields.note; it.amount = fields.amount; it.paid = paid;
        if (f.applyPlan && it.group !== 'carry') applyTplItem(c.type, it, fields);
      }
      save(); closeSheet(); render();
      toast('Сохранено');
    },
    'item-delete': function () {
      var sh = ui.sheet;
      if (sh.view === 'plan') {
        var tp = state.templates[planPeriod().type];
        tp.items = tp.items.filter(function (x) { return x.id !== sh.id; });
      } else {
        var c = cur(), it = findItem('current', sh.id);
        c.items = c.items.filter(function (x) { return x.id !== sh.id; });
        if (it && ui.form.applyPlan) removeTplItem(c.type, it.tplId);
      }
      save(); closeSheet(); render();
      toast(sh.view === 'current' && !ui.form.applyPlan ? 'Удалено из этого периода. В плане платёж остался' : 'Удалено');
    },
    'item-move': function () {
      var sh = ui.sheet;
      var it = findItem(sh.view, sh.id);
      if (!it) return;
      var fromType = sh.view === 'plan' ? planPeriod().type : cur().type;
      var toType = L.otherType(fromType);
      if (sh.view === 'plan') {
        var tp = state.templates[fromType];
        tp.items = tp.items.filter(function (x) { return x.id !== it.id; });
      } else {
        var c = cur();
        c.items = c.items.filter(function (x) { return x.id !== it.id; });
        removeTplItem(fromType, it.tplId);
      }
      state.templates[toType].items.push({ id: L.uid(), group: it.group, name: it.name, note: it.note || '', amount: it.amount || 0 });
      save(); closeSheet(); render();
      toast('Перенесено в план периодов ' + typeQ(toType));
    },

    income: function (el) {
      var src = srcFor(el.dataset.view);
      openSheet('income', { view: el.dataset.view }, { amount: L.moneyToInput(src.income || 0), applyPlan: false });
    },
    'income-save': function () {
      var amt = L.parseMoney(ui.form.amount);
      if (ui.form.amount && amt === null) { toast('Сумма введена с ошибкой'); return; }
      amt = amt || 0;
      if (ui.sheet.view === 'plan') state.templates[planPeriod().type].income = amt;
      else {
        cur().income = amt;
        if (ui.form.applyPlan) state.templates[cur().type].income = amt;
      }
      save(); closeSheet(); render();
    },

    limits: function (el) {
      var src = srcFor(el.dataset.view);
      var form = { applyPlan: false };
      state.categories.forEach(function (cat) { form['lim_' + cat.id] = L.moneyToInput((src.limits || {})[cat.id] || 0); });
      openSheet('limits', { view: el.dataset.view }, form);
    },
    'limits-save': function () {
      var view = ui.sheet.view;
      var target = view === 'plan' ? state.templates[planPeriod().type].limits : cur().limits;
      var tpl = view === 'current' && ui.form.applyPlan ? state.templates[cur().type].limits : null;
      var bad = false;
      state.categories.forEach(function (cat) {
        var raw = ui.form['lim_' + cat.id];
        var v = L.parseMoney(raw);
        if (raw && v === null) { bad = true; return; }
        [target, tpl].forEach(function (obj) {
          if (!obj) return;
          if (v) obj[cat.id] = v; else delete obj[cat.id];
        });
      });
      save(); closeSheet(); render();
      toast(bad ? 'Сохранено. Суммы с ошибкой пропущены' : 'Лимиты сохранены');
    },

    archive: function () { openSheet('archive'); },
    arch: function (el) { openSheet('arch', { i: +el.dataset.i }); },

    cat: function (el) {
      var id = el.dataset.id;
      var cat = id ? catById(id) : null;
      var usedColors = state.categories.map(function (c) { return c.color; });
      var free = L.PALETTE.filter(function (c) { return usedColors.indexOf(c) < 0; })[0] || L.PALETTE[0];
      openSheet('cat', { id: id || null }, cat ? { name: cat.name, aliases: cat.aliases || '', color: cat.color } : { name: '', aliases: '', color: free });
    },
    'cat-color': function (el) { ui.form.color = el.dataset.c; renderSheet(); },
    'cat-save': function () {
      var name = (ui.form.name || '').trim();
      if (!name) { toast('Впиши название категории'); return; }
      if (ui.sheet.id) {
        var cat = catById(ui.sheet.id);
        if (cat) { cat.name = name; cat.aliases = (ui.form.aliases || '').trim(); cat.color = ui.form.color; }
      } else {
        state.categories.push({ id: L.uid(), name: name, aliases: (ui.form.aliases || '').trim(), color: ui.form.color });
      }
      save(); render();
      openSheet('settings');
    },
    'cat-delete': function () {
      var id = ui.sheet.id;
      if (cur().ops.some(function (o) { return o.cat === id; })) return;
      if (!window.confirm('Удалить категорию? Её лимиты тоже удалятся.')) return;
      state.categories = state.categories.filter(function (c) { return c.id !== id; });
      delete cur().limits[id];
      delete state.templates.salary.limits[id];
      delete state.templates.advance.limits[id];
      save(); render();
      openSheet('settings');
    },

    export: function () { doExport(); },
    share: function () { doShare(); },
    import: function () { document.getElementById('import-file').click(); },
    reset: function () {
      if (!window.confirm('Удалить все данные: траты, планы, архив и категории? Это нельзя отменить.')) return;
      state = L.seedState();
      roll(false);
      save();
      closeSheet();
      ui.tab = 'tek';
      render();
      toast('Все данные удалены');
    }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var fn = ACTIONS[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });

  function onField(e) {
    var f = e.target.getAttribute && e.target.getAttribute('data-field');
    if (!f) return;
    ui.form[f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  }
  document.addEventListener('input', onField);
  document.addEventListener('change', onField);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && ui.sheet) { closeSheet(); return; }
    if (e.key === 'Enter' && e.target && e.target.id === 'voice-text') { e.preventDefault(); ACTIONS['voice-submit'](); }
  });

  // вернулись в приложение — возможно, уже начался новый период
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && roll(true)) render();
  });

  /* ================= запуск ================= */

  roll(true);
  render();

  try {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persisted().then(function (p) {
        if (p) { ui.persisted = true; return; }
        return navigator.storage.persist().then(function (r) { ui.persisted = r; });
      }).catch(function () { /* недоступно */ });
    }
  } catch (e) { /* недоступно */ }

  try {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      var hadController = !!navigator.serviceWorker.controller;
      var reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!hadController || reloaded) return;
        reloaded = true;
        location.reload();
      });
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () { /* офлайн-режим недоступен */ });
      });
    }
  } catch (e) { /* в превью без service worker */ }
})();
