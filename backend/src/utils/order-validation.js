function invalid(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
}

function positiveInteger(value, field, max = 999) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > max) {
    invalid(`INVALID_${field.toUpperCase()}`, `${field} must be an integer between 1 and ${max}`);
  }
  return value;
}

export function parseCartItemBody(body) {
  const value = body && typeof body === 'object' ? body : {};
  return {
    productId: positiveInteger(value.productId, 'productId', Number.MAX_SAFE_INTEGER),
    quantity: positiveInteger(value.quantity, 'quantity')
  };
}

export function parseQuantityBody(body) {
  const value = body && typeof body === 'object' ? body : {};
  return { quantity: positiveInteger(value.quantity, 'quantity') };
}

export function parseCheckoutBody(body) {
  const value = body && typeof body === 'object' ? body : {};
  const recipientName = String(value.recipientName ?? '').trim();
  const recipientPhone = String(value.recipientPhone ?? '').trim();
  const shippingAddress = String(value.shippingAddress ?? '').trim();

  if (recipientName.length < 2 || recipientName.length > 120) {
    invalid('INVALID_RECIPIENT_NAME', 'recipientName must be between 2 and 120 characters');
  }
  if (!/^\+?[0-9 ()-]{8,20}$/.test(recipientPhone)) {
    invalid('INVALID_RECIPIENT_PHONE', 'recipientPhone is invalid');
  }
  if (shippingAddress.length < 8 || shippingAddress.length > 500) {
    invalid('INVALID_SHIPPING_ADDRESS', 'shippingAddress must be between 8 and 500 characters');
  }

  return { recipientName, recipientPhone, shippingAddress };
}
