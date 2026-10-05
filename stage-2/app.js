(() => {
  'use strict';

  const root = document.getElementById('app');
  const state = {
    token: localStorage.getItem('pocketful-token') || '',
    me: null,
    route: location.pathname,
    refreshVersion: 0,
    pendingPay: null,
    lastPaidBody: null
  };

  class ApiError extends Error {
    constructor(status, code, message) { super(message || code || `Request failed (${status})`); this.status = status; this.code = code; }
  }

  function el(tag, options = {}, children = []) {
    const n = document.createElement(tag);
    for (const [key, value] of Object.entries(options)) {
      if (value === undefined || value === null) continue;
      if (key === 'text') n.textContent = value;
      else if (key === 'className') n.className = value;
      else if (key === 'testid') n.setAttribute('data-testid', value);
      else if (key === 'attrs') for (const [a, v] of Object.entries(value)) n.setAttribute(a, String(v));
      else if (key.startsWith('on') && typeof value === 'function') n.addEventListener(key.slice(2).toLowerCase(), value);
      else n.setAttribute(key, String(value));
    }
    for (const child of Array.isArray(children) ? children : [children]) if (child instanceof Node) n.append(child); else if (child !== null && child !== undefined) n.append(document.createTextNode(String(child)));
    return n;
  }

  function field(labelText, testid, type = 'text', value = '') {
    const id = `field-${testid}`;
    const input = el(type === 'select' ? 'select' : 'input', { id, testid, type: type === 'select' ? undefined : type, value, autocomplete: 'off' });
    return { wrap: el('div', { className: 'field' }, [el('label', { for: id, text: labelText }), input]), input };
  }

  function formCard(title, subtitle, fields, buttonId, buttonText) {
    const form = el('form', { className: 'card form-grid', novalidate: '' });
    form.append(el('h2', { text: title }));
    if (subtitle) form.append(el('p', { className: 'card-subtitle', text: subtitle }));
    for (const f of fields) form.append(f.wrap);
    form.append(el('button', { className: 'primary-button', type: 'submit', testid: buttonId, text: buttonText }));
    return form;
  }

  function feedback(where, testid, message, kind = 'error') {
    where.querySelector(`[data-testid="${testid}"]`)?.remove();
    if (!message) return;
    where.append(el('div', { className: `feedback ${kind}`, testid, role: 'alert', text: message }));
  }

  function clearFeedback(where, ...ids) { for (const id of ids) where.querySelector(`[data-testid="${id}"]`)?.remove(); }

  function formatMoney(value, minor, currency) {
    const units = BigInt(Math.trunc(Number(value)));
    const scale = 10n ** BigInt(minor);
    const whole = units / scale;
    const fraction = minor ? `.${String(units % scale).padStart(minor, '0')}` : '';
    return `${whole}${fraction} ${currency}`;
  }

  function parseMoney(value, minor) {
    const s = String(value);
    if (!/^\d+(?:\.\d+)?$/.test(s)) return null;
    const [whole, fraction = ''] = s.split('.');
    if (fraction.length > minor) return null;
    const units = BigInt(whole) * (10n ** BigInt(minor)) + BigInt((fraction + '0'.repeat(minor)).slice(0, minor) || '0');
    if (units > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(units);
  }

  function addLink(parent, label, href, active) {
    parent.append(el('a', { href, text: label, attrs: active ? { 'aria-current': 'page' } : {} }));
  }

  function navBar() {
    const header = el('header', { className: 'topbar' });
    const inner = el('div', { className: 'topbar-inner' });
    inner.append(el('a', { className: 'brand', href: '/', attrs: { 'aria-label': 'Pocketful home' } }, [el('span', { className: 'brand-mark', text: 'P' }), 'Pocketful']));
    const nav = el('nav', { className: 'nav', attrs: { 'aria-label': 'Main navigation' } });
    for (const [label, href] of [['Home','/'],['Requests','/requests'],['Split a bill','/split'],['Authorizations','/authorizations']]) addLink(nav, label, href, location.pathname === href);
    inner.append(nav);
    const account = el('div', { className: 'account' });
    if (state.me) {
      const copy = el('div', { className: 'account-copy' }, [el('span', { className: 'account-name', testid: 'current-user', text: state.me.display_name }), el('span', { className: 'account-handle', testid: 'current-handle', text: state.me.handle })]);
      account.append(copy, el('button', { className: 'quiet-button', type: 'button', testid: 'logout-button', text: 'Sign out', onclick: () => { state.token = ''; state.me = null; localStorage.removeItem('pocketful-token'); navigate('/login'); } }));
    } else {
      account.append(el('a', { className: 'button-link', href: '/login', text: 'Sign in' }), el('a', { className: 'button-link', href: '/signup', text: 'Create account' }));
    }
    inner.append(account); header.append(inner); return header;
  }

  function heading(eyebrow, title, detail) {
    return el('div', { className: 'page-heading' }, [el('div', { className: 'eyebrow', text: eyebrow }), el('h1', { text: title }), el('p', { text: detail })]);
  }

  function setWallet(target, me) {
    if (!target || !me) return;
    const refreshButton = target.querySelector('[data-testid="wallet-refresh"]');
    target.replaceChildren();
    target.append(el('div', { className: 'wallet-label', text: 'Available to spend' }));
    target.append(el('div', { className: 'wallet-primary', testid: 'wallet-available', attrs: { 'data-amount': me.available }, text: formatMoney(me.available, me.minor_units, me.currency) }));
    const secondary = el('div', { className: 'wallet-secondary' });
    secondary.append(el('div', {}, [el('span', { className: 'wallet-secondary-label', text: 'Total balance' }), el('span', { className: 'wallet-secondary-value', testid: 'wallet-balance', attrs: { 'data-amount': me.balance }, text: formatMoney(me.balance, me.minor_units, me.currency) })]));
    if (me.held > 0) secondary.append(el('div', {}, [el('span', { className: 'wallet-secondary-label', text: 'On hold' }), el('span', { className: 'wallet-secondary-value', testid: 'wallet-held', attrs: { 'data-amount': me.held }, text: formatMoney(me.held, me.minor_units, me.currency) })]));
    target.append(secondary);
    if (refreshButton) target.append(refreshButton);
  }

  function setActivity(target, payments) {
    if (!target) return;
    target.replaceChildren();
    if (!payments.length) { target.append(el('div', { className: 'empty-state', testid: 'empty-activity', text: 'Your activity will appear here.' })); return; }
    const list = el('div', { className: 'feed-list', testid: 'activity-list' });
    for (const p of payments) {
      const item = el('article', { className: 'activity-card', testid: `activity-item-${p.payment_id}`, attrs: { 'data-visibility': p.visibility } });
      item.append(el('div', { className: 'activity-top' }, [el('span', { className: 'activity-parties', testid: `activity-parties-${p.payment_id}`, text: `${p.from_handle} → ${p.to_handle}` }), el('span', { className: `visibility ${p.visibility}`, text: p.visibility })]));
      item.append(el('div', { className: 'activity-bottom' }, [el('span', { className: 'feed-amount', testid: `activity-amount-${p.payment_id}`, text: formatMoney(p.amount, state.me.minor_units, p.currency) }), el('time', { text: prettyDate(p.created_at), datetime: p.created_at })]));
      item.append(el('div', { className: 'activity-note', testid: `activity-note-${p.payment_id}`, text: p.note }));
      list.append(item);
    }
    target.append(list);
  }

  function prettyDate(value) {
    const d = new Date(value);
    return Number.isNaN(d.valueOf()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  }

  function setRequests(target, requests, mode = 'summary') {
    if (!target || !state.me) return;
    const incoming = requests.filter(r => r.payer_id === state.me.user_id);
    const outgoing = requests.filter(r => r.requester_id === state.me.user_id);
    if (mode === 'summary') {
      target.replaceChildren();
      const rows = [...incoming.slice(0, 3), ...outgoing.slice(0, 3)];
      if (!rows.length) { target.append(el('div', { className: 'empty-state', text: 'No open requests.' })); return; }
      for (const r of rows) target.append(el('div', { className: 'activity-card' }, [el('span', { className: 'request-parties', text: r.payer_id === state.me.user_id ? `From ${r.requester_handle}` : `To ${r.payer_handle}` }), el('strong', { text: formatMoney(r.amount, state.me.minor_units, r.currency) }), el('span', { className: `status-pill status-${r.status}`, text: r.status })]));
      return;
    }
    const inList = target.querySelector('[data-testid="incoming-list"]');
    const outList = target.querySelector('[data-testid="outgoing-list"]');
    target.querySelector('[data-testid="empty-requests"]')?.remove();
    if (!incoming.length && !outgoing.length) target.append(el('div', { className: 'empty-state', testid: 'empty-requests', text: 'No requests to show yet.' }));
    if (inList) fillRequestGroup(inList, incoming, true);
    if (outList) fillRequestGroup(outList, outgoing, false);
  }

  function fillRequestGroup(container, rows, incoming) {
    container.replaceChildren();
    if (!rows.length) { container.append(el('div', { className: 'empty-state', text: incoming ? 'Nothing to pay right now.' : 'No outgoing requests.' })); return; }
    const list = el('div', { className: 'request-list' });
    for (const r of rows) {
      const item = el('article', { className: 'request-card', testid: `request-item-${r.request_id}`, attrs: { 'data-status': r.status } });
      item.append(el('div', { className: 'request-meta' }, [el('div', {}, [el('div', { className: 'request-parties', text: incoming ? `Request from ${r.requester_handle}` : `Request to ${r.payer_handle}` }), el('div', { className: 'auth-amount', testid: `request-amount-${r.request_id}`, text: formatMoney(r.amount, state.me.minor_units, r.currency) })]), el('span', { className: `status-pill status-${r.status}`, text: r.status })]));
      if (r.note) item.append(el('div', { className: 'activity-note', text: r.note }));
      if (r.status === 'pending') {
        const actions = el('div', { className: 'inline-actions' });
        if (incoming) {
          actions.append(el('button', { className: 'primary-button', type: 'button', testid: `request-pay-${r.request_id}`, text: 'Pay request', onclick: () => requestAction(r, 'pay') }));
          actions.append(el('button', { className: 'secondary-button', type: 'button', testid: `request-decline-${r.request_id}`, text: 'Decline', onclick: () => requestAction(r, 'decline') }));
        } else actions.append(el('button', { className: 'danger-button', type: 'button', testid: `request-cancel-${r.request_id}`, text: 'Cancel request', onclick: () => requestAction(r, 'cancel') }));
        item.append(actions);
      }
      list.append(item);
    }
    container.append(list);
  }

  async function api(url, { method = 'GET', body, key, token = state.token } = {}) {
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (key) headers['Idempotency-Key'] = key;
    const response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (response.status === 204) return { status: 204, body: null };
    let data;
    try { data = await response.json(); } catch { data = null; }
    if (!response.ok) throw new ApiError(response.status, data?.error?.code, data?.error?.message);
    return { status: response.status, body: data };
  }

  async function refreshVisible() {
    if (!state.token) return;
    const version = ++state.refreshVersion;
    const route = state.route;
    let results;
    try {
      results = await Promise.all([
        api('/me'), api('/activity?limit=50'), api('/requests?limit=50'), api('/authorizations?limit=50')
      ]);
    } catch (err) {
      if (version === state.refreshVersion && route === state.route) throw err;
      return;
    }
    const [meResult, activityResult, requestResult, authResult] = results;
    if (version !== state.refreshVersion || route !== state.route) return;
    state.me = meResult.body;
    setWallet(document.getElementById('wallet-slot'), state.me);
    setActivity(document.getElementById('activity-slot'), activityResult.body.payments);
    const requestSlot = document.getElementById('request-summary-slot');
    if (requestSlot) setRequests(requestSlot, requestResult.body.requests, 'summary');
    const reqIn = document.querySelector('[data-testid="incoming-list"]');
    if (reqIn) setRequests(reqIn.parentElement.parentElement, requestResult.body.requests, 'full');
    const authSlot = document.getElementById('authorization-slot');
    if (authSlot) renderAuthorizationsInto(authSlot, authResult.body.authorizations);
    const capButtons = document.querySelectorAll('[data-testid^="authorization-capture-"]');
    if (capButtons.length && route === '/authorizations') renderAuthorizationsInto(document.getElementById('authorization-slot'), authResult.body.authorizations);
  }

  function mainPage(title, eyebrow, description) {
    const main = el('main', { className: 'main' });
    main.append(heading(eyebrow, title, description));
    root.append(navBar(), main, el('footer', { className: 'footer', text: 'Pocketful · Money moves with clarity.' }));
    return main;
  }

  function walletCard() { return el('section', { className: 'card wallet-card', id: 'wallet-slot', 'aria-label': 'Wallet balance' }, [el('div', { className: 'loading-inline', text: 'Loading your wallet…' })]); }

  function renderHome(main) {
    const grid = el('div', { className: 'grid' });
    const left = el('div', { className: 'stack' });
    const wallet = walletCard();
    wallet.append(el('button', { className: 'wallet-refresh', type: 'button', testid: 'wallet-refresh', text: 'Refresh balance and activity', onclick: () => refreshVisible().catch(showGlobalError) }));
    left.append(wallet);
    const handle = field('Recipient handle', 'pay-handle'); handle.input.autocapitalize = 'none'; handle.input.placeholder = 'e.g. jordan';
    const amount = field('Amount', 'pay-amount', 'text'); amount.input.inputMode = 'decimal'; amount.input.placeholder = state.me ? (state.me.minor_units ? `0.${'0'.repeat(state.me.minor_units)}` : '0') : '0.00';
    const note = field('Note (optional)', 'pay-note');
    const visibility = field('Visibility', 'pay-visibility', 'select');
    for (const [v,label] of [['public','Public activity'],['private','Private']]) visibility.input.append(el('option', { value: v, text: label }));
    const pay = formCard('Send money', 'A direct, instant transfer to a Pocketful handle.', [handle,amount,note,visibility], 'pay-submit', 'Send payment');
    pay.addEventListener('submit', async e => {
      e.preventDefault(); clearFeedback(pay, 'pay-error', 'pay-uncertain', 'pay-success');
      const minor = state.me?.minor_units ?? 2, amountMinor = parseMoney(amount.input.value, minor);
      if (amountMinor === null) { feedback(pay, 'pay-error', `Enter a valid amount with no more than ${minor} decimal places.`); return; }
      const body = { to_handle: handle.input.value, amount: amountMinor, note: note.input.value, visibility: visibility.input.value };
      const signature = JSON.stringify(body);
      if (state.lastPaidBody === signature) { await refreshVisible().catch(showGlobalError); feedback(pay, 'pay-success', 'This payment was already sent. Your balance and activity are up to date.', 'success'); return; }
      if (!state.pendingPay || state.pendingPay.signature !== signature) state.pendingPay = { signature, key: crypto.randomUUID() };
      try {
        await api('/payments', { method: 'POST', body, key: state.pendingPay.key });
        state.lastPaidBody = signature; state.pendingPay = null; clearFeedback(pay, 'pay-error', 'pay-uncertain');
        await refreshVisible(); feedback(pay, 'pay-success', 'Payment sent. Your balance and activity are up to date.', 'success');
      } catch (err) {
        if (err instanceof ApiError) {
          const message = err.code === 'insufficient_funds'
            ? 'Not enough available balance for this payment.'
            : err.message || 'Your payment could not be sent.';
          feedback(pay, 'pay-error', message);
          await refreshVisible().catch(showGlobalError);
        } else feedback(pay, 'pay-uncertain', 'We could not confirm the result. Retry without changing the form to safely check the payment.', 'uncertain');
      }
    });
    left.append(pay);

    const right = el('div', { className: 'stack' });
    const reqHandle = field('Ask for payment from', 'request-handle'); reqHandle.input.placeholder = 'e.g. jordan';
    const reqAmount = field('Amount', 'request-amount'); reqAmount.input.inputMode = 'decimal'; reqAmount.input.placeholder = '0.00';
    const reqNote = field('Note (optional)', 'request-note');
    const requestForm = formCard('Request money', 'Ask someone to pay you. They can respond when ready.', [reqHandle,reqAmount,reqNote], 'request-submit', 'Send request');
    requestForm.addEventListener('submit', async e => {
      e.preventDefault(); clearFeedback(requestForm, 'request-error', 'request-success');
      const amountMinor = parseMoney(reqAmount.input.value, state.me?.minor_units ?? 2);
      if (amountMinor === null) { feedback(requestForm, 'request-error', `Enter a valid amount with no more than ${(state.me?.minor_units ?? 2)} decimal places.`); return; }
      try { await api('/requests', { method: 'POST', body: { payer_handle: reqHandle.input.value, amount: amountMinor, note: reqNote.input.value }, key: crypto.randomUUID() }); clearFeedback(requestForm, 'request-error'); await refreshVisible(); feedback(requestForm, 'request-success', 'Request sent. Your lists are up to date.', 'success'); }
      catch (err) { feedback(requestForm, 'request-error', err.message || 'The request could not be sent.'); await refreshVisible().catch(showGlobalError); }
    });
    right.append(requestForm);
    const authHandle = field('Recipient handle', 'authorize-handle'); authHandle.input.placeholder = 'e.g. jordan';
    const authAmount = field('Amount to reserve', 'authorize-amount'); authAmount.input.inputMode = 'decimal'; authAmount.input.placeholder = '0.00';
    const authNote = field('Note (optional)', 'authorize-note');
    const authVis = field('Visibility after capture', 'authorize-visibility', 'select');
    for (const [v,label] of [['public','Public activity'],['private','Private']]) authVis.input.append(el('option', { value: v, text: label }));
    const authorizeForm = formCard('Reserve for later', 'Set aside money for a recipient to collect in one or more captures.', [authHandle,authAmount,authNote,authVis], 'authorize-submit', 'Create authorization');
    authorizeForm.addEventListener('submit', async e => {
      e.preventDefault(); clearFeedback(authorizeForm, 'authorize-error', 'authorize-success');
      const amountMinor = parseMoney(authAmount.input.value, state.me?.minor_units ?? 2);
      if (amountMinor === null) { feedback(authorizeForm, 'authorize-error', `Enter a valid amount with no more than ${(state.me?.minor_units ?? 2)} decimal places.`); return; }
      try { await api('/authorizations', { method: 'POST', body: { to_handle: authHandle.input.value, amount: amountMinor, note: authNote.input.value, visibility: authVis.input.value }, key: crypto.randomUUID() }); clearFeedback(authorizeForm, 'authorize-error'); await refreshVisible(); feedback(authorizeForm, 'authorize-success', 'Authorization created. The reserved amount is reflected in your available balance.', 'success'); }
      catch (err) { feedback(authorizeForm, 'authorize-error', err.message || 'The authorization could not be created.'); await refreshVisible().catch(showGlobalError); }
    });
    right.append(authorizeForm);
    grid.append(left,right); main.append(grid);
    const bottom = el('div', { className: 'grid', style: 'margin-top:22px' });
    bottom.append(el('section', { className: 'card' }, [el('div', { className: 'section-head' }, [el('h2', { text: 'Recent activity' }), el('span', { className: 'table-caption', text: 'Visible to you' })]), el('div', { id: 'activity-slot' }, [el('div', { className: 'loading-inline', text: 'Loading activity…' })])]));
    bottom.append(el('section', { className: 'card' }, [el('div', { className: 'section-head' }, [el('h2', { text: 'Your requests' }), el('a', { className: 'button-link', href: '/requests', text: 'View all' })]), el('div', { id: 'request-summary-slot' }, [el('div', { className: 'loading-inline', text: 'Loading requests…' })])]));
    main.append(bottom);
    refreshVisible().catch(showGlobalError);
  }

  async function requestAction(request, action) {
    const errArea = document.getElementById('request-error-area');
    if (errArea) clearFeedback(errArea, 'request-error');
    const suffix = action === 'pay' ? '/pay' : `/${action}`;
    try {
      await api(`/requests/${encodeURIComponent(request.request_id)}${suffix}`, { method: 'POST', ...(action === 'pay' ? { body: {}, key: crypto.randomUUID() } : {}) });
      if (errArea) clearFeedback(errArea, 'request-error');
    } catch (err) {
      if (errArea) feedback(errArea, 'request-error', err.message || 'This request could not be updated.');
    }
    await refreshVisible().catch(showGlobalError);
  }

  function renderRequestsPage(main) {
    const grid = el('div', { className: 'grid' });
    const requestCard = el('section', { className: 'card' });
    requestCard.append(el('div', { id: 'request-error-area' }));
    const columns = el('div', { className: 'two-columns' });
    const incoming = el('section'); incoming.append(el('h2', { text: 'Incoming' }), el('div', { testid: 'incoming-list', id: 'incoming-list' }));
    const outgoing = el('section'); outgoing.append(el('h2', { text: 'Outgoing' }), el('div', { testid: 'outgoing-list', id: 'outgoing-list' }));
    columns.append(incoming,outgoing); requestCard.append(columns);
    const side = el('div', { className: 'stack' });
    side.append(el('section', { className: 'card wallet-card', id: 'wallet-slot' }, [el('div', { className: 'loading-inline', text: 'Loading your wallet…' })]));
    side.append(el('section', { className: 'card' }, [el('h2', { text: 'Recent activity' }), el('div', { id: 'activity-slot' })]));
    grid.append(requestCard,side); main.append(grid);
    refreshVisible().catch(showGlobalError);
  }

  function showGlobalError(err) {
    const main = root.querySelector('main'); if (!main) return;
    let slot = main.querySelector('#global-error'); if (!slot) { slot = el('div', { id: 'global-error' }); main.prepend(slot); }
    feedback(slot, 'global-error-message', err.message || 'Pocketful is having trouble connecting.');
  }

  function renderSplitPage(main) {
    const amount = field('Total bill', 'split-amount'); amount.input.inputMode = 'decimal'; amount.input.placeholder = '0.00';
    const handles = field('Participants', 'split-handles'); handles.input.placeholder = 'ada, bob, cy';
    const note = field('What was this for? (optional)', 'split-note');
    const preview = el('div', { className: 'split-preview', testid: 'split-preview' }, [el('span', { className: 'table-caption', text: 'Add an amount and participants to preview equal shares.' })]);
    const form = formCard('Split a bill', 'Share the cost in the order you enter the handles. Each person gets a request.', [amount,handles,note], 'split-submit', 'Create split');
    form.insertBefore(preview, form.querySelector('[data-testid="split-submit"]'));
    const updatePreview = () => {
      preview.replaceChildren();
      const units = parseMoney(amount.input.value, state.me?.minor_units ?? 2);
      const participants = handles.input.value.split(',').map(x=>x.trim()).filter(Boolean);
      if (units === null || !participants.length || new Set(participants).size !== participants.length) { preview.append(el('span', { className: 'table-caption', text: 'Enter a valid amount and unique handles to preview the shares.' })); return; }
      const base = Math.floor(units / participants.length), extra = units % participants.length;
      for (let i=0; i<participants.length; i++) preview.append(el('div', { className: 'split-share' }, [el('span', { text: participants[i] }), el('strong', { testid: `split-share-${participants[i]}`, text: formatMoney(base+(i<extra?1:0), state.me?.minor_units ?? 2, state.me?.currency ?? 'EUR') })]));
    };
    amount.input.addEventListener('input', updatePreview); handles.input.addEventListener('input', updatePreview);
    form.addEventListener('submit', async e => {
      e.preventDefault(); clearFeedback(form,'split-error');
      const units = parseMoney(amount.input.value,state.me?.minor_units??2), participants=handles.input.value.split(',').map(x=>x.trim()).filter(Boolean);
      if(units===null){feedback(form,'split-error',`Enter a valid amount with no more than ${(state.me?.minor_units??2)} decimal places.`);return;}
      try {
        const result=await api('/splits',{method:'POST',body:{amount:units,participant_handles:participants,note:note.input.value},key:crypto.randomUUID()});
        const receipt=el('section',{className:'card',id:'split-result'},[el('h2',{text:'Split created'}),el('div',{className:'split-preview'},result.body.shares.map(x=>el('div',{className:'split-share'},[el('span',{text:x.handle}),el('strong',{text:formatMoney(x.amount,state.me.minor_units,state.me.currency)})])))]);
        main.querySelector('#split-result')?.remove();main.append(receipt);clearFeedback(form,'split-error');await refreshVisible();
      }catch(err){feedback(form,'split-error',err.message||'The split could not be created.');}
    });
    const grid=el('div',{className:'grid'});grid.append(form,el('div',{className:'stack'},[el('section',{className:'card wallet-card',id:'wallet-slot'},[el('div',{className:'loading-inline',text:'Loading your wallet…'})]),el('section',{className:'card'},[el('h2',{text:'Your requests'}),el('div',{id:'request-summary-slot'})]) ]));main.append(grid);
    main.append(el('section',{className:'card',style:'margin-top:22px'},[el('h2',{text:'Recent activity'}),el('div',{id:'activity-slot'})]));
    updatePreview();refreshVisible().catch(showGlobalError);
  }

  function renderAuthorizationsInto(target, authorizations) {
    if(!target)return;target.replaceChildren();
    const list=el('div',{className:'authorization-list',testid:'authorization-list'});
    if(!authorizations.length){list.append(el('div',{className:'empty-state',testid:'empty-authorizations',text:'No authorizations yet.'}));target.append(list);return;}
    for(const a of authorizations){
      const item=el('article',{className:'authorization-card',testid:`authorization-item-${a.authorization_id}`,attrs:{'data-status':a.status}});
      item.append(el('div',{className:'authorization-top'},[el('div',{},[el('div',{className:'request-parties',text:`${a.from_handle} reserved for ${a.to_handle}`}),el('strong',{className:'auth-amount',testid:`authorization-amount-${a.authorization_id}`,text:formatMoney(a.amount,state.me.minor_units,a.currency)})]),el('span',{className:`status-pill status-${a.status}`,text:a.status})]));
      if(a.status==='captured')item.append(el('div',{className:'captured-amount'},[el('span',{text:'Captured'}),el('strong',{testid:`authorization-captured-${a.authorization_id}`,text:formatMoney(a.captured_amount,state.me.minor_units,a.currency)})]));
      item.append(el('div',{className:'authorization-expiry'},[
        el('span',{className:'authorization-expiry-label',text:'Expires'}),
        el('span',{className:'authorization-expiry-human',text:prettyDate(a.expires_at)}),
        el('time',{className:'authorization-expiry-iso',testid:`authorization-expires-${a.authorization_id}`,datetime:a.expires_at,text:a.expires_at})
      ]));
      if(a.note)item.append(el('div',{className:'activity-note',text:a.note}));
      const actions=el('div',{id:`authorization-actions-${a.authorization_id}`});
      if(a.status==='open'&&a.to_user_id===state.me.user_id){
        const form=el('form',{className:'capture-form'}),f=field('Capture amount',`authorization-capture-amount-${a.authorization_id}`);f.input.inputMode='decimal';f.input.value=formatDecimal(a.remaining_amount,state.me.minor_units);form.append(f.wrap,el('button',{className:'primary-button',type:'submit',testid:`authorization-capture-${a.authorization_id}`,text:'Capture'}));
        form.addEventListener('submit',async e=>{e.preventDefault();const errorArea=document.getElementById('authorization-error-area')||item;clearFeedback(errorArea,'authorization-error');const amount=parseMoney(f.input.value,state.me.minor_units);if(amount===null){feedback(errorArea,'authorization-error',`Enter a valid amount with no more than ${state.me.minor_units} decimal places.`);return;}try{await api(`/authorizations/${encodeURIComponent(a.authorization_id)}/capture`,{method:'POST',body:{amount,final:true},key:crypto.randomUUID()});clearFeedback(errorArea,'authorization-error');await refreshVisible();}catch(err){feedback(errorArea,'authorization-error',err.message||'Capture refused.');await refreshVisible().catch(showGlobalError);}});
        actions.append(form);
      } else if(a.status==='open'&&a.from_user_id===state.me.user_id) actions.append(el('button',{className:'danger-button',type:'button',testid:`authorization-void-${a.authorization_id}`,text:'Release hold',onclick:async()=>{const errorArea=document.getElementById('authorization-error-area')||item;clearFeedback(errorArea,'authorization-error');try{await api(`/authorizations/${encodeURIComponent(a.authorization_id)}/void`,{method:'POST'});await refreshVisible();}catch(err){feedback(errorArea,'authorization-error',err.message||'The hold could not be released.');await refreshVisible().catch(showGlobalError);}}}));
      if(actions.childNodes.length)item.append(actions);
      list.append(item);
    }
    target.append(list);
  }

  function formatDecimal(amount, minor) {
    const scale=10n**BigInt(minor),n=BigInt(Math.trunc(amount));return minor?`${n/scale}.${String(n%scale).padStart(minor,'0')}`:String(n);
  }

  function renderAuthorizationsPage(main) {
    const grid=el('div',{className:'grid'});
    grid.append(el('section',{className:'card wallet-card',id:'wallet-slot'},[el('div',{className:'loading-inline',text:'Loading your wallet…'})]));
    const side=el('section',{className:'card'});side.append(el('div',{className:'section-head'},[el('h2',{text:'Your authorizations'}),el('span',{className:'table-caption',text:'Newest first'})]),el('div',{id:'authorization-error-area'}),el('div',{id:'authorization-slot'},[el('div',{className:'loading-inline',text:'Loading authorizations…'})]));
    grid.append(side);main.append(grid);
    const lower=el('div',{className:'grid',style:'margin-top:22px'});
    lower.append(el('section',{className:'card'},[el('h2',{text:'Recent activity'}),el('div',{id:'activity-slot'})]));
    lower.append(el('section',{className:'card'},[el('h2',{text:'Your requests'}),el('div',{id:'request-summary-slot'})]));
    main.append(lower);
    refreshVisible().catch(showGlobalError);
  }

  function renderAuthPage(main, kind) {
    const signup=kind==='signup',fields=[];
    if(signup){const display=field('Display name','signup-display-name');display.input.autocomplete='name';fields.push(display);}
    const email=field('Email address',signup?'signup-email':'login-email','email');email.input.autocomplete='email';fields.push(email);
    const password=field('Password',signup?'signup-password':'login-password','password');password.input.autocomplete=signup?'new-password':'current-password';fields.push(password);
    const form=formCard(signup?'Create your Pocketful account':'Welcome back',signup?'A thoughtful home for the money you share.':'Sign in to see your balance and activity.',fields,signup?'signup-submit':'login-submit',signup?'Create account':'Sign in');
    form.addEventListener('submit',async e=>{e.preventDefault();clearFeedback(form,'auth-error');const body={email:email.input.value,password:password.input.value};if(signup)body.display_name=fields[0].input.value;try{const result=await api(`/auth/${signup?'signup':'login'}`,{method:'POST',body,token:''});state.token=result.body.token;state.me=null;localStorage.setItem('pocketful-token',state.token);navigate('/');}catch(err){feedback(form,'auth-error',err.message||'We could not sign you in.');}});
    const foot=signup?el('p',{className:'auth-foot'},['Already have an account? ',el('a',{href:'/login',text:'Sign in'})]):el('p',{className:'auth-foot'},['New to Pocketful? ',el('a',{href:'/signup',text:'Create an account'})]);
    const wrap=el('div',{className:'auth-wrap'},[el('a',{className:'brand auth-brand',href:'/'},[el('span',{className:'brand-mark',text:'P'}),'Pocketful']),form,foot]);
    main.append(wrap);
  }

  function navigate(path) { if(location.pathname!==path)history.pushState({},'',path); render(path); }

  async function render(path=location.pathname) {
    state.route=path;
    root.replaceChildren();
    state.me=null;
    if(state.token){try{state.me=(await api('/me')).body;}catch(err){if(err instanceof ApiError&&err.status===401){state.token='';localStorage.removeItem('pocketful-token');}else state.me=null;}}
    root.replaceChildren();
    const main=el('main',{className:'main'});
    root.append(navBar());
    const footer=el('footer',{className:'footer',text:'Pocketful · Money moves with clarity.'});
    root.append(main,footer);
    if(path==='/login'||path==='/signup'){renderAuthPage(main,path.slice(1));return;}
    if(path==='/requests'){main.append(heading('Stay in sync','Requests','Review what you owe and what others owe you. Decide when a request works for you.'));renderRequestsPage(main);return;}
    if(path==='/split'){main.append(heading('Share fairly','Split a bill','Turn a shared cost into a clear breakdown and individual requests.'));renderSplitPage(main);return;}
    if(path==='/authorizations'){main.append(heading('Money on hold','Authorizations','Reserve money securely, then capture what is owed or release the rest.'));renderAuthorizationsPage(main);return;}
    if(path==='/'){main.append(heading('Your money, at a glance','Good to see you','Send money, request a payment, or reserve funds for a later capture.'));renderHome(main);return;}
    main.append(heading('Not found','That page is unavailable','Choose a screen from the navigation above.'));
  }

  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href]');if(!a||a.origin!==location.origin)return;
    if(a.pathname==='/app.js'||a.pathname==='/styles.css')return;
    e.preventDefault();navigate(a.pathname);
  });
  window.addEventListener('popstate',()=>render(location.pathname));

  render().catch(showGlobalError);
})();
