import { api, postJson, patchJson, del, ApiError } from './js/api.js';
import { icon } from './js/icons.js';
import { debounce, clampQuantity, validators, escapeHtml } from './js/utils.js';
import * as v from './js/views.js';

const state = {
  user: null,
  session: null,
  categories: [],
  cart: null,
  
  authModal: null,
  authReturnHash: null,
  quickView: null,
  confirm: null,
  navOpen: false,
  filtersOpen: false,
  
  tb: { messages: [], open: false, busy: false },
};

const root = document.querySelector('#app');
const toastRoot = document.querySelector('#toast-root');
let appMounted = false;
let bootFailureShown = false;

function showFatalBoot(error) {
  if (bootFailureShown) return;
  bootFailureShown = true;
  const message = error?.message || 'Không thể khởi động giao diện TechGear.';
  root.innerHTML = `
    <section class="boot-error" role="alert">
      <div class="boot-error__card">
        <strong>TechGear chưa thể tải giao diện</strong>
        <p>${escapeHtml(message)}</p>
        <button class="btn btn--primary" type="button" data-boot-retry>Thử lại</button>
      </div>
    </section>`;
  root.querySelector('[data-boot-retry]')?.addEventListener('click', () => window.location.reload());
}

function markAppMounted() {
  appMounted = true;
  document.body.classList.remove('is-booting');
}

window.addEventListener('error', (event) => {
  if (!appMounted && event.error) showFatalBoot(event.error);
});
window.addEventListener('unhandledrejection', (event) => {
  if (!appMounted && event.reason) showFatalBoot(event.reason);
});

// Real product photography is preferred; fall back only to a neutral image state
// when a remote product photo is temporarily unavailable.
root.addEventListener('error', (event) => {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || !img.matches('[data-product-image]')) return;
  const media = img.closest('[data-product-media]');
  if (!media || media.classList.contains('is-fallback')) return;
  media.classList.add('is-fallback');
}, true);

function renderShell(content) {
  const current = route();
  root.innerHTML = `
    ${v.header(state, current)}
    <main id="main-content" tabindex="-1">${content}</main>
    ${v.footer(state)}
    ${state.navOpen ? v.navDrawer(state, current) : ''}
    ${state.authModal ? v.authModal(state.authModal) : ''}
    ${state.quickView ? v.quickViewModal(state.quickView) : ''}
    ${state.confirm ? v.confirmModal(state.confirm) : ''}
    ${current.path !== '/techbot' ? v.techbotWidget(state.tb, !state.tb.open) : ''}
  `;
  markAppMounted();
  bindEvents();
  const modalOpen = Boolean(state.authModal || state.quickView || state.confirm || state.navOpen);
  document.body.classList.toggle('has-modal', modalOpen);
  if (state.authModal) {
    requestAnimationFrame(() => {
      const first = document.querySelector(state.authModal === 'register' ? '#reg-name' : '#login-email');
      first?.focus();
    });
  }
}

// -----------------------------------------------------------------------------
// Toast & Notifications
// -----------------------------------------------------------------------------
let toastTimer;
function toast(message, type = 'success') {
  if (!toastRoot) return;
  const icon = type === 'success' ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
    : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  
  toastRoot.innerHTML = `<div class="toast toast--${type}" role="alert">${icon}<span>${escapeHtml(message)}</span></div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastRoot.innerHTML = ''; }, 3000);
}

// -----------------------------------------------------------------------------
// Core Actions
// -----------------------------------------------------------------------------
function go(hash) { window.location.hash = hash; }
function route() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [pathPart, queryString = ''] = raw.split('?');
  return { path: pathPart || '/', query: new URLSearchParams(queryString) };
}

async function loadSession() {
  try {
    const res = await api('/auth/me');
    state.user = res.data.user;
    state.session = res.data.session;
    try { state.cart = (await api('/cart')).data; } catch { state.cart = null; }
  } catch {
    state.user = null; state.session = null; state.cart = null;
  }
}

async function loadCategories() {
  try { state.categories = (await api('/categories')).data; } catch {}
}

async function ensureCart() {
  if (!state.user) return false;
  try { state.cart = (await api('/cart')).data; return true; }
  catch { state.cart = null; return false; }
}

async function addToCart(productId, qty, { redirectToCheckout = false } = {}) {
  if (!state.user) {
    state.navOpen = false;
    state.authReturnHash = window.location.hash || '#/';
    state.authModal = 'login';
    render();
    toast('Vui lòng đăng nhập để mua hàng.', 'error');
    return false;
  }
  try {
    await postJson('/cart/items', { productId: Number(productId), quantity: Number(qty) });
    await ensureCart();
    state.quickView = null;
    if (redirectToCheckout) {
      go('#/checkout');
    } else {
      render();
    }
    toast('Đã thêm vào giỏ hàng');
    return true;
  } catch (error) {
    toast(error.message || 'Không thể thêm sản phẩm', 'error');
    return false;
  }
}

async function logout() {
  try { await postJson('/auth/logout'); } catch {}
  state.user = null; state.session = null; state.cart = null; state.navOpen = false;
  toast('Đã đăng xuất');
  go('#/');
}

// -----------------------------------------------------------------------------
// Views & Routing
// -----------------------------------------------------------------------------
async function render() {
  const current = route();
  const path = current.path;
  const q = current.query;
  window.scrollTo(0, 0);
  
  try {
    if (path === '/') {
      renderShell(v.loadingPage('grid'));
      const [newest, cheapest, premium] = await Promise.all([
        api('/products?sort=newest&pageSize=4').then(r => r.data).catch(()=>[]),
        api('/products?sort=price_asc&pageSize=4').then(r => r.data).catch(()=>[]),
        api('/products?sort=price_desc&pageSize=4').then(r => r.data).catch(()=>[])
      ]);
      renderShell(v.homeView(state, { newest, cheapest, premium }));
      return;
    }

    if (path === '/products') {
      renderShell(v.loadingPage('grid'));
      const params = Object.fromEntries(q.entries());
      params.page = params.page || 1;
      params.pageSize = v.PAGE_SIZE;
      params.sort = params.sort || 'newest';
      
      const queryStr = new URLSearchParams(params).toString();
      const res = await api(`/products?${queryStr}`);
      renderShell(v.productsView(state, params, res));
      return;
    }

    if (path.startsWith('/products/') && path.split('/').length === 3) {
      renderShell(v.loadingPage('detail'));
      const id = path.split('/')[2];
      const res = await api(`/products/${id}`);
      let related = [];
      try { related = (await api(`/products?category=${res.data.category?.slug}&pageSize=4`)).data.filter(p => String(p.id) !== id).slice(0, 4); } catch {}
      renderShell(v.productDetailView(res.data, related));
      return;
    }

    if (path === '/cart') {
      await ensureCart();
      renderShell(v.cartView(state));
      return;
    }

    if (path === '/checkout') {
      await ensureCart();
      renderShell(v.checkoutView(state));
      return;
    }

    if (path === '/orders') {
      if (!state.user) { renderShell(v.ordersView(state, [], 'all')); return; }
      renderShell(v.loadingPage('panel'));
      const filter = q.get('filter') || 'all';
      let orders = [];
      try { orders = (await api('/orders')).data; } catch {}
      renderShell(v.ordersView(state, orders, filter));
      return;
    }

    if (path.startsWith('/orders/') && path.split('/').length === 3) {
      if (!state.user) { go('#/orders'); return; }
      renderShell(v.loadingPage('detail'));
      const id = path.split('/')[2];
      const res = await api(`/orders/${id}`);
      renderShell(v.orderDetailView(res.data, q.get('payment') || ''));
      return;
    }

    if (path === '/account') {
      if (!state.user) { go('#/'); return; }
      renderShell(v.loadingPage('panel'));
      let orders = [];
      try { orders = (await api('/orders')).data; } catch {}
      renderShell(v.accountView(state, orders.slice(0, 3)));
      return;
    }

    if (path === '/techbot') {
      renderShell(v.techbotView(state.tb));
      // scroll bot messages
      const msgs = document.querySelector('[data-techbot-messages]');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
      return;
    }

    if (path === '/policies') {
      renderShell(v.policiesView());
      return;
    }

    if (path === '/payment-result') {
      const orderId = q.get('order');
      const status = q.get('status') || 'invalid';
      const code = q.get('code') || '';
      if (orderId) { go(`#/orders/${orderId}?payment=${status}&code=${code}`); return; }
      renderShell(v.paymentResultView(status, code));
      return;
    }

    // 404
    renderShell(v.notFoundView());
    
  } catch (error) {
    if (error.status === 401 && ['/account', '/checkout', '/orders'].includes(path)) {
      state.user = null; state.session = null; state.cart = null;
      state.authReturnHash = window.location.hash || '#/';
      state.authModal = 'login';
      go('#/');
      toast('Vui lòng đăng nhập', 'error');
      return;
    }
    renderShell(v.errorState(error));
  }
}

// -----------------------------------------------------------------------------
// Events & Forms
// -----------------------------------------------------------------------------
// Global Event Delegation (Bind once)
const bodyClick = async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  
  // Auth & Overlays
  if (action === 'open-auth') {
    state.navOpen = false;
    state.authReturnHash = btn.dataset.returnTo || state.authReturnHash || window.location.hash || '#/';
    state.authModal = btn.dataset.mode;
    render();
    return;
  }
  if (action === 'close-overlay') { state.authModal = null; state.authReturnHash = null; state.quickView = null; state.navOpen = false; state.confirm = null; render(); }
  if (action === 'open-nav') { state.navOpen = true; render(); }
  if (action === 'logout') { await logout(); }
  
  // Cart & Products
  if (action === 'add-to-cart') {
    btn.disabled = true;
    const qtyInput = btn.dataset.qtyInput ? document.getElementById(btn.dataset.qtyInput) : null;
    const qty = qtyInput ? clampQuantity(qtyInput.value) : 1;
    const ok = await addToCart(btn.dataset.productId, qty);
    if (!ok && btn.isConnected) btn.disabled = false;
  }
  if (action === 'buy-now') {
    const qtyInput = btn.dataset.qtyInput ? document.getElementById(btn.dataset.qtyInput) : null;
    const qty = qtyInput ? clampQuantity(qtyInput.value, qtyInput.max) : 1;
    btn.disabled = true;
    await addToCart(btn.dataset.productId, qty, { redirectToCheckout: true });
    return;
  }

  if (action === 'quick-view') {
    try { state.quickView = (await api(`/products/${btn.dataset.productId}`)).data; render(); }
    catch(err) { toast('Không thể tải thông tin', 'error'); }
  }
  if (action === 'qty-step') {
    const input = document.getElementById(btn.dataset.target);
    if (input) {
      input.value = clampQuantity(Number(input.value || 1) + Number(btn.dataset.step || 0), input.max);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  if (action === 'cart-remove') {
    const itemId = btn.dataset.itemId || btn.dataset.id;
    state.confirm = { title: 'Xóa khỏi giỏ hàng', message: 'Bạn có chắc muốn xóa sản phẩm này khỏi giỏ?', confirmLabel: 'Xóa', actionData: itemId };
    render();
    return;
  }
  if (action === 'confirm-yes' && state.confirm) {
    const itemId = state.confirm.actionData;
    state.confirm = null;
    render();
    try {
      await del(`/cart/items/${itemId}`);
      await ensureCart();
      render();
      toast('Đã xóa sản phẩm');
    } catch (err) { toast('Không thể xóa', 'error'); }
  }
  if (action === 'cart-update') {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const newQty = clampQuantity(input.value, input.max);
    try {
      btn.disabled = true;
      await patchJson(`/cart/items/${btn.dataset.id}`, { quantity: newQty });
      await ensureCart();
      render();
    } catch(err) { toast(err.message, 'error'); btn.disabled = false; }
  }
  
  // Cart quantity controls
  if (action === 'cart-step' || action === 'cart-set') {
    const itemId = btn.dataset.itemId;
    const row = btn.closest('.cart-item');
    const input = row?.querySelector('.qty__input[data-item-id]') || document.querySelector(`.qty__input[data-item-id="${itemId}"]`);
    if (!itemId || !input) return;
    let newQty = Number(input.value || 1);
    if (action === 'cart-step') newQty += Number(btn.dataset.step || 0);
    newQty = clampQuantity(newQty, input.max);
    input.value = newQty;
    try {
      row?.classList.add('is-updating');
      await patchJson(`/cart/items/${itemId}`, { quantity: newQty });
      await ensureCart();
      render();
    } catch (err) {
      toast(err.message || 'Không thể cập nhật giỏ hàng', 'error');
      input.value = newQty;
    } finally { row?.classList.remove('is-updating'); }
    return;
  }

  // UI Interactions
  if (action === 'toggle-password') {
    const target = document.getElementById(btn.dataset.target);
    if (target) {
      const isText = target.type === 'text';
      target.type = isText ? 'password' : 'text';
      btn.innerHTML = isText ? icon('eye', 18) : icon('eyeOff', 18);
      btn.setAttribute('aria-pressed', !isText);
    }
  }
  if (action === 'toggle-account-menu') {
    const menu = btn.closest('[data-account-menu]');
    if (menu) {
      const active = menu.classList.toggle('is-active');
      btn.setAttribute('aria-expanded', String(active));
    }
  }
  if (action === 'tab') {
    document.querySelectorAll('[data-action="tab"]').forEach(t => t.classList.remove('is-active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.hidden = true);
    btn.classList.add('is-active');
    const panel = document.getElementById(btn.dataset.tab);
    if (panel) panel.hidden = false;
  }
  if (action === 'toggle-filters') {
    const f = document.querySelector('[data-filters]');
    if (f) f.classList.toggle('is-visible');
  }
  
  // Techbot
  if (action === 'techbot-toggle' || action === 'toggle-bot') {
    state.tb.open = !state.tb.open;
    render();
    return;
  }
  if (action === 'techbot-clear') {
    if (state.tb.busy) return;
    state.tb.messages = [];
    state.tb.pending = false;
    render();
    return;
  }
  if (action === 'techbot-ask' || action === 'techbot-retry') {
    const question = String(btn.dataset.q || '').trim();
    if (question && !state.tb.pending) await sendBotMessage(question);
    return;
  }
  if (action === 'skip-to-content') {
    document.querySelector('#main-content')?.focus();
    return;
  }
  
  // Orders
  if (action === 'pay-vnpay') {
    btn.disabled = true; btn.textContent = 'Đang chuyển hướng...';
    try {
      const p = await postJson('/payment/create', { orderId: Number(btn.dataset.orderId || btn.dataset.order) });
      window.location.assign(p.data.paymentUrl);
    } catch (e) { toast(e.message, 'error'); render(); }
  }
  if (action === 'cancel-order') {
    btn.disabled = true; btn.textContent = 'Đang hủy...';
    try {
      await postJson(`/orders/${btn.dataset.orderId || btn.dataset.order}/cancel`);
      toast('Đã hủy đơn hàng');
      render();
    } catch (e) { toast(e.message, 'error'); render(); }
  }
  if (action === 'retry') { render(); }
};

root.addEventListener('click', bodyClick);

// Close account menu if clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-account-menu]')) {
    document.querySelectorAll('[data-account-menu]').forEach(m => m.classList.remove('is-active'));
  }
});

// Forms
root.addEventListener('submit', async (e) => {
  const form = e.target;
  if (form.id === 'login-form' || form.id === 'register-form') {
    e.preventDefault();
    const isReg = form.id === 'register-form';
    const f = new FormData(form);
    const email = f.get('email');
    const password = f.get('password');
    const fullName = isReg ? f.get('fullName') : '';
    const alert = form.querySelector('[data-form-alert]');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    alert.hidden = true; alert.textContent = '';
    submitBtn.disabled = true;
    const emailError = validators.email(email);
    const passwordError = isReg ? validators.registerPassword(password) : validators.loginPassword(password);
    const nameError = isReg ? validators.fullName(fullName) : '';
    const firstError = nameError || emailError || passwordError;
    if (firstError) {
      alert.hidden = false;
      alert.textContent = firstError;
      submitBtn.disabled = false;
      return;
    }
    try {
      if (isReg) {
        await postJson('/auth/register', { email, password, fullName });
        await postJson('/auth/login', { email, password });
      } else {
        await postJson('/auth/login', { email, password });
      }

      // The login endpoint succeeding is not enough: confirm the browser
      // actually retained the server-side HttpOnly session cookie.
      let me;
      try {
        me = await api('/auth/me');
      } catch (sessionError) {
        state.user = null;
        state.session = null;
        state.cart = null;
        throw new ApiError(
          window.location.protocol === 'http:'
            ? 'Phiên đăng nhập chưa được trình duyệt lưu lại. Hãy mở TechGear bằng HTTPS (cổng 8443 hoặc đường dẫn tunnel) rồi thử lại.'
            : (sessionError.message || 'Không thể xác nhận phiên đăng nhập. Vui lòng thử lại.'),
          { status: 0, code: 'SESSION_CONFIRMATION_FAILED' }
        );
      }

      state.user = me.data.user;
      state.session = me.data.session;
      await ensureCart();
      const destination = state.authReturnHash;
      state.authReturnHash = null;
      state.authModal = null;
      toast(isReg ? 'Đăng ký và đăng nhập thành công' : 'Đăng nhập thành công');
      if (destination && destination !== window.location.hash) {
        go(destination);
      } else {
        await render();
      }
    } catch(err) {
      state.user = null;
      state.session = null;
      state.cart = null;
      alert.hidden = false;
      alert.textContent = err.message || 'Không thể đăng nhập. Vui lòng kiểm tra thông tin và thử lại.';
    } finally { submitBtn.disabled = false; }
  }
  
  if (form.hasAttribute('data-search-form')) {
    e.preventDefault();
    const q = form.querySelector('input[name="q"]').value.trim();
    const h = v.productsHash({ search: q });
    if (state.navOpen) state.navOpen = false;
    go(h);
  }
  
  if (form.hasAttribute('data-price-form')) {
    e.preventDefault();
    const f = new FormData(form);
    const minP = f.get('minPrice');
    const maxP = f.get('maxPrice');
    const currentQ = Object.fromEntries(route().query.entries());
    const h = v.productsHash({ ...currentQ, minPrice: minP, maxPrice: maxP, page: 1 });
    go(h);
  }
  
  if (form.id === 'checkout-form') {
    e.preventDefault();
    const f = new FormData(form);
    const alert = document.querySelector('.page--checkout [data-form-alert]');
    const btn = document.querySelector('[data-checkout-submit]');
    alert.hidden = true; btn.disabled = true;
    try {
      const orderRes = await postJson('/checkout', {
        recipientName: String(f.get('recipientName')),
        recipientPhone: String(f.get('recipientPhone')),
        shippingAddress: String(f.get('shippingAddress'))
      });
      state.cart = null;
      try {
        const payRes = await postJson('/payment/create', { orderId: orderRes.data.order.id });
        window.location.assign(payRes.data.paymentUrl);
      } catch (payErr) {
        toast('Tạo đơn thành công, nhưng không thể kết nối VNPAY', 'error');
        go(`#/orders/${orderRes.data.order.id}`);
      }
    } catch (err) {
      alert.hidden = false; alert.textContent = err.message; btn.disabled = false;
    }
  }
  
  if (form.id === 'techbot-form' || form.hasAttribute('data-techbot-form') || form.classList.contains('tb-form')) {
    e.preventDefault();
    const input = form.querySelector('input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendBotMessage(text);
  }
});

// Password strength
root.addEventListener('input', (e) => {
  if (e.target.name === 'password' && e.target.closest('#register-form')) {
    const p = e.target.value;
    let s = 0;
    if (p.length >= 12) s++;
    if (p.length >= 16) s++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
    if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
    const sBar = document.querySelector('.strength');
    if (sBar) sBar.dataset.strength = Math.min(s, 4);
  }
});

// Sort select auto-submit
root.addEventListener('change', async (e) => {
  if (e.target.matches('[data-action="sort"], #sort-select')) {
    const currentQ = Object.fromEntries(route().query.entries());
    go(v.productsHash({ ...currentQ, sort: e.target.value, page: 1 }));
    return;
  }
  if (e.target.matches('.qty__input[data-action="cart-set"]')) {
    const itemId = e.target.dataset.itemId;
    const row = e.target.closest('.cart-item');
    if (!itemId) return;
    const newQty = clampQuantity(e.target.value, e.target.max);
    e.target.value = newQty;
    try {
      row?.classList.add('is-updating');
      await patchJson(`/cart/items/${itemId}`, { quantity: newQty });
      await ensureCart();
      render();
    } catch (err) {
      toast(err.message || 'Không thể cập nhật giỏ hàng', 'error');
      row?.classList.remove('is-updating');
    }
  }
});

// Techbot suggestions
root.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-bot-suggestion]');
  if (chip) sendBotMessage(chip.dataset.botSuggestion);
});

function bindEvents() {
  document.querySelectorAll('a[href]').forEach(a => {
    if (a.hash === window.location.hash && a.hash) {
      a.addEventListener('click', (e) => { e.preventDefault(); render(); });
    }
  });
}

async function sendBotMessage(text) {
  state.tb.messages.push({ role: 'user', text });
  state.tb.pending = true;
  render();
  setTimeout(() => {
    document.querySelectorAll('[data-tb-messages], [data-techbot-messages]').forEach(el => el.scrollTop = el.scrollHeight);
  }, 10);
  
  try {
    const res = await postJson('/techbot', { question: text });
    state.tb.messages.push({ role: 'bot', text: res.data.response || res.data.answer, recommendations: res.data.recommendations });
  } catch (err) {
    state.tb.messages.push({ role: 'error', text: err.status === 429 ? 'TechBot đang giới hạn 5 câu/phút. Vui lòng thử lại sau.' : (err.message || 'Đã xảy ra lỗi AI.') });
  } finally {
    state.tb.pending = false;
    render();
    setTimeout(() => {
      document.querySelectorAll('[data-tb-messages], [data-techbot-messages]').forEach(el => el.scrollTop = el.scrollHeight);
    }, 10);
  }
}

  // Keyboard accessibility for overlays.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (state.authModal || state.quickView || state.confirm || state.navOpen) {
    state.authModal = null;
    state.authReturnHash = null;
    state.quickView = null;
    state.confirm = null;
    state.navOpen = false;
    render();
  }
});

// -----------------------------------------------------------------------------
  // Boot
// -----------------------------------------------------------------------------
window.addEventListener('hashchange', render);

async function bootstrap() {
  // Replace the static boot screen immediately. Never leave the user with an
  // endless spinner while waiting for API/session requests.
  renderShell(v.loadingPage('grid'));

  const preload = Promise.allSettled([loadCategories(), loadSession()]);
  const deadline = new Promise((resolve) => setTimeout(resolve, 2500));
  await Promise.race([preload, deadline]);
  await render();

  // Refresh once background preload completes so authenticated UI, categories
  // and cart information appear without blocking first paint.
  preload.then(() => {
    if (window.location.hash.replace(/^#/, '') === '' || window.location.hash === '#/') {
      render();
    }
  });
}

bootstrap().catch(showFatalBoot);
setTimeout(() => {
  if (!appMounted) showFatalBoot(new Error('Kết nối máy chủ không phản hồi.'));
}, 7000);
