/*
 * Бюджет — чистая логика без интерфейса.
 * Суммы везде хранятся в копейках (целые числа), даты периодов — строками 'YYYY-MM-DD'.
 * Файл работает и в браузере (window.BudgetLogic), и в node (require) для тестов.
 */
(function (root) {
  'use strict';

  var MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  var MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  var PALETTE = ['#2F6FD6', '#7A4FD0', '#1A93A8', '#D2457E', '#5B6472', '#8B5E34', '#4338CA', '#A21CAF', '#0891B2', '#C2410C'];
  var SCHEMA_VERSION = 1;

  /* ---------- общее ---------- */

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }

  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }

  /* ---------- деньги ---------- */

  // "1 153,40" / "1153.4" / "500" -> копейки; пусто или мусор -> null
  function parseMoney(str) {
    if (str === null || str === undefined) return null;
    var s = String(str).replace(/[\s ₽р]/gi, '').replace(',', '.');
    if (s === '') return null;
    if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
    return Math.round(parseFloat(s) * 100);
  }

  function groupDigits(intStr) {
    return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  // копейки -> "1 153,40 ₽" (копейки показываются только если они есть)
  function fmtMoney(kop, opts) {
    opts = opts || {};
    var neg = kop < 0;
    var abs = Math.abs(Math.round(kop || 0));
    var rub = Math.floor(abs / 100);
    var k = abs % 100;
    var out = groupDigits(String(rub));
    if (k) out += ',' + (k < 10 ? '0' : '') + k;
    if (!opts.noSign && neg) out = '−' + out;
    if (opts.plus && !neg && abs) out = '+' + out;
    return opts.bare ? out : out + ' ₽';
  }

  // копейки -> строка для поля ввода: "1153,4" / "500"
  function moneyToInput(kop) {
    if (!kop) return '';
    var rub = Math.floor(kop / 100), k = kop % 100;
    if (!k) return String(rub);
    return rub + ',' + (k < 10 ? '0' : '') + k;
  }

  /* ---------- даты и периоды ---------- */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function ymd(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function parseYmd(s) {
    var p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function lastDay(y, m) {
    return new Date(y, m + 1, 0).getDate();
  }

  // второй период начинается 30-го, а в коротком месяце — в его последний день
  function secondStart(y, m) {
    return Math.min(30, lastDay(y, m));
  }

  // какой период содержит дату. salary — после зарплаты (с 15-го), advance — после аванса (с 30-го)
  function periodFor(date) {
    var y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
    var ss = secondStart(y, m);
    if (d >= 15 && d < ss) {
      return { type: 'salary', start: ymd(new Date(y, m, 15)), end: ymd(new Date(y, m, ss - 1)) };
    }
    if (d >= ss) {
      return { type: 'advance', start: ymd(new Date(y, m, ss)), end: ymd(new Date(y, m + 1, 14)) };
    }
    var py = m === 0 ? y - 1 : y, pm = m === 0 ? 11 : m - 1;
    return { type: 'advance', start: ymd(new Date(py, pm, secondStart(py, pm))), end: ymd(new Date(y, m, 14)) };
  }

  function nextPeriod(p) {
    var e = parseYmd(p.end);
    return periodFor(new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1));
  }

  function otherType(type) {
    return type === 'salary' ? 'advance' : 'salary';
  }

  function typeName(type) {
    return type === 'salary' ? 'зарплата' : 'аванс';
  }

  // "15–29 окт" или "30 сен – 14 окт"
  function periodLabel(p, long) {
    var s = parseYmd(p.start), e = parseYmd(p.end);
    var names = long ? MONTHS_GEN : MONTHS_SHORT;
    if (s.getMonth() === e.getMonth()) return s.getDate() + '–' + e.getDate() + ' ' + names[e.getMonth()];
    return s.getDate() + ' ' + names[s.getMonth()] + ' – ' + e.getDate() + ' ' + names[e.getMonth()];
  }

  function daysLeft(p, today) {
    var e = parseYmd(p.end);
    var t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.round((e - t) / 86400000) + 1;
  }

  /* ---------- состояние ---------- */

  function emptyTemplate() {
    return { income: 0, limits: {}, items: [] };
  }

  function seedState() {
    return {
      version: SCHEMA_VERSION,
      categories: [
        { id: 'food', name: 'Еда и продукты', color: PALETTE[0], aliases: 'продукты, еда, магазин' },
        { id: 'city', name: 'Еда в городе', color: PALETTE[1], aliases: 'кафе, обед, город, работа' },
        { id: 'home', name: 'Дом и быт', color: PALETTE[2], aliases: 'дом, быт, хозтовары' },
        { id: 'self', name: 'Личное', color: PALETTE[3], aliases: 'себе, личное' },
        { id: 'other', name: 'Прочее', color: PALETTE[4], aliases: 'прочее, другое, разное' }
      ],
      templates: { salary: emptyTemplate(), advance: emptyTemplate() },
      current: null,
      archive: []
    };
  }

  // приводит загруженные данные к текущей схеме, заполняя пропуски
  function migrate(data) {
    var s = data && typeof data === 'object' ? data : {};
    var base = seedState();
    var out = {
      version: SCHEMA_VERSION,
      categories: Array.isArray(s.categories) ? s.categories : base.categories,
      templates: s.templates && typeof s.templates === 'object' ? s.templates : base.templates,
      current: s.current || null,
      archive: Array.isArray(s.archive) ? s.archive : []
    };
    ['salary', 'advance'].forEach(function (t) {
      var tp = out.templates[t] || {};
      out.templates[t] = {
        income: tp.income || 0,
        limits: tp.limits && typeof tp.limits === 'object' ? tp.limits : {},
        items: Array.isArray(tp.items) ? tp.items : []
      };
    });
    if (out.current) {
      out.current.limits = out.current.limits || {};
      out.current.items = out.current.items || [];
      out.current.ops = out.current.ops || [];
      out.current.income = out.current.income || 0;
    }
    return out;
  }

  // проверка файла импорта: похож ли он на наш бэкап
  function looksLikeBackup(obj) {
    return !!(obj && typeof obj === 'object' && Array.isArray(obj.categories) && obj.templates && typeof obj.templates === 'object');
  }

  /* ---------- периоды: создание, закрытие, перенос долгов ---------- */

  function newInstance(period, template, carry) {
    var tp = template || emptyTemplate();
    return {
      type: period.type,
      start: period.start,
      end: period.end,
      income: tp.income || 0,
      limits: clone(tp.limits || {}),
      items: (carry || []).concat((tp.items || []).map(function (it) {
        return { id: uid(), tplId: it.id, group: it.group, name: it.name, note: it.note || '', amount: it.amount || 0, paid: 0 };
      })),
      ops: [],
      openedAt: Date.now()
    };
  }

  // неоплаченное из закрываемого периода -> строки «перенесено»
  function carryFrom(inst) {
    var label = periodLabel(inst);
    return inst.items.filter(function (it) {
      return (it.amount || 0) - (it.paid || 0) > 0;
    }).map(function (it) {
      return {
        id: uid(),
        group: 'carry',
        name: it.name,
        note: it.group === 'carry' ? it.note : 'из периода ' + label,
        amount: it.amount - (it.paid || 0),
        paid: 0,
        fromTpl: it.tplId || it.fromTpl || null
      };
    });
  }

  // закрывает все периоды, которые уже прошли, и открывает актуальный.
  // возвращает число закрытых периодов
  function rollPeriods(state, today) {
    var todayStr = ymd(today);
    if (!state.current) {
      state.current = newInstance(periodFor(today), state.templates[periodFor(today).type], []);
      return 0;
    }
    var closed = 0;
    var guard = 0;
    while (state.current.end < todayStr && guard < 200) {
      guard++;
      var cur = state.current;
      var carry = carryFrom(cur);
      var record = clone(cur);
      record.closedAt = Date.now();
      record.categories = clone(state.categories);
      state.archive.unshift(record);
      var next = nextPeriod(cur);
      state.current = newInstance(next, state.templates[next.type], carry);
      closed++;
    }
    return closed;
  }

  /* ---------- итоги ---------- */

  function sumBy(arr, fn) {
    return arr.reduce(function (a, x) { return a + (fn(x) || 0); }, 0);
  }

  // итоги для экземпляра периода или для шаблона (у шаблона нет ops и paid)
  function totals(planLike, categories) {
    var items = planLike.items || [];
    var limits = planLike.limits || {};
    var ops = planLike.ops || [];
    var catIds = categories.map(function (c) { return c.id; });
    var spentBy = {};
    ops.forEach(function (o) { spentBy[o.cat] = (spentBy[o.cat] || 0) + o.amount; });
    var carry = sumBy(items.filter(function (i) { return i.group === 'carry'; }), function (i) { return i.amount; });
    var credits = sumBy(items.filter(function (i) { return i.group === 'credit'; }), function (i) { return i.amount; });
    var musts = sumBy(items.filter(function (i) { return i.group === 'must'; }), function (i) { return i.amount; });
    var tek = sumBy(catIds, function (id) { return limits[id]; });
    var spent = sumBy(ops, function (o) { return o.amount; });
    var plan = carry + credits + musts;
    var paid = sumBy(items, function (i) { return Math.min(i.paid || 0, i.amount || 0); });
    var doneCount = items.filter(function (i) { return i.amount > 0 && (i.paid || 0) >= i.amount; }).length;
    return {
      income: planLike.income || 0,
      carry: carry, credits: credits, musts: musts, plan: plan,
      tek: tek, spent: spent, freeTek: tek - spent,
      rest: (planLike.income || 0) - plan - tek,
      paid: paid, doneCount: doneCount, itemCount: items.length,
      spentBy: spentBy
    };
  }

  /* ---------- голосовой ввод ---------- */

  var STOP = ['на', 'за', 'по', 'в', 'и', 'рублей', 'рубля', 'рубль', 'руб', 'р', 'потратил', 'потратила', 'купил', 'купила', 'это', 'было', 'ушло', 'минус'];

  function norm(s) {
    return String(s || '').toLowerCase().replace(/ё/g, 'е');
  }

  function lev(a, b) {
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function wordsOf(s) {
    return norm(s).split(/[^a-zа-я]+/).filter(function (w) { return w.length > 1 && STOP.indexOf(w) < 0; });
  }

  function categoryKeys(cat) {
    var keys = wordsOf(cat.name).filter(function (w) { return w.length >= 3; });
    String(cat.aliases || '').split(/[,;]+/).forEach(function (a) {
      wordsOf(a).forEach(function (w) { if (keys.indexOf(w) < 0) keys.push(w); });
    });
    return keys;
  }

  // "продукты 500" / "500 на продукты" / "еда в городе 1 200" -> { catId, amount } или { error }
  function parsePhrase(text, categories) {
    var raw = String(text || '').trim();
    if (!raw) return { error: 'Ничего не услышал. Скажи категорию и сумму.' };
    var t = norm(raw).replace(/(\d)[\s ]+(?=\d{3}(?!\d))/g, '$1');
    var m = t.match(/(\d+(?:[.,]\d{1,2})?)(?:\s*(тыс[а-я]*|т\.))?/);
    var amount = null;
    if (m) {
      amount = Math.round(parseFloat(m[1].replace(',', '.')) * 100);
      if (m[2]) amount *= 1000;
    }
    var rest = t.replace(/\d+(?:[.,]\d+)?/g, ' ').replace(/тыс[а-я]*/g, ' ');
    var words = wordsOf(rest);
    if (!words.length) return { error: 'В «' + raw + '» нет категории. Повтори: категория и сумма.' };
    var best = null, bestScore = 0, tie = false;
    categories.forEach(function (c) {
      var keys = categoryKeys(c);
      var score = 0;
      words.forEach(function (w) {
        var bm = 0;
        keys.forEach(function (k) {
          var tol = k.length >= 6 ? 2 : (k.length >= 4 ? 1 : 0);
          if (lev(w, k) <= tol && k.length > bm) bm = k.length;
        });
        score += bm;
      });
      if (score > bestScore) { bestScore = score; best = c; tie = false; }
      else if (score > 0 && score === bestScore) { tie = true; }
    });
    if (!best) return { error: 'Не нашёл категорию «' + words.join(' ') + '». Повтори.' };
    if (tie) return { error: 'Не понял, какая категория: «' + words.join(' ') + '». Повтори точнее.' };
    if (!amount) return { error: 'Услышал «' + best.name + '», но не услышал сумму. Повтори.' };
    return { catId: best.id, amount: amount };
  }

  /* ---------- категории ---------- */

  function normName(s) {
    return norm(s).trim().replace(/\s+/g, ' ');
  }

  // есть ли уже категория с таким названием (без учёта регистра и «ё»), кроме exceptId
  function categoryNameTaken(categories, name, exceptId) {
    var n = normName(name);
    return categories.some(function (c) { return c.id !== exceptId && normName(c.name) === n; });
  }

  // сдвигает категорию на одну позицию: dir = -1 вверх, 1 вниз. Порядок в массиве = порядок на экране
  function moveCategory(state, id, dir) {
    var cats = state.categories, i = -1, k;
    for (k = 0; k < cats.length; k++) if (cats[k].id === id) i = k;
    var j = i + dir;
    if (i < 0 || j < 0 || j >= cats.length) return false;
    var tmp = cats[i]; cats[i] = cats[j]; cats[j] = tmp;
    return true;
  }

  // удаляет категорию вместе с её лимитами. Траты текущего периода переносит в moveTo.
  // Если траты есть, а moveTo не задана или не существует — ничего не делает и возвращает null.
  // Архив не трогается: у закрытых периодов свой снимок категорий.
  function removeCategory(state, id, moveTo) {
    var ops = state.current ? state.current.ops : [];
    var used = ops.filter(function (o) { return o.cat === id; });
    var target = moveTo && moveTo !== id && state.categories.some(function (c) { return c.id === moveTo; });
    if (used.length && !target) return null;
    used.forEach(function (o) { o.cat = moveTo; });
    if (state.current) delete state.current.limits[id];
    ['salary', 'advance'].forEach(function (t) { if (state.templates[t]) delete state.templates[t].limits[id]; });
    state.categories = state.categories.filter(function (c) { return c.id !== id; });
    return used.length;
  }

  var api = {
    MONTHS_GEN: MONTHS_GEN, MONTHS_SHORT: MONTHS_SHORT, MONTHS_NOM: MONTHS_NOM, PALETTE: PALETTE,
    SCHEMA_VERSION: SCHEMA_VERSION,
    uid: uid, clone: clone, plural: plural,
    parseMoney: parseMoney, fmtMoney: fmtMoney, moneyToInput: moneyToInput,
    ymd: ymd, parseYmd: parseYmd, periodFor: periodFor, nextPeriod: nextPeriod, otherType: otherType,
    typeName: typeName, periodLabel: periodLabel, daysLeft: daysLeft,
    seedState: seedState, migrate: migrate, looksLikeBackup: looksLikeBackup, emptyTemplate: emptyTemplate,
    newInstance: newInstance, carryFrom: carryFrom, rollPeriods: rollPeriods,
    totals: totals, parsePhrase: parsePhrase, lev: lev,
    categoryNameTaken: categoryNameTaken, moveCategory: moveCategory, removeCategory: removeCategory
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BudgetLogic = api;
})(typeof self !== 'undefined' ? self : this);
