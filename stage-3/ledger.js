'use strict';

const RFC3339 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$/;

function instant(value) {
  if (typeof value !== 'string') return null;
  const m = RFC3339.exec(value);
  if (!m) return null;
  const [, ys, mos, ds, hs, mis, ss, fraction = '', zone, sign, ohs, oms] = m;
  const y = Number(ys), mo = Number(mos), d = Number(ds);
  const h = Number(hs), mi = Number(mis), sec = Number(ss);
  const oh = Number(ohs || 0), om = Number(oms || 0);
  if (mo < 1 || mo > 12 || h > 23 || mi > 59 || sec > 59 || oh > 23 || om > 59) return null;
  const date = new Date(0);
  date.setUTCFullYear(y, mo - 1, d);
  date.setUTCHours(h, mi, sec, 0);
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  const offset = (oh * 60 + om) * (sign === '+' ? 1 : -1) * 60;
  return { seconds: BigInt(Math.trunc(date.getTime() / 1000) - offset), fraction: fraction.replace(/0+$/, '') };
}

function compareInstant(a, b) {
  const x = typeof a === 'string' ? instant(a) : a;
  const y = typeof b === 'string' ? instant(b) : b;
  if (!x || !y) throw new TypeError('invalid RFC 3339 instant');
  if (x.seconds < y.seconds) return -1;
  if (x.seconds > y.seconds) return 1;
  const width = Math.max(x.fraction.length, y.fraction.length);
  const xf = x.fraction.padEnd(width, '0');
  const yf = y.fraction.padEnd(width, '0');
  return xf < yf ? -1 : xf > yf ? 1 : 0;
}

function validInstant(value) { return instant(value) !== null; }

function paymentRevisionList(state, paymentId, replacement) {
  const base = state.payment_revisions?.[paymentId] || [];
  if (replacement && replacement.payment_id === paymentId) return [...base, replacement.revision];
  return base;
}

function selectedRevision(state, paymentId, knownAt, replacement) {
  const rows = paymentRevisionList(state, paymentId, replacement);
  let selected = null;
  for (const row of rows) {
    if (compareInstant(row.recorded_at, knownAt) <= 0 && (!selected || row.revision > selected.revision)) selected = row;
  }
  return selected;
}

function selectedPayments(state, knownAt, replacement) {
  const result = [];
  for (const payment of state.payments) {
    const revision = selectedRevision(state, payment.payment_id, knownAt, replacement);
    if (revision) result.push({ payment, revision });
  }
  return result;
}

function deltaFor(payment, amount, userId) {
  if (payment.from_user_id === userId) return -amount;
  if (payment.to_user_id === userId) return amount;
  return 0;
}

function balanceAt(state, userId, asOf, knownAt, replacement) {
  let balance = state.opening_balances?.[userId] ?? 0;
  for (const { payment, revision } of selectedPayments(state, knownAt, replacement)) {
    if (compareInstant(revision.effective_at, asOf) <= 0) balance += deltaFor(payment, revision.amount, userId);
  }
  return balance;
}

function captureEvents(state, authorizationId) {
  return state.payments
    .filter(p => p.authorization_id === authorizationId)
    .map(p => ({ at: p.created_at, amount: p.amount }));
}

function heldAt(state, userId, asOf, knownAt) {
  let held = 0;
  for (const auth of state.authorizations || []) {
    if (auth.from_user_id !== userId) continue;
    const createdAt = auth.created_at || state.reset_at;
    if (!createdAt || compareInstant(createdAt, knownAt) > 0 || compareInstant(createdAt, asOf) > 0) continue;
    const expiresAt = auth.expires_at;
    const closedAt = auth.closed_at || null;
    // Old Stage 1/2 exports did not retain a void event timestamp. A closed legacy
    // hold without one is treated as a cutover record, not assigned a fabricated event.
    if (auth.status !== 'open' && !closedAt && auth.status !== 'expired') continue;
    if (closedAt && compareInstant(closedAt, asOf) <= 0) continue;
    if (expiresAt && compareInstant(expiresAt, asOf) <= 0) continue;
    let captured = 0;
    for (const event of captureEvents(state, auth.authorization_id)) {
      if (compareInstant(event.at, knownAt) <= 0 && compareInstant(event.at, asOf) <= 0) captured += event.amount;
    }
    held += Math.max(0, auth.amount - captured);
  }
  return held;
}

function balanceBefore(state, userId, at, knownAt, replacement) {
  let balance = state.opening_balances?.[userId] ?? 0;
  for (const { payment, revision } of selectedPayments(state, knownAt, replacement)) {
    if (compareInstant(revision.effective_at, at) < 0) balance += deltaFor(payment, revision.amount, userId);
  }
  return balance;
}

function heldBefore(state, userId, at, knownAt) {
  let held = 0;
  for (const auth of state.authorizations || []) {
    if (auth.from_user_id !== userId) continue;
    const createdAt = auth.created_at || state.reset_at;
    if (!createdAt || compareInstant(createdAt, knownAt) > 0 || compareInstant(createdAt, at) >= 0) continue;
    if (auth.status !== 'open' && !auth.closed_at && auth.status !== 'expired') continue;
    if (auth.closed_at && compareInstant(auth.closed_at, at) < 0) continue;
    if (auth.expires_at && compareInstant(auth.expires_at, at) < 0) continue;
    let captured = 0;
    for (const event of captureEvents(state, auth.authorization_id)) {
      if (compareInstant(event.at, knownAt) <= 0 && compareInstant(event.at, at) < 0) captured += event.amount;
    }
    held += Math.max(0, auth.amount - captured);
  }
  return held;
}

function availableAt(state, userId, asOf, knownAt, replacement) {
  return balanceAt(state, userId, asOf, knownAt, replacement) - heldAt(state, userId, asOf, knownAt);
}

function chronologicalRows(state, knownAt, replacement) {
  return selectedPayments(state, knownAt, replacement).map(({ payment, revision }) => ({
    payment,
    revision,
    deltaFrom: deltaFor(payment, revision.amount, payment.from_user_id),
    instant: instant(revision.effective_at)
    })).sort((a, b) => compareInstant(a.instant, b.instant) || (a.payment.payment_id < b.payment.payment_id ? -1 : a.payment.payment_id > b.payment.payment_id ? 1 : 0));
}

function statement(state, userId, from, to, knownAt) {
  const rows = chronologicalRows(state, knownAt);
  let opening = state.opening_balances?.[userId] ?? 0;
  const inWindow = [];
  for (const row of rows) {
    const tFrom = from === null || compareInstant(row.revision.effective_at, from) >= 0;
    const tTo = compareInstant(row.revision.effective_at, to) < 0;
    const delta = deltaFor(row.payment, row.revision.amount, userId);
    if (from !== null && compareInstant(row.revision.effective_at, from) < 0) opening += delta;
    if (tFrom && tTo && (row.payment.from_user_id === userId || row.payment.to_user_id === userId)) {
      inWindow.push({ row, delta });
    }
  }
  let running = opening;
  const entries = inWindow.map(({ row, delta }) => {
    running += delta;
    return {
      payment: { ...row.payment, amount: row.revision.amount },
      delta,
      balance_after: running,
      revision: row.revision.revision,
      effective_at: row.revision.effective_at,
      recorded_at: row.revision.recorded_at
    };
  });
  let finalBalance = opening;
  for (const { row, delta } of inWindow) finalBalance += delta;
  return { opening_balance: opening, entries, closing_balance: finalBalance };
}

function historicalSafe(state, knownAt, replacement) {
  const points = new Map();
  const add = value => { if (validInstant(value)) points.set(value, instant(value)); };
  for (const { revision } of selectedPayments(state, knownAt, replacement)) add(revision.effective_at);
  for (const auth of state.authorizations || []) {
    add(auth.created_at || state.reset_at);
    add(auth.expires_at);
    add(auth.closed_at);
    for (const event of captureEvents(state, auth.authorization_id)) add(event.at);
  }
  add(knownAt);
  const ordered = [...points.keys()].sort(compareInstant);
  for (const user of state.users) {
    const opening = state.opening_balances?.[user.id] ?? 0;
    if (!Number.isSafeInteger(opening) || opening < 0) return false;
    for (const point of ordered) {
      const totalBefore = balanceBefore(state, user.id, point, knownAt, replacement);
      const availableBefore = totalBefore - heldBefore(state, user.id, point, knownAt);
      if (!Number.isSafeInteger(totalBefore) || totalBefore < 0 || !Number.isSafeInteger(availableBefore) || availableBefore < 0) return false;
      const total = balanceAt(state, user.id, point, knownAt, replacement);
      const available = total - heldAt(state, user.id, point, knownAt);
      if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(available) || available < 0) return false;
    }
    const nowAt = knownAt;
    const current = balanceAt(state, user.id, nowAt, knownAt, replacement);
    const available = current - heldAt(state, user.id, nowAt, knownAt);
    if (!Number.isSafeInteger(current) || current < 0 || !Number.isSafeInteger(available) || available < 0) return false;
  }
  return true;
}

module.exports = { instant, validInstant, compareInstant, selectedRevision, selectedPayments, balanceAt, balanceBefore, heldAt, heldBefore, availableAt, statement, historicalSafe };
