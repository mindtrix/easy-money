// Запуск: node tests/logic.test.js
const L = require('../logic.js');
let failed = 0, passed = 0;
function eq(actual, expected, name) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; } else { failed++; console.error('✗ ' + name + '\n   ждали: ' + e + '\n   вышло: ' + a); }
}
const D = (y, m, d) => new Date(y, m - 1, d);

// деньги
eq(L.parseMoney('1 153,40'), 115340, 'parseMoney с пробелом и запятой');
eq(L.parseMoney('1153.4'), 115340, 'parseMoney с точкой');
eq(L.parseMoney('500'), 50000, 'parseMoney целое');
eq(L.parseMoney(''), null, 'parseMoney пусто');
eq(L.parseMoney('12,345'), null, 'parseMoney три знака после запятой');
eq(L.parseMoney('abc'), null, 'parseMoney мусор');
eq(L.fmtMoney(115340), '1 153,40 ₽', 'fmtMoney с копейками');
eq(L.fmtMoney(5000000), '50 000 ₽', 'fmtMoney без копеек');
eq(L.fmtMoney(-120000), '−1 200 ₽', 'fmtMoney минус');
eq(L.moneyToInput(115340), '1153,40', 'moneyToInput');
eq(L.moneyToInput(0), '', 'moneyToInput ноль');

// периоды
eq(L.periodFor(D(2026, 10, 13)), { type: 'advance', start: '2026-09-30', end: '2026-10-14' }, '13 октября — период аванса');
eq(L.periodFor(D(2026, 10, 14)), { type: 'advance', start: '2026-09-30', end: '2026-10-14' }, '14 октября — ещё аванс');
eq(L.periodFor(D(2026, 10, 15)), { type: 'salary', start: '2026-10-15', end: '2026-10-29' }, '15 октября — зарплата');
eq(L.periodFor(D(2026, 10, 30)), { type: 'advance', start: '2026-10-30', end: '2026-11-14' }, '30 октября — аванс');
eq(L.periodFor(D(2026, 10, 31)), { type: 'advance', start: '2026-10-30', end: '2026-11-14' }, '31 октября — аванс');
eq(L.periodFor(D(2027, 2, 27)), { type: 'salary', start: '2027-02-15', end: '2027-02-27' }, 'февраль: 27-е ещё зарплата');
eq(L.periodFor(D(2027, 2, 28)), { type: 'advance', start: '2027-02-28', end: '2027-03-14' }, 'февраль: 28-е — аванс');
eq(L.periodFor(D(2027, 3, 1)), { type: 'advance', start: '2027-02-28', end: '2027-03-14' }, '1 марта — аванс с 28 февраля');
eq(L.periodFor(D(2027, 1, 5)), { type: 'advance', start: '2026-12-30', end: '2027-01-14' }, 'через Новый год');
eq(L.nextPeriod({ type: 'salary', start: '2026-10-15', end: '2026-10-29' }), { type: 'advance', start: '2026-10-30', end: '2026-11-14' }, 'следующий после зарплаты');
eq(L.periodLabel({ start: '2026-10-15', end: '2026-10-29' }), '15–29 окт', 'подпись периода в одном месяце');
eq(L.periodLabel({ start: '2026-09-30', end: '2026-10-14' }), '30 сен – 14 окт', 'подпись периода через месяц');

// закрытие периода и перенос долгов
(function () {
  const s = L.seedState();
  s.templates.advance.items = [{ id: 't1', group: 'credit', name: 'Кредит А', note: '', amount: 700000 }];
  s.templates.salary.items = [{ id: 't2', group: 'must', name: 'Квартира', note: '', amount: 5000000 }];
  s.templates.salary.income = 10000000;
  L.rollPeriods(s, D(2026, 10, 13));
  eq(s.current.type, 'advance', 'первый запуск: текущий период аванса');
  eq(s.current.items.length, 1, 'первый запуск: план скопирован из шаблона');
  s.current.items[0].paid = 300000; // оплачено частично
  s.current.ops.push({ id: 'o1', ts: 0, cat: 'food', amount: 50000 });
  const closed = L.rollPeriods(s, D(2026, 10, 16));
  eq(closed, 1, 'переход через 15-е закрывает один период');
  eq(s.archive.length, 1, 'закрытый период в архиве');
  eq(s.archive[0].ops.length, 1, 'траты ушли в архив вместе с периодом');
  eq(s.current.type, 'salary', 'новый период — зарплата');
  eq(s.current.income, 10000000, 'приход взят из плана');
  eq(s.current.ops.length, 0, 'траты нового периода пустые');
  const carry = s.current.items.filter(i => i.group === 'carry');
  eq(carry.length, 1, 'неоплаченное перенесено');
  eq(carry[0].amount, 400000, 'перенесён только остаток');
  eq(carry[0].note, 'из периода 30 сен – 14 окт', 'у переноса подпись периода');
  // приложение не открывали месяц: закрываются все пропущенные периоды
  const n = L.rollPeriods(s, D(2026, 11, 20));
  eq(n, 2, 'пропущенные периоды закрываются по очереди');
  eq(s.current.start, '2026-11-15', 'текущий период после пропуска');
  const carry2 = s.current.items.filter(i => i.group === 'carry');
  eq(carry2.reduce((a, i) => a + i.amount, 0), 400000 + 5000000 + 700000, 'долги копятся через пропущенные периоды');
  eq(s.current.items.filter(i => i.group === 'must').length, 1, 'план нового периода на месте');
  const again = carry2.find(i => i.amount === 400000);
  eq(again && again.note, 'из периода 30 сен – 14 окт', 'повторный перенос сохраняет исходную подпись');
})();

// итоги
(function () {
  const cats = [{ id: 'a' }, { id: 'b' }];
  const t = L.totals({
    income: 10000000,
    limits: { a: 1000000, b: 500000, deleted: 999 },
    items: [
      { group: 'carry', amount: 100000, paid: 0 },
      { group: 'credit', amount: 300000, paid: 300000 },
      { group: 'must', amount: 200000, paid: 50000 }
    ],
    ops: [{ cat: 'a', amount: 20000 }, { cat: 'a', amount: 30000 }]
  }, cats);
  eq([t.plan, t.tek, t.rest, t.spent, t.freeTek, t.paid, t.doneCount], [600000, 1500000, 7900000, 50000, 1450000, 350000, 1], 'итоги периода');
  eq(t.spentBy.a, 50000, 'потрачено по категории');
})();

// голос
(function () {
  const cats = L.seedState().categories;
  const p = (s) => L.parsePhrase(s, cats);
  eq(p('продукты 500'), { catId: 'food', amount: 50000 }, 'продукты 500');
  eq(p('500 на продукты'), { catId: 'food', amount: 50000 }, 'сумма впереди');
  eq(p('еда в городе 380'), { catId: 'city', amount: 38000 }, 'еда в городе');
  eq(p('прдукты 300'), { catId: 'food', amount: 30000 }, 'опечатка распознавания');
  eq(p('Продуктов 1 200'), { catId: 'food', amount: 120000 }, 'склонение и тысячи с пробелом');
  eq(p('кафе 2 тысячи'), { catId: 'city', amount: 200000 }, 'слово «тысячи»');
  eq(p('продукты 1153,40'), { catId: 'food', amount: 115340 }, 'копейки');
  eq(!!p('такси 300').error, true, 'неизвестная категория — ошибка');
  eq(!!p('продукты').error, true, 'нет суммы — ошибка');
  eq(!!p('').error, true, 'пусто — ошибка');
})();

// категории: названия, порядок, удаление
(function () {
  const s = L.seedState();
  L.rollPeriods(s, D(2026, 10, 17));
  eq(L.categoryNameTaken(s.categories, '  еда И Продукты ', null), true, 'дубль названия без учёта регистра и пробелов');
  eq(L.categoryNameTaken(s.categories, 'Еда и продукты', 'food'), false, 'своё название — не дубль');
  eq(L.categoryNameTaken(s.categories, 'Такси', null), false, 'новое название свободно');

  eq(L.moveCategory(s, 'food', -1), false, 'первую выше не сдвинуть');
  eq(L.moveCategory(s, 'city', -1), true, 'сдвиг вверх');
  eq(s.categories.map(c => c.id).slice(0, 2), ['city', 'food'], 'порядок после сдвига вверх');
  eq(L.moveCategory(s, 'other', 1), false, 'последнюю ниже не сдвинуть');
  eq(L.moveCategory(s, 'nope', 1), false, 'несуществующую не сдвинуть');

  s.current.limits = { food: 100000, self: 50000 };
  s.templates.salary.limits = { self: 50000 };
  s.templates.advance.limits = { self: 40000 };
  s.current.ops.push({ id: 'o1', ts: 1, cat: 'self', amount: 1000 }, { id: 'o2', ts: 2, cat: 'self', amount: 2000 }, { id: 'o3', ts: 3, cat: 'food', amount: 500 });
  eq(L.removeCategory(s, 'self', null), null, 'с тратами без переноса не удаляется');
  eq(s.categories.some(c => c.id === 'self'), true, 'категория на месте после отказа');
  eq(L.removeCategory(s, 'self', 'self'), null, 'перенос в саму себя не принимается');
  eq(L.removeCategory(s, 'self', 'home'), 2, 'перенесены две траты');
  eq(s.current.ops.map(o => o.cat), ['home', 'home', 'food'], 'траты в новой категории');
  eq([s.current.limits.self, s.templates.salary.limits.self, s.templates.advance.limits.self], [undefined, undefined, undefined], 'лимиты удалены везде');
  eq(s.current.limits.food, 100000, 'чужие лимиты не тронуты');
  eq(s.categories.some(c => c.id === 'self'), false, 'категория удалена');
  eq(L.removeCategory(s, 'other', null), 0, 'пустая удаляется без переноса');
})();

console.log((failed ? '✗ ' : '✓ ') + passed + ' прошло, ' + failed + ' упало');
process.exit(failed ? 1 : 0);
