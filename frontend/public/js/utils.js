// Shared formatting, escaping and validation helpers.
// Validation rules mirror the backend so users get immediate feedback;
// the backend remains the source of truth and re-validates everything.

const currencyFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
const shortDateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const money = (value) => currencyFormatter.format(Number(value || 0));

export const formatDate = (value) => (value ? dateFormatter.format(new Date(value)) : '—');

export const formatShortDate = (value) => (value ? shortDateFormatter.format(new Date(value)) : '—');

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (ch) => HTML_ESCAPES[ch]);

export const ORDER_STATUS = {
  pending: { label: 'Chờ xử lý', tone: 'warning' },
  payment_pending: { label: 'Chờ thanh toán', tone: 'warning' },
  paid: { label: 'Đã thanh toán', tone: 'success' },
  processing: { label: 'Đang xử lý', tone: 'info' },
  shipped: { label: 'Đang giao', tone: 'info' },
  completed: { label: 'Hoàn tất', tone: 'success' },
  cancelled: { label: 'Đã hủy', tone: 'neutral' },
  payment_failed: { label: 'Thanh toán lỗi', tone: 'danger' },
};

export const PAYMENT_STATUS = {
  pending: { label: 'Chờ thanh toán', tone: 'warning' },
  paid: { label: 'Đã thanh toán', tone: 'success' },
  success: { label: 'Thành công', tone: 'success' },
  failed: { label: 'Thất bại', tone: 'danger' },
  cancelled: { label: 'Đã hủy', tone: 'neutral' },
  expired: { label: 'Hết hạn', tone: 'neutral' },
};

export function statusMeta(status, table = ORDER_STATUS) {
  return table[status] || { label: status || '—', tone: 'neutral' };
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'TG';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

export function firstName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

export function debounce(fn, wait = 250) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

export function clampQuantity(value, max = 999) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, Math.max(1, max));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 ()-]{8,20}$/;

export const validators = {
  email(value) {
    const v = String(value || '').trim();
    if (!v) return 'Vui lòng nhập email.';
    if (v.length > 254 || !EMAIL_RE.test(v)) return 'Email không hợp lệ.';
    return '';
  },
  loginPassword(value) {
    const v = String(value || '');
    if (!v) return 'Vui lòng nhập mật khẩu.';
    if (v.length > 128) return 'Mật khẩu tối đa 128 ký tự.';
    return '';
  },
  registerPassword(value) {
    const v = String(value || '');
    if (!v) return 'Vui lòng nhập mật khẩu.';
    if (v.length < 12) return 'Mật khẩu cần tối thiểu 12 ký tự.';
    if (v.length > 128) return 'Mật khẩu tối đa 128 ký tự.';
    return '';
  },
  fullName(value) {
    const v = String(value || '').trim();
    if (!v) return 'Vui lòng nhập họ và tên.';
    if (v.length > 120) return 'Họ tên tối đa 120 ký tự.';
    return '';
  },
  recipientName(value) {
    const v = String(value || '').trim();
    if (v.length < 2) return 'Họ tên người nhận cần ít nhất 2 ký tự.';
    if (v.length > 120) return 'Họ tên tối đa 120 ký tự.';
    return '';
  },
  phone(value) {
    const v = String(value || '').trim();
    if (!v) return 'Vui lòng nhập số điện thoại.';
    if (!PHONE_RE.test(v)) return 'Số điện thoại không hợp lệ (8–20 chữ số).';
    return '';
  },
  address(value) {
    const v = String(value || '').trim();
    if (v.length < 8) return 'Địa chỉ cần ít nhất 8 ký tự.';
    if (v.length > 500) return 'Địa chỉ tối đa 500 ký tự.';
    return '';
  },
};

// Returns 0..4 – a lightweight hint only; the backend enforces the real policy.
export function passwordStrength(value) {
  const v = String(value || '');
  if (!v) return 0;
  let score = 0;
  if (v.length >= 12) score += 1;
  if (v.length >= 16) score += 1;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score += 1;
  if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) score += 1;
  return Math.min(score, 4);
}
