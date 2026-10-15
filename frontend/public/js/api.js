// Thin fetch wrapper for the existing TechGear REST API (/api/v1).
// Endpoints and payloads are unchanged; this module only adds friendly
// Vietnamese error messages for the UI.

export const API_BASE = '/api/v1';

const FRIENDLY_ERRORS = {
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  EMAIL_ALREADY_REGISTERED: 'Email này đã được đăng ký. Hãy đăng nhập.',
  INVALID_EMAIL: 'Email không hợp lệ.',
  INVALID_PASSWORD: 'Mật khẩu cần từ 12 đến 128 ký tự.',
  INVALID_FULL_NAME: 'Họ tên cần từ 1 đến 120 ký tự.',
  AUTH_REQUIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  FORBIDDEN: 'Yêu cầu đã bị hệ thống bảo mật chặn.',
  RATE_LIMITED: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau giây lát.',
  PRODUCT_NOT_FOUND: 'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.',
  INSUFFICIENT_STOCK: 'Số lượng vượt quá tồn kho hiện có.',
  PRODUCT_UNAVAILABLE: 'Một số sản phẩm trong giỏ hiện không còn kinh doanh.',
  CART_NOT_FOUND: 'Không tìm thấy giỏ hàng.',
  CART_ITEM_NOT_FOUND: 'Sản phẩm không còn trong giỏ hàng.',
  CART_EMPTY: 'Giỏ hàng đang trống.',
  INVALID_QUANTITY: 'Số lượng không hợp lệ (1–999).',
  INVALID_RECIPIENT_NAME: 'Họ tên người nhận cần từ 2 đến 120 ký tự.',
  INVALID_RECIPIENT_PHONE: 'Số điện thoại không hợp lệ.',
  INVALID_SHIPPING_ADDRESS: 'Địa chỉ giao hàng cần từ 8 đến 500 ký tự.',
  ORDER_NOT_FOUND: 'Không tìm thấy đơn hàng.',
  ORDER_NOT_CANCELLABLE: 'Đơn hàng không thể hủy ở trạng thái hiện tại.',
  ORDER_NOT_PAYABLE: 'Đơn hàng không ở trạng thái chờ thanh toán.',
  PAYMENT_AMOUNT_MISMATCH: 'Số tiền thanh toán không khớp với đơn hàng.',
  VNPAY_NOT_CONFIGURED: 'Cổng VNPAY Sandbox chưa được cấu hình trên máy chủ.',
  VNPAY_CONFIG_INVALID: 'Cấu hình VNPAY Sandbox trên máy chủ chưa hợp lệ.',
  TECHBOT_PROMPT_BLOCKED: 'TechBot chỉ hỗ trợ tư vấn sản phẩm. Yêu cầu truy cập dữ liệu nội bộ, bí mật hoặc dữ liệu riêng tư đã bị chặn.',
  TECHBOT_RATE_LIMITED: 'TechBot giới hạn 5 câu hỏi mỗi phút. Vui lòng thử lại sau.',
  TECHBOT_QUESTION_REQUIRED: 'Vui lòng nhập câu hỏi.',
  TECHBOT_QUESTION_TOO_LONG: 'Câu hỏi tối đa 600 ký tự.',
  DATABASE_UNAVAILABLE: 'Máy chủ dữ liệu tạm thời không khả dụng.',
  SERVER_ERROR: 'Máy chủ gặp sự cố. Vui lòng thử lại sau.',
};

export class ApiError extends Error {
  constructor(message, { status = 0, code = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function friendlyMessage(status, code, fallback) {
  if (code && FRIENDLY_ERRORS[code]) return FRIENDLY_ERRORS[code];
  if (status === 429) return FRIENDLY_ERRORS.RATE_LIMITED;
  if (status === 403) return FRIENDLY_ERRORS.FORBIDDEN;
  if (status >= 500) return FRIENDLY_ERRORS.SERVER_ERROR;
  return fallback || 'Có lỗi xảy ra. Vui lòng thử lại.';
}

const API_TIMEOUT_MS = 8000;

export async function api(path, options = {}) {
  let response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...options,
      signal: options.signal || controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ApiError('Máy chủ phản hồi quá lâu. Vui lòng thử lại sau giây lát.', { status: 0, code: 'REQUEST_TIMEOUT' });
    }
    throw new ApiError('Không thể kết nối máy chủ. Kiểm tra mạng và thử lại.', { status: 0, code: 'NETWORK_ERROR' });
  } finally {
    clearTimeout(timeoutId);
  }

  let body = null;
  if (response.status !== 204) {
    try { body = await response.json(); } catch { body = null; }
  }

  if (!response.ok) {
    throw new ApiError(friendlyMessage(response.status, body?.code, body?.message), { status: response.status, code: body?.code || '' });
  }
  return body;
}

export const postJson = (path, payload) => api(path, { method: 'POST', body: JSON.stringify(payload ?? {}) });
export const patchJson = (path, payload) => api(path, { method: 'PATCH', body: JSON.stringify(payload ?? {}) });
export const del = (path) => api(path, { method: 'DELETE' });
