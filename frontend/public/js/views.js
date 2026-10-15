// Pure HTML template functions. Every dynamic value is escaped with
// escapeHtml(); no inline styles/scripts are emitted (strict CSP).

import { icon, logoMark } from './icons.js';
import { money, escapeHtml, formatDate, formatShortDate, statusMeta, PAYMENT_STATUS, initials, firstName } from './utils.js';

export const PAGE_SIZE = 12;
export const SORT_OPTIONS = [
  ['newest', 'Mới nhất'],
  ['price_asc', 'Giá thấp đến cao'],
  ['price_desc', 'Giá cao đến thấp'],
  ['name_asc', 'Tên A → Z'],
];
export const PRICE_PRESETS = [
  { id: 'lt2', label: 'Dưới 2 triệu', minPrice: '', maxPrice: '2000000' },
  { id: '2to3', label: 'Từ 2 – 3 triệu', minPrice: '2000000', maxPrice: '3000000' },
  { id: '3to5', label: 'Từ 3 – 5 triệu', minPrice: '3000000', maxPrice: '5000000' },
  { id: 'gt5', label: 'Trên 5 triệu', minPrice: '5000000', maxPrice: '' },
];
export const TECHBOT_SUGGESTIONS = [
  'Tư vấn chuột gaming',
  'Chọn bàn phím cho FPS',
  'So sánh 2 sản phẩm',
  'Gợi ý linh kiện',
];
const LOW_STOCK = 10;

/* ============================== primitives ============================== */

const e = escapeHtml;

export function spinner(cls = '') {
  return `<span class="spinner ${cls}" aria-hidden="true"></span>`;
}

function stockInfo(qty) {
  const n = Number(qty || 0);
  if (n <= 0) return { tone: 'out', label: 'Hết hàng' };
  if (n <= LOW_STOCK) return { tone: 'low', label: `Chỉ còn ${n} sản phẩm` };
  return { tone: 'in', label: 'Còn hàng' };
}

function stockLine(qty) {
  const s = stockInfo(qty);
  return `<span class="stock stock--${s.tone}"><span class="stock__dot" aria-hidden="true"></span>${s.label}</span>`;
}

export function statusBadge(status, table) {
  const meta = statusMeta(status, table);
  return `<span class="badge badge--${meta.tone}">${e(meta.label)}</span>`;
}

function breadcrumb(items) {
  const last = items.length - 1;
  return `<nav class="breadcrumb" aria-label="Breadcrumb"><ol>${items.map((item, i) => (
    i === last || !item.href
      ? `<li aria-current="page">${e(item.label)}</li>`
      : `<li><a href="${item.href}">${e(item.label)}</a>${icon('chevronRight', 14)}</li>`
  )).join('')}</ol></nav>`;
}

export function emptyState({ iconName = 'package', title, text = '', actions = '', compact = false }) {
  return `<div class="empty-state${compact ? ' empty-state--compact' : ''}">
    <div class="empty-state__icon">${icon(iconName, 30)}</div>
    <h2 class="empty-state__title">${e(title)}</h2>
    ${text ? `<p class="empty-state__text">${e(text)}</p>` : ''}
    ${actions ? `<div class="empty-state__actions">${actions}</div>` : ''}
  </div>`;
}

export function errorState(error, { retry = true } = {}) {
  return `<section class="page"><div class="container">${emptyState({
    iconName: 'alertCircle',
    title: 'Không thể tải dữ liệu',
    text: error?.message || 'Máy chủ chưa sẵn sàng. Vui lòng thử lại.',
    actions: `${retry ? `<button class="btn btn--primary" data-action="retry">${icon('refresh', 18)}Thử lại</button>` : ''}<a class="btn btn--ghost" href="#/">Về trang chủ</a>`,
  })}</div></section>`;
}

function sectionHead(title, subtitle = '', link = '') {
  return `<div class="section-head">
    <div><h2 class="section-title">${e(title)}</h2>${subtitle ? `<p class="section-subtitle">${e(subtitle)}</p>` : ''}</div>
    ${link}
  </div>`;
}

function seeAll(href, label = 'Xem tất cả') {
  return `<a class="link-arrow" href="${href}">${e(label)}${icon('arrowRight', 16)}</a>`;
}

export function productsHash(query = {}) {
  const params = new URLSearchParams();
  ['search', 'category', 'minPrice', 'maxPrice', 'sort', 'page'].forEach((key) => {
    const value = query[key];
    if (value === undefined || value === null || value === '') return;
    if (key === 'sort' && value === 'newest') return;
    if (key === 'page' && Number(value) <= 1) return;
    params.set(key, String(value));
  });
  const qs = params.toString();
  return `#/products${qs ? `?${qs}` : ''}`;
}

/* ============================== product card ============================== */

const PRODUCT_IMAGE_URLS = {
  // Real product photography from manufacturer/retailer CDNs.
  'keychron-k2-v2': 'https://mks.blr1.cdn.digitaloceanspaces.com/uploads/2021/03/K2-LED_RGB-jpeg.webp',
  'akko-5075b-plus': 'https://product.hstatic.net/200000637319/product/image_-_2024-07-11t161836.611_4ddad7c2ff1f425a98e10cb6558f5133_master.png',
  'logitech-mx-keys-s': 'https://dienmay.tic.vn/thumb/crop/39747/ban-phim-khong-day-logitech-mx-keys-s-graphite-920-011563.jpg',
  'logitech-g-pro-x-superlight-2': 'https://www.tncstore.vn/media/product/9063-chuot-logitech-g-pro-x-superlight-2-wireless-white-2.jpg',
  'razer-deathadder-v3': 'https://ecommerce.datablitz.com.ph/cdn/shop/products/0840272902998.jpg?v=1677053197',
  'logitech-mx-master-3s': 'https://f00.esfr.pl/foto/2/105878971337/2980c0a350b70f9e4e64c1e4a325c63c/logitech-mysz-mx-master-3s-szara%2C105878971337_5.webp',
  'amd-ryzen-7-7700': 'https://moon.kz/upload/iblock/295/fko5h44epqk2yjeu50o0xblzclyylr4g.jpg',
  'corsair-vengeance-32gb-ddr5': 'https://www.uzishop.hr/278091-thickbox_default/corsair-vengeance-cmk32gx5m2x7200c34-memorijski-modul-32-gb-2-x-16-gb-ddr5-7200-mhz.jpg',
  'samsung-990-evo-1tb': 'https://media.lifeinformatica.com/contents/assets/SDSAM093/imgs/MZ-V9E1T0BW-03.png',
  'corsair-rm750e': 'https://cdn.x-kom.pl/i/setup/images/prod/big/product-new-big%2C%2C2023/6/pr_2023_6_28_14_20_11_900_05.png',
  'dell-g2724d': 'https://cdn.al.to/i/setup/images/prod/big/product-new-big%2C%2C2023/7/pr_2023_7_11_8_48_17_373_00.jpg',
  'lg-27gp850-b': 'https://www.tohome.com/images/Products/500/23092021/27GP850-B.jpg',
};

function productSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function productImageSrc(product) {
  const explicit = String(product.slug || '').toLowerCase();
  const derived = productSlug(product.name);
  return PRODUCT_IMAGE_URLS[explicit] || PRODUCT_IMAGE_URLS[derived] || product.primaryImage?.imageUrl || '';
}

export function productMedia(product, cls = '') {
  const src = productImageSrc(product);
  const alt = e(product.primaryImage?.altText || product.name || 'Sản phẩm TechGear');
  const priority = cls.includes('hero-') ? 'high' : 'auto';
  if (src) {
    return `<div class="product-media ${cls}" data-product-media>
      <img class="product-media__img" data-product-image src="${e(src)}" alt="${alt}" loading="${priority === 'high' ? 'eager' : 'lazy'}" decoding="async" fetchpriority="${priority}" referrerpolicy="no-referrer">
      <div class="product-media__fallback product-media__fallback--neutral" aria-hidden="true">
        <small>Không thể tải ảnh sản phẩm</small>
      </div>
    </div>`;
  }
  return `<div class="product-media product-media--neutral ${cls}"><small>Ảnh sản phẩm đang được cập nhật</small></div>`;
}

export function productCard(product) {
  const stock = Number(product.stockQuantity || 0);
  const s = stockInfo(stock);
  const href = `#/products/${encodeURIComponent(product.id)}`;
  return `<article class="p-card">
    <div class="p-card__media">
      <a href="${href}" class="p-card__media-link" tabindex="-1" aria-hidden="true">${productMedia(product)}</a>
      <div class="p-card__badges">
        ${s.tone === 'out' ? '<span class="tag tag--dark">Hết hàng</span>' : ''}
        ${s.tone === 'low' ? `<span class="tag tag--warning">Sắp hết</span>` : ''}
      </div>
      <button class="p-card__quick" data-action="quick-view" data-product-id="${e(product.id)}" aria-label="Xem nhanh ${e(product.name)}">${icon('eye', 16)}<span>Xem nhanh</span></button>
    </div>
    <div class="p-card__body">
      <div class="p-card__meta"><span>${e(product.brand || '')}</span>${product.category?.name ? `<span class="dot-sep">${e(product.category.name)}</span>` : ''}</div>
      <h3 class="p-card__title"><a href="${href}">${e(product.name)}</a></h3>
      <div class="p-card__price">${money(product.price)}</div>
      ${stockLine(stock)}
      <button class="btn btn--primary btn--block p-card__cta" data-action="add-to-cart" data-product-id="${e(product.id)}" ${stock <= 0 ? 'disabled' : ''}>
        ${icon('cart', 18)}<span>${stock <= 0 ? 'Tạm hết hàng' : 'Thêm vào giỏ'}</span>
      </button>
    </div>
  </article>`;
}

export function productGrid(products, cls = '') {
  return `<div class="product-grid ${cls}">${products.map(productCard).join('')}</div>`;
}

export function skeletonCards(n = 8) {
  return Array.from({ length: n }, () => `<div class="p-card p-card--skeleton" aria-hidden="true">
    <div class="skeleton skeleton--media"></div>
    <div class="p-card__body"><div class="skeleton skeleton--line w-40"></div><div class="skeleton skeleton--line w-90"></div><div class="skeleton skeleton--line w-60"></div><div class="skeleton skeleton--btn"></div></div>
  </div>`).join('');
}

export function loadingPage(kind = 'grid') {
  if (kind === 'detail') {
    return `<section class="page"><div class="container"><div class="skeleton skeleton--line w-30"></div>
      <div class="detail-grid detail-grid--loading"><div class="skeleton skeleton--hero"></div>
      <div><div class="skeleton skeleton--line w-30"></div><div class="skeleton skeleton--title"></div><div class="skeleton skeleton--line w-60"></div><div class="skeleton skeleton--line w-40"></div><div class="skeleton skeleton--block"></div></div></div>
    </div><span class="sr-only" role="status">Đang tải…</span></section>`;
  }
  if (kind === 'panel') {
    return `<section class="page"><div class="container"><div class="skeleton skeleton--title w-30"></div>
      <div class="split"><div class="card"><div class="skeleton skeleton--block"></div><div class="skeleton skeleton--block"></div></div><div class="card"><div class="skeleton skeleton--block"></div></div></div>
    </div><span class="sr-only" role="status">Đang tải…</span></section>`;
  }
  return `<section class="page"><div class="container"><div class="skeleton skeleton--title w-30"></div>
    <div class="product-grid">${skeletonCards(8)}</div></div><span class="sr-only" role="status">Đang tải…</span></section>`;
}

/* ============================== shell: header / footer ============================== */

function navLinks(state, current, variant) {
  const r = current;
  const isProducts = r.path === '/products';
  const activeCat = isProducts ? r.query.get('category') || '' : '';
  const links = [
    { href: '#/', label: 'Trang chủ', icon: 'home', active: r.path === '/' },
    { href: '#/products', label: 'Tất cả sản phẩm', icon: 'grid', active: isProducts && !activeCat && r.query.get('sort') !== 'price_asc' },
    ...state.categories.map((c) => ({ href: productsHash({ category: c.slug }), label: c.name, active: activeCat === c.slug })),
    { href: productsHash({ sort: 'price_asc' }), label: 'Giá tốt', icon: 'tag', active: isProducts && !activeCat && r.query.get('sort') === 'price_asc', hot: true },
    { href: '#/techbot', label: 'TechBot AI', icon: 'sparkles', active: r.path === '/techbot' },
    { href: '#/orders', label: 'Đơn hàng', icon: 'receipt', active: r.path.startsWith('/orders') },
  ];
  if (variant === 'drawer') {
    return links.map((l) => `<a class="drawer-link ${l.active ? 'is-active' : ''}" href="${l.href}" data-action="close-overlay"><span class="drawer-link__icon">${icon(l.icon || 'grid', 20)}</span><span class="drawer-link__label">${e(l.label)}</span>${icon('chevronRight', 16, 'drawer-link__chev')}</a>`).join('');
  }
  return links.map((l) => `<a class="main-nav__link ${l.active ? 'is-active' : ''} ${l.hot ? 'is-hot' : ''}" href="${l.href}" ${l.active ? 'aria-current="page"' : ''}>${l.icon ? icon(l.icon, 16) : ''}${e(l.label)}</a>`).join('');
}

function accountControl(state) {
  if (!state.user) {
    return `<button class="header-action" data-action="open-auth" data-mode="login" aria-label="Đăng nhập">
      ${icon('user', 22)}<span class="header-action__text"><small>Xin chào</small><strong>Đăng nhập</strong></span>
    </button>`;
  }
  const name = e(firstName(state.user.fullName) || state.user.email);
  return `<div class="account-menu" data-account-menu>
    <button class="header-action" data-action="toggle-account-menu" aria-haspopup="true" aria-expanded="false" aria-label="Tài khoản của ${name}">
      <span class="avatar avatar--sm">${e(initials(state.user.fullName))}</span>
      <span class="header-action__text"><small>Xin chào,</small><strong>${name}</strong></span>
      ${icon('chevronDown', 16, 'header-action__chev')}
    </button>
    <div class="account-menu__panel" role="menu">
      <div class="account-menu__head"><strong>${e(state.user.fullName)}</strong><span>${e(state.user.email)}</span></div>
      <a role="menuitem" href="#/account">${icon('user', 18)}Tài khoản của tôi</a>
      <a role="menuitem" href="#/orders">${icon('receipt', 18)}Đơn hàng của tôi</a>
      <a role="menuitem" href="#/cart">${icon('cart', 18)}Giỏ hàng</a>
      <button role="menuitem" data-action="logout">${icon('logout', 18)}Đăng xuất</button>
    </div>
  </div>`;
}

export function cartCount(cart) {
  return cart?.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0;
}

function cartControl(state) {
  const count = cartCount(state.cart);
  return `<a class="header-action header-action--cart" href="#/cart" aria-label="Giỏ hàng, ${count} sản phẩm">
    <span class="cart-icon">${icon('cart', 24)}<span class="cart-badge ${count ? '' : 'is-empty'}" data-cart-count>${count > 99 ? '99+' : count}</span></span>
    <span class="header-action__text"><small>Giỏ hàng</small><strong data-cart-total>${state.cart ? money(state.cart.subtotal) : '0 ₫'}</strong></span>
  </a>`;
}

function searchForm(value, id) {
  return `<form class="search" role="search" data-search-form autocomplete="off">
    <label class="sr-only" for="${id}">Tìm kiếm sản phẩm</label>
    <span class="search__icon">${icon('search', 20)}</span>
    <input id="${id}" class="search__input" name="q" type="search" value="${e(value)}" maxlength="100" placeholder="Tìm bàn phím, chuột, SSD, Ryzen…" aria-autocomplete="list" aria-controls="${id}-suggest" data-search-input>
    <button class="search__btn" type="submit" aria-label="Tìm kiếm"><span>Tìm kiếm</span>${icon('search', 18, 'search__btn-icon')}</button>
    <div class="search-suggest" id="${id}-suggest" data-search-suggest hidden></div>
  </form>`;
}

export function header(state, current) {
  const searchValue = current.path === '/products' ? current.query.get('search') || '' : '';
  return `<button class="skip-link" data-action="skip-to-content">Bỏ qua đến nội dung chính</button>
  <div class="topbar"><div class="container topbar__inner">
    <span class="topbar__promo">${icon('truck', 16)}Miễn phí vận chuyển cho mọi đơn hàng</span>
    <nav class="topbar__links" aria-label="Liên kết nhanh">
      <span>${icon('clock', 14)}Hỗ trợ 09:00 – 21:00</span>
      <a href="#/orders">Theo dõi đơn hàng</a>
      <a href="#/policies">Chính sách</a>
    </nav>
  </div></div>
  <header class="site-header" data-site-header>
    <div class="container header-main">
      <button class="icon-btn header-menu-btn" data-action="open-nav" aria-label="Mở menu điều hướng">${icon('menu', 24)}</button>
      <a class="logo" href="#/" aria-label="TechGear Store – Trang chủ">${logoMark(36)}<span class="logo__text">TechGear<small>Store</small></span></a>
      ${searchForm(searchValue, 'header-search')}
      <div class="header-actions">
        <a class="header-action header-action--bot" href="#/techbot">${icon('bot', 22)}<span class="header-action__text"><small>Tư vấn AI</small><strong>TechBot</strong></span></a>
        ${accountControl(state)}
        ${cartControl(state)}
      </div>
    </div>
    <nav class="main-nav" aria-label="Điều hướng chính"><div class="container main-nav__inner">${navLinks(state, current, 'bar')}</div></nav>
  </header>`;
}

export function footer(state) {
  return `<footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a class="logo logo--light" href="#/">${logoMark(34)}<span class="logo__text">TechGear<small>Store</small></span></a>
        <p>Cửa hàng thiết bị công nghệ: bàn phím, chuột, linh kiện PC và màn hình — thông tin rõ ràng, thanh toán an toàn.</p>
        <ul class="footer-contact">
          <li>${icon('phone', 16)}Hỗ trợ trực tuyến</li>
          <li>${icon('mail', 16)}Trợ giúp qua TechBot</li>
          <li>${icon('clock', 16)}09:00 – 21:00 mỗi ngày</li>
        </ul>
      </div>
      <div><h3>Mua sắm</h3><ul>
        <li><a href="#/products">Tất cả sản phẩm</a></li>
        ${state.categories.map((c) => `<li><a href="${productsHash({ category: c.slug })}">${e(c.name)}</a></li>`).join('')}
      </ul></div>
      <div><h3>Hỗ trợ khách hàng</h3><ul>
        <li><a href="#/account">Tài khoản của tôi</a></li>
        <li><a href="#/orders">Theo dõi đơn hàng</a></li>
        <li><a href="#/cart">Giỏ hàng</a></li>
        <li><a href="#/techbot">TechBot tư vấn</a></li>
      </ul></div>
      <div><h3>Chính sách</h3><ul>
        <li><a href="#/policies?section=security">Bảo mật thông tin</a></li>
        <li><a href="#/policies?section=payment">Thanh toán</a></li>
        <li><a href="#/policies?section=shipping">Vận chuyển</a></li>
        <li><a href="#/policies?section=returns">Đổi trả</a></li>
      </ul></div>
      <div><h3>Thanh toán &amp; bảo mật</h3>
        <div class="trust-badges">
          <span class="trust-badge trust-badge--vnpay">VNPAY</span>
          <span class="trust-badge">${icon('lock', 14)}HTTPS / TLS</span>
          <span class="trust-badge">${icon('shield', 14)}WAF</span>
          <span class="trust-badge">${icon('lock', 14)}AES-256</span>
        </div>
        <p class="footer-note">Thanh toán qua cổng VNPAY (Sandbox) với chữ ký HMAC-SHA512.</p>
      </div>
    </div>
    <div class="footer-bottom"><div class="container footer-bottom__inner">
      <span>© 2026 TechGear Store. Dự án demo An toàn Thương mại điện tử.</span>
      <span class="footer-bottom__links"><a href="#/policies?section=security">Bảo mật</a><a href="#/policies?section=returns">Điều khoản</a></span>
    </div></div>
  </footer>`;
}

/* ============================== overlays ============================== */

export function navDrawer(state, current) {
  return `<div class="overlay" data-action="close-overlay"></div>
  <aside class="drawer drawer--left" role="dialog" aria-modal="true" aria-label="Menu điều hướng">
    <div class="drawer__head">
      <a class="logo" href="#/" data-action="close-overlay">${logoMark(32)}<span class="logo__text">TechGear<small>Store</small></span></a>
      <button class="icon-btn" data-action="close-overlay" aria-label="Đóng menu">${icon('close', 22)}</button>
    </div>
    <div class="drawer__account">
      ${state.user
        ? `<span class="avatar">${e(initials(state.user.fullName))}</span><div><strong>${e(state.user.fullName)}</strong><span>${e(state.user.email)}</span></div>`
        : `<span class="avatar avatar--muted">${icon('user', 20)}</span><div><strong>Chào mừng bạn</strong><button class="link-btn" data-action="open-auth" data-mode="login">Đăng nhập / Đăng ký</button></div>`}
    </div>
    <nav class="drawer__nav" aria-label="Danh mục">${navLinks(state, current, 'drawer')}</nav>
    ${state.user ? `<div class="drawer__foot"><a class="btn btn--ghost btn--block" href="#/account" data-action="close-overlay">${icon('user', 18)}Tài khoản</a><button class="btn btn--ghost btn--block" data-action="logout">${icon('logout', 18)}Đăng xuất</button></div>` : ''}
  </aside>`;
}

function field({ id, name, label, type = 'text', value = '', placeholder = '', autocomplete = '', attrs = '', hint = '', toggle = false }) {
  return `<div class="field" data-field="${name}">
    <label class="field__label" for="${id}">${e(label)}</label>
    <div class="field__control${toggle ? ' field__control--toggle' : ''}">
      <input class="input" id="${id}" name="${name}" type="${type}" value="${e(value)}" ${placeholder ? `placeholder="${e(placeholder)}"` : ''} ${autocomplete ? `autocomplete="${autocomplete}"` : ''} aria-describedby="${id}-error${hint ? ` ${id}-hint` : ''}" ${attrs}>
      ${toggle ? `<button type="button" class="field__toggle" data-action="toggle-password" data-target="${id}" aria-label="Hiện mật khẩu" aria-pressed="false">${icon('eye', 18)}</button>` : ''}
    </div>
    ${hint ? `<p class="field__hint" id="${id}-hint">${hint}</p>` : ''}
    <p class="field__error" id="${id}-error" role="alert"></p>
  </div>`;
}

export function authModal(mode) {
  const register = mode === 'register';
  return `<div class="overlay overlay--center" data-action="close-overlay"></div>
  <div class="modal modal--auth" role="dialog" aria-modal="true" aria-labelledby="auth-title">
    <button class="modal__close icon-btn" data-action="close-overlay" aria-label="Đóng">${icon('close', 20)}</button>
    <div class="auth-head">
      ${logoMark(40)}
      <h2 id="auth-title">${register ? 'Tạo tài khoản TechGear' : 'Đăng nhập TechGear'}</h2>
      <p>${register ? 'Theo dõi đơn hàng và thanh toán nhanh hơn.' : 'Chào mừng bạn quay lại!'}</p>
    </div>
    <div class="segmented" role="tablist">
      <button role="tab" class="segmented__item ${!register ? 'is-active' : ''}" aria-selected="${!register}" data-action="open-auth" data-mode="login">Đăng nhập</button>
      <button role="tab" class="segmented__item ${register ? 'is-active' : ''}" aria-selected="${register}" data-action="open-auth" data-mode="register">Đăng ký</button>
    </div>
    ${register ? `<form id="register-form" class="form" novalidate>
      ${field({ id: 'reg-name', name: 'fullName', label: 'Họ và tên', autocomplete: 'name', placeholder: 'Nguyễn Văn A', attrs: 'maxlength="120" required' })}
      ${field({ id: 'reg-email', name: 'email', label: 'Email', type: 'email', autocomplete: 'email', placeholder: 'ban@example.com', attrs: 'maxlength="254" required' })}
      ${field({ id: 'reg-password', name: 'password', label: 'Mật khẩu', type: 'password', autocomplete: 'new-password', placeholder: 'Tối thiểu 12 ký tự', attrs: 'minlength="12" maxlength="128" required', toggle: true, hint: '<span class="strength" data-strength="0"><span></span><span></span><span></span><span></span></span><span data-strength-label>Dùng 12+ ký tự, kết hợp chữ hoa, số và ký hiệu.</span>' })}
      <div class="form-alert" data-form-alert role="alert" hidden></div>
      <button class="btn btn--primary btn--lg btn--block" type="submit">Tạo tài khoản</button>
      <p class="form-foot">${icon('shield', 16)}Tài khoản mới luôn được tạo với quyền khách hàng.</p>
    </form>` : `<form id="login-form" class="form" novalidate>
      ${field({ id: 'login-email', name: 'email', label: 'Email', type: 'email', autocomplete: 'email', placeholder: 'ban@example.com', attrs: 'maxlength="254" required' })}
      ${field({ id: 'login-password', name: 'password', label: 'Mật khẩu', type: 'password', autocomplete: 'current-password', placeholder: 'Nhập mật khẩu', attrs: 'maxlength="128" required', toggle: true })}
      <div class="form-alert" data-form-alert role="alert" hidden></div>
      <button class="btn btn--primary btn--lg btn--block" type="submit">Đăng nhập</button>
      <p class="form-foot">${icon('lock', 16)}Phiên đăng nhập được bảo vệ bằng cookie HttpOnly.</p>
    </form>`}
  </div>`;
}

export function confirmModal({ title, message, confirmLabel = 'Xác nhận', tone = 'danger' }) {
  return `<div class="overlay overlay--center" data-action="close-overlay"></div>
  <div class="modal modal--confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-msg">
    <div class="confirm-icon confirm-icon--${tone}">${icon('alert', 26)}</div>
    <h2 id="confirm-title">${e(title)}</h2>
    <p id="confirm-msg">${e(message)}</p>
    <div class="modal__actions">
      <button class="btn btn--ghost" data-action="close-overlay">Quay lại</button>
      <button class="btn btn--${tone}" data-action="confirm-yes">${e(confirmLabel)}</button>
    </div>
  </div>`;
}

export function quickViewModal(product) {
  const stock = Number(product.stockQuantity || 0);
  return `<div class="overlay overlay--center" data-action="close-overlay"></div>
  <div class="modal modal--quick" role="dialog" aria-modal="true" aria-labelledby="qv-title">
    <button class="modal__close icon-btn" data-action="close-overlay" aria-label="Đóng">${icon('close', 20)}</button>
    <div class="quick">
      <div class="quick__media">${productMedia(product, 'art--lg')}</div>
      <div class="quick__info">
        <div class="p-card__meta"><span>${e(product.brand || '')}</span><span class="dot-sep">SKU ${e(product.sku)}</span></div>
        <h2 id="qv-title">${e(product.name)}</h2>
        <div class="quick__price">${money(product.price)}</div>
        ${stockLine(stock)}
        <p class="quick__desc">${e(product.description || 'Thông tin sản phẩm đang được cập nhật.')}</p>
        <div class="buy-row">
          ${qtyStepper('qv-qty', stock)}
          <button class="btn btn--primary btn--lg" data-action="add-to-cart" data-product-id="${e(product.id)}" data-qty-input="qv-qty" ${stock <= 0 ? 'disabled' : ''}>${icon('cart', 18)}Thêm vào giỏ</button>
        </div>
        <a class="link-arrow" href="#/products/${encodeURIComponent(product.id)}" data-action="close-overlay">Xem chi tiết sản phẩm${icon('arrowRight', 16)}</a>
      </div>
    </div>
  </div>`;
}

export function qtyStepper(id, stock) {
  const max = Math.max(1, Math.min(999, Number(stock || 0)));
  const disabled = Number(stock || 0) <= 0 ? 'disabled' : '';
  return `<div class="qty" data-qty>
    <button type="button" class="qty__btn" data-action="qty-step" data-step="-1" data-target="${id}" aria-label="Giảm số lượng" ${disabled}>${icon('minus', 16)}</button>
    <input class="qty__input" id="${id}" type="number" inputmode="numeric" min="1" max="${max}" value="1" aria-label="Số lượng" ${disabled}>
    <button type="button" class="qty__btn" data-action="qty-step" data-step="1" data-target="${id}" aria-label="Tăng số lượng" ${disabled}>${icon('plus', 16)}</button>
  </div>`;
}

/* ============================== home ============================== */

const SERVICES = [
  { icon: 'shield', title: 'Thanh toán bảo mật', text: 'Cổng VNPAY, chữ ký HMAC-SHA512' },
  { icon: 'truck', title: 'Giao hàng nhanh', text: 'Miễn phí vận chuyển mọi đơn' },
  { icon: 'badgeCheck', title: 'Hàng chính hãng', text: 'Thương hiệu uy tín, rõ nguồn gốc' },
  { icon: 'headset', title: 'Hỗ trợ tận tâm', text: '09:00 – 21:00 & TechBot tư vấn' },
];

export function homeView(state, data) {
  const { newest, cheapest, premium } = data;
  const total = state.categories.reduce((sum, c) => sum + Number(c.productCount || 0), 0);
  const brands = [...new Set([...newest, ...cheapest, ...premium].map((p) => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const monitor = state.categories.find((c) => c.slug === 'monitor');
  const component = state.categories.find((c) => c.slug === 'component');

  return `
  <section class="hero-section">
    <div class="container">
      <div class="hero">
        <div class="hero__copy">
          <span class="eyebrow">${icon('zap', 16)}Thiết bị công nghệ chính hãng</span>
          <h1>Nâng cấp góc máy.<br><span>Chọn đúng, mua nhanh.</span></h1>
          <p>Khám phá bàn phím, chuột, linh kiện PC và màn hình chính hãng với hình ảnh sản phẩm thực tế, giá và tồn kho cập nhật từ hệ thống.</p>
          <div class="hero__actions">
            <a class="btn btn--primary btn--lg" href="#/products">Mua ngay${icon('arrowRight', 18)}</a>
            <a class="btn btn--outline btn--lg" href="#/techbot">${icon('sparkles', 18)}Hỏi TechBot</a>
          </div>
          <dl class="hero__stats">
            <div><dt>${total}</dt><dd>Sản phẩm đang bán</dd></div>
            <div><dt>${state.categories.length}</dt><dd>Danh mục</dd></div>
            <div><dt>${brands.length}</dt><dd>Thương hiệu</dd></div>
          </dl>
        </div>
        <div class="hero__gallery" aria-label="Ảnh sản phẩm nổi bật">
          ${[
            newest.find((p) => p.category?.slug === 'monitor'),
            newest.find((p) => p.category?.slug === 'keyboard'),
            newest.find((p) => p.category?.slug === 'mouse'),
          ].filter(Boolean).slice(0,3).map((p, i) => `<a class="hero-product hero-product--${i + 1}" href="#/products/${encodeURIComponent(p.id)}" aria-label="Xem ${e(p.name)}">${productMedia(p, 'hero-product__media')}</a>`).join('')}
        </div>
      </div>
      <div class="hero-side">
        ${monitor ? `<a class="promo promo--blue" href="${productsHash({ category: 'monitor' })}">
          <div class="promo__copy"><span class="promo__kicker">${e(monitor.name)}</span><strong>Màn hình QHD 165Hz</strong><span class="link-arrow">Khám phá${icon('arrowRight', 16)}</span></div>
          <div class="promo__art promo__art--photo">${productMedia(newest.find((p) => p.category?.slug === 'monitor') || monitor, 'promo__media')}</div>
        </a>` : ''}
        ${component ? `<a class="promo promo--slate" href="${productsHash({ category: 'component' })}">
          <div class="promo__copy"><span class="promo__kicker">${e(component.name)}</span><strong>CPU, RAM, SSD &amp; nguồn</strong><span class="link-arrow">Xem ngay${icon('arrowRight', 16)}</span></div>
          <div class="promo__art promo__art--photo">${productMedia(newest.find((p) => p.category?.slug === 'component') || component, 'promo__media')}</div>
        </a>` : ''}
      </div>
    </div>
  </section>

  <section class="services" aria-label="Vì sao chọn TechGear">
    <div class="container services__grid">
      ${SERVICES.map((s) => `<div class="service"><span class="service__icon">${icon(s.icon, 24)}</span><div><strong>${s.title}</strong><span>${s.text}</span></div></div>`).join('')}
    </div>
  </section>

  <section class="section">
    <div class="container">
      ${sectionHead('Danh mục nổi bật', 'Chọn nhanh theo nhu cầu của bạn', seeAll('#/products'))}
      <div class="category-grid">
        ${state.categories.map((c) => {
          const representative = [...newest, ...cheapest, ...premium].find((p) => p.category?.slug === c.slug);
          return `<a class="category-card" href="${productsHash({ category: c.slug })}">
            <div class="category-card__art category-card__art--photo">${representative ? productMedia(representative, 'category-card__media') : `<span class="category-card__empty">${icon('image', 24)}</span>`}</div>
            <div class="category-card__body"><strong>${e(c.name)}</strong><span>${Number(c.productCount || 0)} sản phẩm</span></div>
            <span class="category-card__arrow">${icon('arrowRight', 18)}</span>
          </a>`;
        }).join('')}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      ${sectionHead('Hàng mới về', 'Sản phẩm mới cập nhật trong catalog', seeAll(productsHash({ sort: 'newest' })))}
      ${newest.length ? productGrid(newest) : emptyState({ title: 'Chưa có sản phẩm', compact: true })}
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="bot-banner">
        <div class="bot-banner__icon">${icon('bot', 34)}</div>
        <div class="bot-banner__copy">
          <span class="eyebrow eyebrow--light">${icon('sparkles', 14)}TechBot Advisor</span>
          <h2>Chưa biết chọn gì? Hỏi trợ lý mua sắm AI.</h2>
          <p>TechBot gợi ý sản phẩm theo ngân sách và nhu cầu, chỉ dựa trên catalog công khai của TechGear.</p>
        </div>
        <a class="btn btn--light btn--lg" href="#/techbot">Trò chuyện ngay${icon('arrowRight', 18)}</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <div><h2 class="section-title">Gợi ý cho bạn</h2><p class="section-subtitle">Lọc nhanh theo mức giá</p></div>
        <div class="tabs" role="tablist" aria-label="Gợi ý sản phẩm">
          <button class="tabs__item is-active" role="tab" aria-selected="true" aria-controls="tab-cheap" data-action="tab" data-tab="tab-cheap">Giá tốt</button>
          <button class="tabs__item" role="tab" aria-selected="false" aria-controls="tab-premium" data-action="tab" data-tab="tab-premium">Cao cấp</button>
        </div>
      </div>
      <div id="tab-cheap" class="tab-panel" role="tabpanel">${productGrid(cheapest)}</div>
      <div id="tab-premium" class="tab-panel" role="tabpanel" hidden>${productGrid(premium)}</div>
    </div>
  </section>

  ${brands.length ? `<section class="section section--tight">
    <div class="container">
      ${sectionHead('Thương hiệu', 'Mua theo hãng bạn tin dùng')}
      <div class="brand-row">${brands.map((b) => `<a class="brand-chip" href="${productsHash({ search: b })}">${e(b)}</a>`).join('')}</div>
    </div>
  </section>` : ''}

  <section class="section">
    <div class="container">
      <div class="security-band">
        <div class="security-band__intro">
          <span class="eyebrow">${icon('shield', 16)}Mua sắm an toàn</span>
          <h2>Bảo mật ở mọi bước mua hàng</h2>
          <p>TechGear áp dụng nhiều lớp bảo vệ từ trình duyệt đến cơ sở dữ liệu.</p>
        </div>
        <ul class="security-band__list">
          <li>${icon('lock', 22)}<div><strong>HTTPS &amp; WAF</strong><span>TLS, Nginx và ModSecurity OWASP CRS chặn tấn công phổ biến.</span></div></li>
          <li>${icon('user', 22)}<div><strong>Phiên đăng nhập an toàn</strong><span>Cookie HttpOnly, mật khẩu băm bcrypt.</span></div></li>
          <li>${icon('shield', 22)}<div><strong>Dữ liệu được mã hóa</strong><span>Số điện thoại và địa chỉ mã hóa AES-256-GCM.</span></div></li>
          <li>${icon('creditCard', 22)}<div><strong>Thanh toán VNPAY</strong><span>Xác thực chữ ký HMAC-SHA512 và đối soát IPN.</span></div></li>
        </ul>
      </div>
    </div>
  </section>`;
}

/* ============================== product listing ============================== */

function pagination(pag, query) {
  const total = Number(pag.totalPages || 0);
  const current = Number(pag.page || 1);
  if (total <= 1) return '';
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const list = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  let html = '';
  let prev = 0;
  list.forEach((p) => {
    if (p - prev > 1) html += '<span class="pagination__gap" aria-hidden="true">…</span>';
    html += p === current
      ? `<span class="pagination__item is-active" aria-current="page">${p}</span>`
      : `<a class="pagination__item" href="${productsHash({ ...query, page: p })}" aria-label="Trang ${p}">${p}</a>`;
    prev = p;
  });
  const prevLink = current > 1 ? `<a class="pagination__item pagination__nav" href="${productsHash({ ...query, page: current - 1 })}" aria-label="Trang trước">${icon('chevronLeft', 18)}</a>` : `<span class="pagination__item pagination__nav is-disabled" aria-hidden="true">${icon('chevronLeft', 18)}</span>`;
  const nextLink = current < total ? `<a class="pagination__item pagination__nav" href="${productsHash({ ...query, page: current + 1 })}" aria-label="Trang sau">${icon('chevronRight', 18)}</a>` : `<span class="pagination__item pagination__nav is-disabled" aria-hidden="true">${icon('chevronRight', 18)}</span>`;
  return `<nav class="pagination" aria-label="Phân trang">${prevLink}${html}${nextLink}</nav>`;
}

function filterSidebar(state, query) {
  const total = state.categories.reduce((sum, c) => sum + Number(c.productCount || 0), 0);
  const activePreset = PRICE_PRESETS.find((p) => p.minPrice === (query.minPrice || '') && p.maxPrice === (query.maxPrice || ''));
  const base = { search: query.search, sort: query.sort };
  return `<aside class="filters" data-filters aria-label="Bộ lọc sản phẩm">
    <div class="filters__head">
      <h2>${icon('sliders', 20)}Bộ lọc</h2>
      <button class="icon-btn filters__close" data-action="toggle-filters" aria-label="Đóng bộ lọc">${icon('close', 20)}</button>
    </div>
    <div class="filter-group">
      <h3 class="filter-group__title">Danh mục</h3>
      <ul class="filter-list">
        <li><a class="filter-option ${!query.category ? 'is-active' : ''}" href="${productsHash({ ...base, minPrice: query.minPrice, maxPrice: query.maxPrice })}"><span class="radio" aria-hidden="true"></span>Tất cả<span class="filter-option__count">${total}</span></a></li>
        ${state.categories.map((c) => `<li><a class="filter-option ${query.category === c.slug ? 'is-active' : ''}" href="${productsHash({ ...base, category: c.slug, minPrice: query.minPrice, maxPrice: query.maxPrice })}"><span class="radio" aria-hidden="true"></span>${e(c.name)}<span class="filter-option__count">${Number(c.productCount || 0)}</span></a></li>`).join('')}
      </ul>
    </div>
    <div class="filter-group">
      <h3 class="filter-group__title">Khoảng giá</h3>
      <ul class="filter-list">
        ${PRICE_PRESETS.map((p) => `<li><a class="filter-option ${activePreset?.id === p.id ? 'is-active' : ''}" href="${productsHash({ ...base, category: query.category, minPrice: p.minPrice, maxPrice: p.maxPrice })}"><span class="radio" aria-hidden="true"></span>${p.label}</a></li>`).join('')}
      </ul>
      <form class="price-form" data-price-form novalidate>
        <div class="price-form__inputs">
          <label class="sr-only" for="min-price">Giá từ</label>
          <input class="input input--sm" id="min-price" name="minPrice" type="number" min="0" step="1000" inputmode="numeric" placeholder="Từ ₫" value="${e(query.minPrice || '')}">
          <span aria-hidden="true">–</span>
          <label class="sr-only" for="max-price">Giá đến</label>
          <input class="input input--sm" id="max-price" name="maxPrice" type="number" min="0" step="1000" inputmode="numeric" placeholder="Đến ₫" value="${e(query.maxPrice || '')}">
        </div>
        <p class="field__error" data-price-error role="alert"></p>
        <button class="btn btn--outline btn--block btn--sm" type="submit">Áp dụng</button>
      </form>
    </div>
    <a class="btn btn--ghost btn--block btn--sm" href="#/products">${icon('refresh', 16)}Xóa tất cả bộ lọc</a>
  </aside>`;
}

function activeFilterChips(state, query) {
  const chips = [];
  if (query.search) chips.push({ key: 'search', label: `“${query.search}”` });
  if (query.category) {
    const cat = state.categories.find((c) => c.slug === query.category);
    chips.push({ key: 'category', label: cat ? cat.name : query.category });
  }
  if (query.minPrice || query.maxPrice) {
    const label = query.minPrice && query.maxPrice ? `${money(query.minPrice)} – ${money(query.maxPrice)}`
      : query.minPrice ? `Từ ${money(query.minPrice)}` : `Đến ${money(query.maxPrice)}`;
    chips.push({ key: 'price', label });
  }
  if (!chips.length) return '';
  return `<div class="active-filters">${chips.map((c) => {
    const next = { ...query, page: 1 };
    if (c.key === 'price') { next.minPrice = ''; next.maxPrice = ''; } else next[c.key] = '';
    return `<a class="chip chip--removable" href="${productsHash(next)}" aria-label="Bỏ lọc ${e(c.label)}">${e(c.label)}${icon('close', 14)}</a>`;
  }).join('')}<a class="link-btn" href="#/products">Xóa tất cả</a></div>`;
}

export function listingTitle(state, query) {
  if (query.search) return `Kết quả cho “${query.search}”`;
  if (query.category) return state.categories.find((c) => c.slug === query.category)?.name || 'Sản phẩm';
  if (query.sort === 'price_asc') return 'Sản phẩm giá tốt';
  return 'Tất cả sản phẩm';
}

export function productsView(state, query, data) {
  const title = listingTitle(state, query);
  const cat = state.categories.find((c) => c.slug === query.category);
  const pag = data ? data.pagination : null;
  const start = pag && pag.totalItems ? (pag.page - 1) * pag.pageSize + 1 : 0;
  const end = pag ? Math.min(pag.page * pag.pageSize, pag.totalItems) : 0;
  const crumbs = [{ label: 'Trang chủ', href: '#/' }, { label: 'Sản phẩm', href: '#/products' }];
  if (cat) crumbs.push({ label: cat.name, href: productsHash({ category: cat.slug }) });
  if (query.search) crumbs.push({ label: 'Tìm kiếm' });

  let results;
  if (!data) results = `<div class="product-grid product-grid--3">${skeletonCards(6)}</div><span class="sr-only" role="status">Đang tải sản phẩm…</span>`;
  else if (!data.data || !data.data.length) {
    results = emptyState({
      iconName: 'search',
      title: 'Không tìm thấy sản phẩm phù hợp',
      text: 'Thử từ khóa khác hoặc bỏ bớt bộ lọc để xem thêm sản phẩm.',
      actions: '<a class="btn btn--primary" href="#/products">Xem tất cả sản phẩm</a>',
    });
  } else results = `${productGrid(data.data, 'product-grid--3')}${pagination(pag, query)}`;

  return `<section class="page page--listing">
    <div class="container">
      ${breadcrumb(crumbs)}
      <div class="page-head">
        <div>
          <h1 class="page-title">${e(title)}</h1>
          <p class="page-subtitle">${cat?.description ? e(cat.description) : 'Giá và tồn kho được cập nhật trực tiếp từ hệ thống.'}</p>
        </div>
      </div>
      <div class="listing">
        ${filterSidebar(state, query)}
        <div class="listing__main">
          <div class="toolbar">
            <button class="btn btn--outline btn--sm toolbar__filter-btn" data-action="toggle-filters" aria-label="Mở bộ lọc">${icon('sliders', 16)}Bộ lọc</button>
            <p class="toolbar__count" aria-live="polite">${pag ? (pag.totalItems ? `Hiển thị <strong>${start}–${end}</strong> trong <strong>${pag.totalItems}</strong> sản phẩm` : '0 sản phẩm') : 'Đang tải…'}</p>
            <label class="toolbar__sort"><span>Sắp xếp</span>
              <select class="select select--sm" data-action="sort" aria-label="Sắp xếp sản phẩm">
                ${SORT_OPTIONS.map(([v, l]) => `<option value="${v}" ${(query.sort || 'newest') === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </label>
          </div>
          ${activeFilterChips(state, query)}
          ${results}
        </div>
      </div>
    </div>
  </section>`;
}

/* ============================== product detail ============================== */

export function productDetailView(product, related) {
  const stock = Number(product.stockQuantity || 0);
  const catHref = productsHash({ category: product.category?.slug });
  const specs = [
    ['Thương hiệu', product.brand],
    ['Mã sản phẩm (SKU)', product.sku],
    ['Danh mục', product.category?.name],
    ['Tình trạng', stockInfo(stock).label],
    ['Cập nhật', formatShortDate(product.updatedAt)],
  ].filter(([, v]) => v);

  return `<section class="page page--detail">
    <div class="container">
      ${breadcrumb([{ label: 'Trang chủ', href: '#/' }, { label: product.category?.name || 'Sản phẩm', href: catHref }, { label: product.name }])}
      <div class="detail-grid">
        <div class="detail-media">
          <div class="detail-media__main">${productMedia(product, 'art--xl')}
            ${stock <= 0 ? '<span class="tag tag--dark detail-media__tag">Hết hàng</span>' : ''}
          </div>
          <p class="detail-media__note">${icon('info', 14)}Ảnh sản phẩm tham khảo</p>
        </div>
        <div class="detail-info">
          <a class="detail-info__brand" href="${productsHash({ search: product.brand })}">${e(product.brand)}</a>
          <h1 class="detail-info__title">${e(product.name)}</h1>
          <div class="detail-info__meta">
            <span>SKU: <strong>${e(product.sku)}</strong></span>
            <span class="dot-sep"><a href="${catHref}">${e(product.category?.name || '')}</a></span>
          </div>
          <div class="price-box">
            <div class="price-box__value">${money(product.price)}</div>
            <div class="price-box__note">Giá niêm yết từ hệ thống · Miễn phí vận chuyển</div>
          </div>
          <div class="detail-info__stock">${stockLine(stock)}</div>
          ${stock > 0 ? `<div class="buy-box">
            <label class="buy-box__label" for="detail-qty">Số lượng</label>
            <div class="buy-row">
              ${qtyStepper('detail-qty', stock)}
              <button class="btn btn--primary btn--lg buy-row__main" data-action="add-to-cart" data-product-id="${e(product.id)}" data-qty-input="detail-qty">${icon('cart', 20)}Thêm vào giỏ hàng</button>
            </div>
            <button class="btn btn--dark btn--lg btn--block" data-action="buy-now" data-product-id="${e(product.id)}" data-qty-input="detail-qty">Mua ngay</button>
          </div>` : `<div class="notice notice--warning">${icon('alertCircle', 20)}<div><strong>Sản phẩm tạm hết hàng</strong><p>Vui lòng quay lại sau hoặc tham khảo sản phẩm tương tự bên dưới.</p></div></div>`}
          <ul class="perks">
            <li>${icon('truck', 20)}<span><strong>Miễn phí vận chuyển</strong>Áp dụng cho mọi đơn hàng</span></li>
            <li>${icon('shield', 20)}<span><strong>Thanh toán an toàn</strong>Qua cổng VNPAY</span></li>
            <li>${icon('badgeCheck', 20)}<span><strong>Hàng chính hãng</strong>${e(product.brand || 'Thương hiệu')} phân phối</span></li>
            <li>${icon('sparkles', 20)}<span><strong>Cần tư vấn?</strong><a href="#/techbot">Hỏi TechBot</a></span></li>
          </ul>
        </div>
      </div>

      <div class="detail-tabs card">
        <div class="tabs tabs--underline" role="tablist" aria-label="Thông tin sản phẩm">
          <button class="tabs__item is-active" role="tab" aria-selected="true" aria-controls="tab-desc" data-action="tab" data-tab="tab-desc">Mô tả sản phẩm</button>
          <button class="tabs__item" role="tab" aria-selected="false" aria-controls="tab-specs" data-action="tab" data-tab="tab-specs">Thông số</button>
        </div>
        <div id="tab-desc" class="tab-panel prose" role="tabpanel">
          <p>${e(product.description || 'Thông tin sản phẩm đang được cập nhật.')}</p>
        </div>
        <div id="tab-specs" class="tab-panel" role="tabpanel" hidden>
          <table class="spec-table"><tbody>${specs.map(([k, v]) => `<tr><th scope="row">${e(k)}</th><td>${e(v)}</td></tr>`).join('')}</tbody></table>
        </div>
      </div>

      ${related.length ? `<section class="section section--flush">
        ${sectionHead('Sản phẩm tương tự', `Cùng danh mục ${product.category?.name || ''}`, seeAll(catHref))}
        ${productGrid(related)}
      </section>` : ''}
    </div>
  </section>`;
}

export function notFoundView({ title = 'Không tìm thấy trang', text = 'Trang bạn tìm không tồn tại hoặc đã được di chuyển.', iconName = 'search' } = {}) {
  return `<section class="page"><div class="container">${emptyState({
    iconName, title, text,
    actions: '<a class="btn btn--primary" href="#/products">Tiếp tục mua sắm</a><a class="btn btn--ghost" href="#/">Về trang chủ</a>',
  })}</div></section>`;
}

/* ============================== cart & checkout ============================== */

function steps(active) {
  const list = ['Giỏ hàng', 'Thông tin giao hàng', 'Thanh toán'];
  return `<ol class="steps" aria-label="Tiến trình mua hàng">${list.map((label, i) => {
    const n = i + 1;
    const cls = n < active ? 'is-done' : n === active ? 'is-active' : '';
    return `<li class="steps__item ${cls}" ${n === active ? 'aria-current="step"' : ''}><span class="steps__dot">${n < active ? icon('check', 14) : n}</span><span class="steps__label">${label}</span></li>`;
  }).join('')}</ol>`;
}

function loginRequired(title, text) {
  return `<section class="page"><div class="container">${emptyState({
    iconName: 'lock', title, text,
    actions: '<button class="btn btn--primary" data-action="open-auth" data-mode="login">Đăng nhập</button><button class="btn btn--ghost" data-action="open-auth" data-mode="register">Tạo tài khoản</button>',
  })}</div></section>`;
}

function summaryRows(cart) {
  const count = cartCount(cart);
  return `<div class="summary">
    <div class="summary__row"><span>Tạm tính (${count} sản phẩm)</span><span>${money(cart.subtotal)}</span></div>
    <div class="summary__row"><span>Phí vận chuyển</span><span class="text-success">Miễn phí</span></div>
    <div class="summary__row summary__row--total"><span>Tổng cộng</span><span>${money(cart.subtotal)}</span></div>
  </div>`;
}

export function cartView(state) {
  if (!state.user) return loginRequired('Đăng nhập để xem giỏ hàng', 'Giỏ hàng được lưu theo tài khoản và đồng bộ trên mọi thiết bị.');
  const items = state.cart?.items || [];
  if (!items.length) {
    return `<section class="page"><div class="container">
      ${breadcrumb([{ label: 'Trang chủ', href: '#/' }, { label: 'Giỏ hàng' }])}
      ${emptyState({ iconName: 'cart', title: 'Giỏ hàng của bạn đang trống', text: 'Khám phá các sản phẩm công nghệ và thêm vào giỏ để bắt đầu.', actions: `<a class="btn btn--primary btn--lg" href="#/products">${icon('arrowLeft', 18)}Tiếp tục mua sắm</a>` })}
    </div></section>`;
  }
  return `<section class="page page--cart">
    <div class="container">
      ${breadcrumb([{ label: 'Trang chủ', href: '#/' }, { label: 'Giỏ hàng' }])}
      <div class="page-head page-head--row">
        <h1 class="page-title">Giỏ hàng <span class="page-title__count">(${cartCount(state.cart)} sản phẩm)</span></h1>
        ${steps(1)}
      </div>
      <div class="split">
        <div class="card card--flush">
          <div class="cart-head" aria-hidden="true"><span>Sản phẩm</span><span>Đơn giá</span><span>Số lượng</span><span>Thành tiền</span><span></span></div>
          <ul class="cart-list">
            ${items.map((item) => {
              const p = item.product;
              const stock = Number(p.stockQuantity || 0);
              const href = `#/products/${encodeURIComponent(p.id)}`;
              const over = item.quantity > stock;
              return `<li class="cart-item" data-cart-item="${e(item.id)}">
                <a class="cart-item__media" href="${href}" tabindex="-1" aria-hidden="true">${productMedia(p, 'art--sm')}</a>
                <div class="cart-item__info">
                  <a class="cart-item__name" href="${href}">${e(p.name)}</a>
                  <span class="cart-item__sku">SKU: ${e(p.sku)}</span>
                  ${over ? `<span class="stock stock--out"><span class="stock__dot"></span>Chỉ còn ${stock} sản phẩm</span>` : stockLine(stock)}
                </div>
                <div class="cart-item__price"><span class="cart-item__label">Đơn giá</span>${money(p.price)}</div>
                <div class="cart-item__qty">
                  <div class="qty qty--sm">
                    <button type="button" class="qty__btn" data-action="cart-step" data-step="-1" data-item-id="${e(item.id)}" aria-label="Giảm số lượng ${e(p.name)}" ${item.quantity <= 1 ? 'disabled' : ''}>${icon('minus', 14)}</button>
                    <input class="qty__input" type="number" min="1" max="${Math.max(1, Math.min(999, stock))}" value="${e(item.quantity)}" data-action="cart-set" data-item-id="${e(item.id)}" aria-label="Số lượng ${e(p.name)}">
                    <button type="button" class="qty__btn" data-action="cart-step" data-step="1" data-item-id="${e(item.id)}" aria-label="Tăng số lượng ${e(p.name)}" ${item.quantity >= stock ? 'disabled' : ''}>${icon('plus', 14)}</button>
                  </div>
                </div>
                <div class="cart-item__total"><span class="cart-item__label">Thành tiền</span>${money(item.lineTotal)}</div>
                <button class="icon-btn cart-item__remove" data-action="cart-remove" data-item-id="${e(item.id)}" aria-label="Xóa ${e(p.name)} khỏi giỏ">${icon('trash', 18)}</button>
              </li>`;
            }).join('')}
          </ul>
          <div class="cart-foot"><a class="link-arrow link-arrow--back" href="#/products">${icon('arrowLeft', 16)}Tiếp tục mua sắm</a></div>
        </div>
        <aside class="card summary-card" aria-label="Tóm tắt đơn hàng">
          <h2 class="card__title">Tóm tắt đơn hàng</h2>
          ${summaryRows(state.cart)}
          <a class="btn btn--primary btn--lg btn--block" href="#/checkout">Tiến hành thanh toán${icon('arrowRight', 18)}</a>
          <ul class="assurance">
            <li>${icon('shield', 16)}Giá và tồn kho được xác thực lại khi đặt hàng</li>
            <li>${icon('lock', 16)}Thanh toán an toàn qua VNPAY</li>
          </ul>
        </aside>
      </div>
    </div>
  </section>`;
}

export function checkoutView(state) {
  if (!state.user) return loginRequired('Đăng nhập để thanh toán', 'Bạn cần đăng nhập để tạo đơn hàng và thanh toán.');
  const items = state.cart?.items || [];
  if (!items.length) {
    return `<section class="page"><div class="container">${emptyState({ iconName: 'cart', title: 'Giỏ hàng đang trống', text: 'Thêm sản phẩm vào giỏ trước khi thanh toán.', actions: '<a class="btn btn--primary" href="#/products">Chọn sản phẩm</a>' })}</div></section>`;
  }
  return `<section class="page page--checkout">
    <div class="container">
      ${breadcrumb([{ label: 'Trang chủ', href: '#/' }, { label: 'Giỏ hàng', href: '#/cart' }, { label: 'Thanh toán' }])}
      <div class="page-head page-head--row">
        <h1 class="page-title">Thanh toán</h1>
        ${steps(2)}
      </div>
      <div class="split">
        <form id="checkout-form" class="checkout-form" novalidate>
          <div class="card">
            <h2 class="card__title"><span class="card__num">1</span>Thông tin người nhận</h2>
            <div class="form-grid form-grid--2">
              ${field({ id: 'co-name', name: 'recipientName', label: 'Họ và tên', value: state.user.fullName, autocomplete: 'name', attrs: 'minlength="2" maxlength="120" required' })}
              ${field({ id: 'co-phone', name: 'recipientPhone', label: 'Số điện thoại', type: 'tel', autocomplete: 'tel', placeholder: 'Nhập số điện thoại', attrs: 'maxlength="20" inputmode="tel" required' })}
            </div>
            <div class="field" data-field="shippingAddress">
              <label class="field__label" for="co-address">Địa chỉ giao hàng</label>
              <textarea class="input textarea" id="co-address" name="shippingAddress" rows="3" minlength="8" maxlength="500" autocomplete="street-address" placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố" aria-describedby="co-address-error co-address-hint" required></textarea>
              <p class="field__hint" id="co-address-hint">${icon('lock', 14)}Số điện thoại và địa chỉ được mã hóa AES-256-GCM khi lưu trữ.</p>
              <p class="field__error" id="co-address-error" role="alert"></p>
            </div>
          </div>
          <div class="card">
            <h2 class="card__title"><span class="card__num">2</span>Phương thức thanh toán</h2>
            <label class="pay-option is-selected">
              <input type="radio" name="paymentMethod" value="vnpay" checked>
              <span class="pay-option__logo">VNPAY</span>
              <span class="pay-option__text"><strong>Thanh toán qua VNPAY</strong><span>ATM nội địa, thẻ quốc tế, QR ngân hàng (Sandbox)</span></span>
              <span class="pay-option__check">${icon('checkCircle', 22)}</span>
            </label>
            <p class="pay-note">${icon('info', 16)}Sau khi đặt hàng, bạn sẽ được chuyển sang cổng VNPAY để hoàn tất thanh toán. Số tiền được máy chủ tính lại từ cơ sở dữ liệu.</p>
          </div>
        </form>
        <aside class="card summary-card" aria-label="Đơn hàng của bạn">
          <h2 class="card__title">Đơn hàng của bạn</h2>
          <ul class="mini-items">
            ${items.map((item) => `<li class="mini-item">
              <span class="mini-item__media">${productMedia(item.product, 'art--xs')}<span class="mini-item__qty">${e(item.quantity)}</span></span>
              <span class="mini-item__name">${e(item.product.name)}<small>${money(item.product.price)} × ${e(item.quantity)}</small></span>
              <span class="mini-item__total">${money(item.lineTotal)}</span>
            </li>`).join('')}
          </ul>
          ${summaryRows(state.cart)}
          <div class="form-alert" data-form-alert role="alert" hidden></div>
          <button class="btn btn--primary btn--lg btn--block" type="submit" form="checkout-form" data-checkout-submit>${icon('lock', 18)}Đặt hàng &amp; thanh toán VNPAY</button>
          <p class="legal">Bằng việc đặt hàng, bạn đồng ý với <a href="#/policies">chính sách</a> của TechGear.</p>
        </aside>
      </div>
    </div>
  </section>`;
}

/* ============================== account & orders ============================== */

function accountSidebar(state, active) {
  const links = [
    ['account', '#/account', 'user', 'Tài khoản của tôi'],
    ['orders', '#/orders', 'receipt', 'Đơn hàng của tôi'],
    ['cart', '#/cart', 'cart', 'Giỏ hàng'],
    ['techbot', '#/techbot', 'sparkles', 'TechBot tư vấn'],
  ];
  return `<aside class="account-nav card">
    <div class="account-nav__user">
      <span class="avatar avatar--lg">${e(initials(state.user.fullName))}</span>
      <div><strong>${e(state.user.fullName)}</strong><span>${e(state.user.email)}</span></div>
    </div>
    <nav aria-label="Tài khoản">${links.map(([key, href, ic, label]) => `<a class="account-nav__link ${active === key ? 'is-active' : ''}" href="${href}" ${active === key ? 'aria-current="page"' : ''}>${icon(ic, 18)}${label}</a>`).join('')}
      <button class="account-nav__link" data-action="logout">${icon('logout', 18)}Đăng xuất</button>
    </nav>
  </aside>`;
}

function orderCard(order) {
  return `<article class="order-card">
    <div class="order-card__head">
      <div><span class="order-card__label">Mã đơn hàng</span><strong class="order-card__number">${e(order.orderNumber)}</strong></div>
      ${statusBadge(order.status)}
    </div>
    <div class="order-card__body">
      <div><span class="order-card__label">Ngày đặt</span><span>${formatDate(order.createdAt)}</span></div>
      <div><span class="order-card__label">Người nhận</span><span>${e(order.recipientName || '—')}</span></div>
      <div><span class="order-card__label">Tổng tiền</span><strong class="order-card__total">${money(order.grandTotal)}</strong></div>
      <a class="btn btn--outline btn--sm" href="#/orders/${encodeURIComponent(order.id)}">Xem chi tiết${icon('chevronRight', 16)}</a>
    </div>
  </article>`;
}

const ORDER_FILTERS = [
  ['all', 'Tất cả', () => true],
  ['pending', 'Chờ thanh toán', (o) => ['pending', 'payment_pending'].includes(o.status)],
  ['paid', 'Đã thanh toán', (o) => ['paid', 'processing', 'shipped', 'completed'].includes(o.status)],
  ['cancelled', 'Đã hủy / lỗi', (o) => ['cancelled', 'payment_failed'].includes(o.status)],
];

export function ordersView(state, orders, filter = 'all') {
  if (!state.user) return loginRequired('Đăng nhập để xem đơn hàng', 'Theo dõi trạng thái đơn hàng và thanh toán của bạn.');
  const active = ORDER_FILTERS.find(([k]) => k === filter) || ORDER_FILTERS[0];
  const list = orders.filter(active[2]);
  return `<section class="page"><div class="container">
    ${breadcrumb([{ label: 'Trang chủ', href: '#/' }, { label: 'Tài khoản', href: '#/account' }, { label: 'Đơn hàng' }])}
    <div class="account-layout">
      ${accountSidebar(state, 'orders')}
      <div class="account-main">
        <div class="page-head"><h1 class="page-title">Đơn hàng của tôi</h1><p class="page-subtitle">Chỉ hiển thị đơn hàng thuộc tài khoản của bạn.</p></div>
        <div class="tabs tabs--pill" role="tablist" aria-label="Lọc đơn hàng">
          ${ORDER_FILTERS.map(([key, label, fn]) => `<a class="tabs__item ${key === active[0] ? 'is-active' : ''}" role="tab" aria-selected="${key === active[0]}" href="#/orders${key === 'all' ? '' : `?filter=${key}`}">${label}<span class="tabs__count">${orders.filter(fn).length}</span></a>`).join('')}
        </div>
        ${list.length ? `<div class="order-list">${list.map(orderCard).join('')}</div>`
          : emptyState({ iconName: 'receipt', title: orders.length ? 'Không có đơn hàng ở mục này' : 'Bạn chưa có đơn hàng nào', text: orders.length ? 'Chọn mục khác để xem các đơn hàng còn lại.' : 'Hãy chọn sản phẩm yêu thích và đặt đơn đầu tiên.', actions: '<a class="btn btn--primary" href="#/products">Mua sắm ngay</a>' })}
      </div>
    </div>
  </div></section>`;
}

const TRACK_STEPS = [
  ['Đặt hàng', 'package'],
  ['Thanh toán', 'creditCard'],
  ['Xử lý', 'store'],
  ['Vận chuyển', 'truck'],
  ['Hoàn tất', 'checkCircle'],
];
const TRACK_INDEX = { pending: 0, payment_pending: 0, paid: 1, processing: 2, shipped: 3, completed: 4 };

function orderTracker(status) {
  if (status === 'cancelled' || status === 'payment_failed') {
    return `<div class="notice notice--${status === 'cancelled' ? 'neutral' : 'danger'}">${icon('alertCircle', 20)}<div><strong>${status === 'cancelled' ? 'Đơn hàng đã được hủy' : 'Thanh toán không thành công'}</strong><p>${status === 'cancelled' ? 'Tồn kho của các sản phẩm đã được hoàn lại.' : 'Giao dịch VNPAY chưa hoàn tất cho đơn hàng này.'}</p></div></div>`;
  }
  const idx = TRACK_INDEX[status] ?? 0;
  return `<ol class="tracker" aria-label="Trạng thái đơn hàng">${TRACK_STEPS.map(([label, ic], i) => {
    const cls = i <= idx ? 'is-done' : i === idx + 1 ? 'is-next' : '';
    return `<li class="tracker__step ${cls}"><span class="tracker__icon">${icon(ic, 18)}</span><span class="tracker__label">${label}</span></li>`;
  }).join('')}</ol>`;
}

export function orderDetailView(order, paymentHint = '') {
  const canPay = order.status === 'payment_pending' && order.payment?.status === 'pending';
  const canCancel = ['pending', 'payment_pending'].includes(order.status);
  const pay = order.payment;
  const hint = paymentHint === 'success'
    ? `<div class="notice notice--success">${icon('checkCircle', 20)}<div><strong>VNPAY đã trả kết quả thành công</strong><p>Hệ thống sẽ xác nhận đơn hàng khi nhận được thông báo IPN từ VNPAY.</p></div></div>`
    : paymentHint === 'failed'
      ? `<div class="notice notice--danger">${icon('alertCircle', 20)}<div><strong>Thanh toán VNPAY chưa thành công</strong><p>Bạn có thể thử thanh toán lại cho đơn hàng này.</p></div></div>`
      : '';
  return `<section class="page page--order"><div class="container">
    ${breadcrumb([{ label: 'Trang chủ', href: '#/' }, { label: 'Đơn hàng', href: '#/orders' }, { label: order.orderNumber }])}
    ${hint}
    <div class="order-hero card">
      <div class="order-hero__main">
        <span class="order-card__label">Đơn hàng</span>
        <h1 class="order-hero__number">${e(order.orderNumber)}</h1>
        <p class="order-hero__date">${icon('clock', 16)}Đặt lúc ${formatDate(order.createdAt)}</p>
      </div>
      <div class="order-hero__side">
        ${statusBadge(order.status)}
        <div class="order-hero__actions">
          ${canPay ? `<button class="btn btn--primary" data-action="pay-vnpay" data-order="${e(order.id)}">${icon('creditCard', 18)}Thanh toán bằng VNPAY</button>` : ''}
          ${canCancel ? `<button class="btn btn--danger-outline" data-action="cancel-order" data-order="${e(order.id)}">Hủy đơn hàng</button>` : ''}
        </div>
      </div>
      <div class="order-hero__tracker">${orderTracker(order.status)}</div>
    </div>
    <div class="split">
      <div class="card card--flush">
        <h2 class="card__title card__title--pad">Sản phẩm (${order.items.length})</h2>
        <ul class="order-items">
          ${order.items.map((i) => `<li class="order-item">
            <span class="order-item__media">${productMedia({ sku: i.sku, name: i.productName }, 'art--sm')}</span>
            <div class="order-item__info">
              ${i.productId ? `<a href="#/products/${encodeURIComponent(i.productId)}">${e(i.productName)}</a>` : `<span>${e(i.productName)}</span>`}
              <small>SKU: ${e(i.sku)} · ${money(i.unitPrice)} × ${e(i.quantity)}</small>
            </div>
            <strong class="order-item__total">${money(i.lineTotal)}</strong>
          </li>`).join('')}
        </ul>
        <div class="summary summary--pad">
          <div class="summary__row"><span>Tạm tính</span><span>${money(order.subtotal)}</span></div>
          <div class="summary__row"><span>Phí vận chuyển</span><span>${Number(order.shippingFee) ? money(order.shippingFee) : '<span class="text-success">Miễn phí</span>'}</span></div>
          ${Number(order.discountTotal) ? `<div class="summary__row"><span>Giảm giá</span><span class="text-success">−${money(order.discountTotal)}</span></div>` : ''}
          <div class="summary__row summary__row--total"><span>Tổng cộng</span><span>${money(order.grandTotal)}</span></div>
        </div>
      </div>
      <div class="stack">
        <div class="card">
          <h2 class="card__title">${icon('mapPin', 18)}Thông tin nhận hàng</h2>
          <dl class="kv">
            <div><dt>Người nhận</dt><dd>${e(order.recipient?.name)}</dd></div>
            <div><dt>Điện thoại</dt><dd>${e(order.recipient?.phone)}</dd></div>
            <div><dt>Địa chỉ</dt><dd>${e(order.recipient?.shippingAddress)}</dd></div>
          </dl>
        </div>
        <div class="card">
          <h2 class="card__title">${icon('creditCard', 18)}Thanh toán</h2>
          <dl class="kv">
            <div><dt>Phương thức</dt><dd><span class="pay-chip">VNPAY</span></dd></div>
            <div><dt>Trạng thái</dt><dd>${pay ? statusBadge(pay.status, PAYMENT_STATUS) : '—'}</dd></div>
            <div><dt>Số tiền</dt><dd><strong>${money(pay ? pay.amount : order.grandTotal)}</strong></dd></div>
            ${pay?.providerTransactionRef ? `<div><dt>Mã giao dịch</dt><dd class="mono">${e(pay.providerTransactionRef)}</dd></div>` : ''}
            ${pay?.providerResponseCode ? `<div><dt>Mã phản hồi</dt><dd class="mono">${e(pay.providerResponseCode)}</dd></div>` : ''}
            ${pay?.paidAt ? `<div><dt>Thanh toán lúc</dt><dd>${formatDate(pay.paidAt)}</dd></div>` : ''}
          </dl>
        </div>
      </div>
    </div>
  </div></section>`;
}

export function accountView(state, orders) {
  if (!state.user) return loginRequired('Chào mừng đến TechGear', 'Đăng nhập để quản lý giỏ hàng, đơn hàng và thông tin tài khoản.');
  const u = state.user;
  const recent = orders.slice(0, 3);
  const pending = orders.filter((o) => ['pending', 'payment_pending'].includes(o.status)).length;
  return `<section class="page"><div class="container">
    ${breadcrumb([{ label: 'Trang chủ', href: '#/' }, { label: 'Tài khoản' }])}
    <div class="account-layout">
      ${accountSidebar(state, 'account')}
      <div class="account-main">
        <div class="page-head"><h1 class="page-title">Xin chào, ${e(firstName(u.fullName) || u.fullName)}</h1><p class="page-subtitle">Quản lý thông tin tài khoản và đơn hàng của bạn.</p></div>
        <div class="stat-grid">
          <div class="stat"><span class="stat__icon">${icon('receipt', 22)}</span><div><strong>${orders.length}</strong><span>Tổng đơn hàng</span></div></div>
          <div class="stat"><span class="stat__icon stat__icon--warning">${icon('clock', 22)}</span><div><strong>${pending}</strong><span>Chờ thanh toán</span></div></div>
          <div class="stat"><span class="stat__icon stat__icon--success">${icon('cart', 22)}</span><div><strong>${cartCount(state.cart)}</strong><span>Sản phẩm trong giỏ</span></div></div>
        </div>
        <div class="split split--even">
          <div class="card">
            <h2 class="card__title">Thông tin cá nhân</h2>
            <dl class="kv">
              <div><dt>Họ và tên</dt><dd>${e(u.fullName)}</dd></div>
              <div><dt>Email</dt><dd>${e(u.email)}</dd></div>
              <div><dt>Vai trò</dt><dd><span class="badge badge--info">${e(u.role)}</span></dd></div>
              <div><dt>Trạng thái</dt><dd><span class="badge badge--success">${e(u.status)}</span></dd></div>
            </dl>
          </div>
          <div class="card">
            <h2 class="card__title">Bảo mật phiên đăng nhập</h2>
            <dl class="kv">
              <div><dt>Hết hạn phiên</dt><dd>${formatDate(state.session?.expiresAt)}</dd></div>
              <div><dt>Loại phiên</dt><dd>Cookie HttpOnly · SameSite</dd></div>
            </dl>
            <button class="btn btn--ghost btn--sm" data-action="logout">${icon('logout', 16)}Đăng xuất khỏi thiết bị này</button>
          </div>
        </div>
        <div class="card card--flush">
          <div class="card__head"><h2 class="card__title">Đơn hàng gần đây</h2>${orders.length ? seeAll('#/orders') : ''}</div>
          ${recent.length ? `<div class="table-wrap"><table class="table">
            <thead><tr><th scope="col">Mã đơn</th><th scope="col">Ngày đặt</th><th scope="col">Trạng thái</th><th scope="col" class="num">Tổng tiền</th><th scope="col"><span class="sr-only">Thao tác</span></th></tr></thead>
            <tbody>${recent.map((o) => `<tr><td class="mono">${e(o.orderNumber)}</td><td>${formatShortDate(o.createdAt)}</td><td>${statusBadge(o.status)}</td><td class="num"><strong>${money(o.grandTotal)}</strong></td><td class="num"><a class="link-btn" href="#/orders/${encodeURIComponent(o.id)}">Chi tiết</a></td></tr>`).join('')}</tbody>
          </table></div>` : `<div class="card__pad">${emptyState({ iconName: 'receipt', title: 'Chưa có đơn hàng', compact: true, actions: '<a class="btn btn--primary btn--sm" href="#/products">Mua sắm ngay</a>' })}</div>`}
        </div>
      </div>
    </div>
  </div></section>`;
}

export function paymentResultView(status, code) {
  const ok = status === 'success';
  const failed = status === 'failed';
  return `<section class="page"><div class="container">
    <div class="result card">
      <div class="result__icon result__icon--${ok ? 'success' : failed ? 'warning' : 'danger'}">${icon(ok ? 'checkCircle' : 'alertCircle', 40)}</div>
      <h1>${ok ? 'VNPAY đã trả kết quả thành công' : failed ? 'Thanh toán chưa thành công' : 'Không thể xác thực kết quả VNPAY'}</h1>
      <p>${ok ? 'Đơn hàng sẽ được xác nhận khi hệ thống nhận thông báo IPN từ VNPAY.' : 'Bạn có thể kiểm tra lại đơn hàng và thử thanh toán lần nữa.'}</p>
      <p class="result__code">Mã phản hồi: <span class="mono">${e(code || 'N/A')}</span></p>
      <div class="result__actions"><a class="btn btn--primary" href="#/orders">Xem đơn hàng</a><a class="btn btn--ghost" href="#/products">Tiếp tục mua sắm</a></div>
    </div>
  </div></section>`;
}

/* ============================== policies ============================== */

export function policiesView() {
  const sections = [
    ['security', 'shield', 'Bảo mật thông tin', [
      'Toàn bộ kết nối được phục vụ qua HTTPS/TLS và đi qua tường lửa ứng dụng web (ModSecurity + OWASP CRS).',
      'Mật khẩu được băm bằng bcrypt; phiên đăng nhập dùng cookie HttpOnly, SameSite và chỉ lưu giá trị băm SHA-256 của token phía máy chủ.',
      'Số điện thoại và địa chỉ giao hàng được mã hóa AES-256-GCM trước khi lưu vào cơ sở dữ liệu.',
      'Mỗi tài khoản chỉ xem được giỏ hàng và đơn hàng của chính mình.',
    ]],
    ['payment', 'creditCard', 'Thanh toán', [
      'TechGear hỗ trợ thanh toán qua cổng VNPAY (môi trường Sandbox cho mục đích demo).',
      'Số tiền thanh toán luôn được máy chủ tính lại từ cơ sở dữ liệu, không dựa trên dữ liệu gửi từ trình duyệt.',
      'Kết quả giao dịch được xác thực bằng chữ ký HMAC-SHA512 và đối soát qua kênh IPN máy chủ – máy chủ.',
    ]],
    ['shipping', 'truck', 'Vận chuyển', [
      'Miễn phí vận chuyển cho mọi đơn hàng.',
      'Đơn hàng được xử lý sau khi thanh toán được xác nhận.',
    ]],
    ['returns', 'refresh', 'Đổi trả', [
      'Nội dung minh họa cho dự án demo: sản phẩm lỗi do nhà sản xuất có thể được hỗ trợ đổi trả theo chính sách của hãng.',
      'Đơn hàng ở trạng thái chờ thanh toán có thể được hủy trực tiếp trong trang chi tiết đơn hàng; tồn kho sẽ được hoàn lại.',
    ]],
  ];
  return `<section class="page"><div class="container container--narrow">
    ${breadcrumb([{ label: 'Trang chủ', href: '#/' }, { label: 'Chính sách' }])}
    <div class="page-head"><h1 class="page-title">Chính sách TechGear</h1><p class="page-subtitle">Minh bạch về bảo mật, thanh toán, vận chuyển và đổi trả.</p></div>
    <div class="stack">${sections.map(([id, ic, title, items]) => `<article class="card policy" id="policy-${id}">
      <h2 class="card__title">${icon(ic, 20)}${title}</h2>
      <ul class="check-list">${items.map((t) => `<li>${icon('check', 16)}<span>${e(t)}</span></li>`).join('')}</ul>
    </article>`).join('')}</div>
  </div></section>`;
}

/* ============================== TechBot ============================== */

function formatBotText(text) {
  const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const lines = e(text).split(/\r?\n/);
  let html = '';
  let inList = false;
  lines.forEach((raw) => {
    const line = raw.trim();
    const m = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (m) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(m[1])}</li>`;
      return;
    }
    if (inList) { html += '</ul>'; inList = false; }
    if (line) html += `<p>${inline(line)}</p>`;
  });
  if (inList) html += '</ul>';
  return html;
}

function recommendationCards(recs) {
  if (!recs?.length) return '';
  return `<div class="tb-recs">${recs.map((r) => `<div class="tb-rec">
    <a class="tb-rec__media" href="#/products/${encodeURIComponent(r.id)}" tabindex="-1" aria-hidden="true">${productMedia({ name: r.name, category: r.category }, 'art--xs')}</a>
    <div class="tb-rec__info">
      <a class="tb-rec__name" href="#/products/${encodeURIComponent(r.id)}">${e(r.name)}</a>
      <span class="tb-rec__meta">${e(r.category || '')}</span>
      <strong class="tb-rec__price">${money(r.price)}</strong>
    </div>
    <button class="icon-btn icon-btn--soft" data-action="add-to-cart" data-product-id="${e(r.id)}" aria-label="Thêm ${e(r.name)} vào giỏ" ${Number(r.stockQuantity) <= 0 ? 'disabled' : ''}>${icon('cart', 18)}</button>
  </div>`).join('')}</div>`;
}

const BOT_AVATAR = `<span class="tb-avatar" aria-hidden="true">${icon('bot', 18)}</span>`;

export function techbotMessages(tb) {
  if (!tb.messages.length && !tb.pending) {
    return `<div class="tb-empty">
      <span class="tb-empty__icon">${icon('sparkles', 28)}</span>
      <h3>Xin chào! Mình là TechBot 👋</h3>
      <p>Hãy cho mình biết nhu cầu, ngân sách hoặc loại sản phẩm bạn quan tâm.</p>
      <div class="tb-suggestions">${TECHBOT_SUGGESTIONS.map((s) => `<button class="chip chip--action" data-action="techbot-ask" data-q="${e(s)}">${e(s)}</button>`).join('')}</div>
    </div>`;
  }
  const items = tb.messages.map((m) => {
    if (m.role === 'user') return `<div class="tb-msg tb-msg--user"><div class="tb-bubble">${e(m.text)}</div></div>`;
    if (m.role === 'error') {
      return `<div class="tb-msg tb-msg--bot">${BOT_AVATAR}<div class="tb-bubble tb-bubble--error">
        <p>${icon('alertCircle', 16)} ${e(m.text)}</p>
        ${m.retry ? `<button class="btn btn--outline btn--xs" data-action="techbot-retry" data-q="${e(m.retry)}">${icon('refresh', 14)}Thử lại</button>` : ''}
      </div></div>`;
    }
    return `<div class="tb-msg tb-msg--bot">${BOT_AVATAR}<div class="tb-body">
      <div class="tb-bubble">${formatBotText(m.text)}</div>
      ${recommendationCards(m.recommendations)}
      <span class="tb-engine">${m.engine === 'ollama' ? 'AI · Ollama' : 'Gợi ý từ catalog an toàn'}</span>
    </div></div>`;
  }).join('');
  const typing = tb.pending ? `<div class="tb-msg tb-msg--bot">${BOT_AVATAR}<div class="tb-bubble tb-typing" role="status" aria-label="TechBot đang trả lời"><span></span><span></span><span></span></div></div>` : '';
  return items + typing;
}

function techbotComposer(tb, id) {
  return `<form class="tb-form" data-techbot-form>
    <label class="sr-only" for="${id}">Câu hỏi cho TechBot</label>
    <input class="tb-input" id="${id}" name="question" maxlength="600" autocomplete="off" placeholder="Ví dụ: Chuột gaming dưới 2 triệu…" ${tb.pending ? 'disabled' : ''} required>
    <button class="tb-send" type="submit" aria-label="Gửi câu hỏi" ${tb.pending ? 'disabled' : ''}>${icon('send', 18)}</button>
  </form>`;
}

function techbotHeader(compact) {
  return `<div class="tb-head">
    <span class="tb-avatar tb-avatar--lg" aria-hidden="true">${icon('bot', 22)}</span>
    <div class="tb-head__text"><strong>TechBot Advisor</strong><span><span class="online-dot" aria-hidden="true"></span>Trợ lý mua sắm · catalog công khai</span></div>
    <button class="icon-btn" data-action="techbot-clear" aria-label="Xóa cuộc trò chuyện" title="Cuộc trò chuyện mới">${icon('refresh', 18)}</button>
    ${compact ? `<button class="icon-btn" data-action="techbot-toggle" aria-label="Thu gọn TechBot">${icon('close', 20)}</button>` : ''}
  </div>`;
}

export function techbotView(tb) {
  return `<section class="page page--techbot"><div class="container">
    ${breadcrumb([{ label: 'Trang chủ', href: '#/' }, { label: 'TechBot' }])}
    <div class="tb-layout">
      <div class="tb-panel card card--flush">
        ${techbotHeader(false)}
        <div class="tb-messages" data-tb-messages aria-live="polite">${techbotMessages(tb)}</div>
        <div class="tb-composer">${techbotComposer(tb, 'tb-page-input')}<p class="tb-hint">${icon('shield', 14)}TechBot không truy cập đơn hàng, phiên đăng nhập hay dữ liệu riêng tư. Giới hạn 5 câu/phút.</p></div>
      </div>
      <aside class="tb-side">
        <div class="card">
          <h2 class="card__title">${icon('sparkles', 18)}Gợi ý câu hỏi</h2>
          <div class="tb-side__list">${[...TECHBOT_SUGGESTIONS, 'Bàn phím cơ dưới 2 triệu', 'Màn hình gaming 27 inch'].map((s) => `<button class="tb-side__q" data-action="techbot-ask" data-q="${e(s)}">${icon('chat', 16)}<span>${e(s)}</span>${icon('arrowRight', 14)}</button>`).join('')}</div>
        </div>
        <div class="card card--tint">
          <h2 class="card__title">${icon('shield', 18)}TechBot an toàn</h2>
          <ul class="check-list check-list--sm">
            <li>${icon('check', 14)}<span>Chỉ dùng dữ liệu catalog công khai</span></li>
            <li>${icon('check', 14)}<span>Lọc prompt injection &amp; yêu cầu lấy dữ liệu nội bộ</span></li>
            <li>${icon('check', 14)}<span>Không truy cập đơn hàng hay thông tin cá nhân</span></li>
          </ul>
        </div>
        <div class="card">
          <h2 class="card__title">${icon('info', 18)}Mẹo hỏi hiệu quả</h2>
          <p class="muted">Nêu <strong>ngân sách</strong> + <strong>nhu cầu</strong> (gaming, văn phòng, lập trình) + <strong>loại sản phẩm</strong> để nhận gợi ý chính xác hơn.</p>
        </div>
      </aside>
    </div>
  </div></section>`;
}

export function techbotWidget(tb, hidden) {
  if (hidden) return '';
  return `<div class="tb-widget ${tb.open ? 'is-open' : ''}">
    ${tb.open ? `<div class="tb-popup card card--flush" role="dialog" aria-label="TechBot Advisor">
      ${techbotHeader(true)}
      <div class="tb-messages tb-messages--compact" data-tb-messages aria-live="polite">${techbotMessages(tb)}</div>
      <div class="tb-composer">${techbotComposer(tb, 'tb-widget-input')}<a class="tb-expand" href="#/techbot">Mở trang TechBot đầy đủ${icon('arrowRight', 14)}</a></div>
    </div>` : ''}
    <button class="tb-launcher" data-action="techbot-toggle" aria-expanded="${tb.open}" aria-label="${tb.open ? 'Đóng TechBot' : 'Mở TechBot tư vấn'}">
      ${tb.open ? icon('close', 24) : icon('bot', 26)}<span class="tb-launcher__label">${tb.open ? '' : 'Hỏi TechBot'}</span>
    </button>
  </div>`;
}
