export function parseRegisterBody(body = {}) {
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? '');
  const fullName = String(body.fullName ?? '').trim();

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw clientError('INVALID_EMAIL', 'Email is invalid');
  }

  if (password.length < 12 || password.length > 128) {
    throw clientError('INVALID_PASSWORD', 'Password must be 12 to 128 characters');
  }

  if (fullName.length < 1 || fullName.length > 120) {
    throw clientError('INVALID_FULL_NAME', 'Full name must be 1 to 120 characters');
  }

  return { email, password, fullName };
}

export function parseLoginBody(body = {}) {
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? '');

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw clientError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (password.length < 1 || password.length > 128) {
    throw clientError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  return { email, password };
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function clientError(code, message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
}
