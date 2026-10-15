import { Router } from 'express';
import { pool, query } from '../db/pool.js';
import { loadAuthenticatedUser, requireAuth } from '../middleware/auth.js';
import { parsePositiveId } from '../utils/validation.js';
import {
  VNPAY_PAYMENT_URL,
  VNPAY_VERSION,
  addMinutes,
  buildVnpayPaymentUrl,
  formatVnpayDate,
  sanitizeIpAddress,
  verifyVnpayResponse,
  vnpayAmountToVnd
} from '../utils/vnpay.js';

export const paymentRouter = Router();

paymentRouter.post('/payment/create', loadAuthenticatedUser, requireAuth, async (req, res, next) => {
  try {
    const orderId = parsePositiveId(req.body?.orderId);
    const tmnCode = String(process.env.VNPAY_TMN_CODE || '').trim();
    const hashSecret = String(process.env.VNPAY_HASH_SECRET || '').trim();
    const returnUrl = String(process.env.VNPAY_RETURN_URL || '').trim();
    const orderType = String(process.env.VNPAY_ORDER_TYPE || 'other').trim();
    const locale = String(process.env.VNPAY_LOCALE || 'vn').trim();
    const timezone = String(process.env.VNPAY_TIMEZONE || 'Asia/Ho_Chi_Minh').trim();
    const expireMinutes = Math.max(5, Math.min(30, Number(process.env.VNPAY_EXPIRE_MINUTES || 15)));

    if (!tmnCode || !hashSecret || !returnUrl) {
      const error = new Error('VNPAY Sandbox is not configured');
      error.statusCode = 503;
      error.code = 'VNPAY_NOT_CONFIGURED';
      throw error;
    }
    if (!/^[A-Za-z0-9]{8}$/.test(tmnCode)) {
      const error = new Error('VNPAY merchant configuration is invalid');
      error.statusCode = 503;
      error.code = 'VNPAY_CONFIG_INVALID';
      throw error;
    }
    if (!/^https:\/\//i.test(returnUrl)) {
      const error = new Error('VNPAY return URL must use HTTPS');
      error.statusCode = 503;
      error.code = 'VNPAY_CONFIG_INVALID';
      throw error;
    }

    const result = await query(`
      SELECT o.id, o.order_number, o.status, o.grand_total,
             p.id AS payment_id, p.provider, p.status AS payment_status, p.amount
      FROM orders o
      INNER JOIN payments p ON p.order_id = o.id
      WHERE o.id = $1 AND o.user_id = $2
      LIMIT 1;
    `, [orderId, req.auth.userId]);

    if (result.rowCount === 0) {
      const error = new Error('Order not found');
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    const order = result.rows[0];
    if (order.provider !== 'vnpay' || order.payment_status !== 'pending' || order.status !== 'payment_pending') {
      const error = new Error('Order is not payable');
      error.statusCode = 409;
      error.code = 'ORDER_NOT_PAYABLE';
      throw error;
    }

    const amount = Math.round(Number(order.amount));
    if (!Number.isSafeInteger(amount) || amount <= 0 || Math.round(Number(order.grand_total)) !== amount) {
      const error = new Error('Payment amount mismatch');
      error.statusCode = 409;
      error.code = 'PAYMENT_AMOUNT_MISMATCH';
      throw error;
    }

    const now = new Date();
    const params = {
      vnp_Version: VNPAY_VERSION,
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Amount: String(amount * 100),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: order.order_number,
      vnp_OrderInfo: `Thanh toan don hang ${order.order_number}`,
      vnp_OrderType: orderType || 'other',
      vnp_Locale: locale === 'en' ? 'en' : 'vn',
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: sanitizeIpAddress(req.headers['x-real-ip'] || req.socket.remoteAddress),
      vnp_CreateDate: formatVnpayDate(now, timezone),
      vnp_ExpireDate: formatVnpayDate(addMinutes(now, expireMinutes), timezone)
    };

    const paymentUrl = buildVnpayPaymentUrl(params, hashSecret, VNPAY_PAYMENT_URL);
    res.json({
      success: true,
      data: {
        paymentUrl,
        orderId: order.id,
        orderNumber: order.order_number,
        amount
      }
    });
  } catch (error) {
    next(error);
  }
});

async function getVnpayOrder(client, txnRef) {
  const result = await client.query(`
    SELECT o.id, o.order_number, o.status, o.grand_total,
           p.id AS payment_id, p.provider, p.status AS payment_status,
           p.amount, p.provider_transaction_ref
    FROM orders o
    INNER JOIN payments p ON p.order_id = o.id
    WHERE o.order_number = $1
    FOR UPDATE OF o, p;
  `, [txnRef]);
  return result.rowCount ? result.rows[0] : null;
}

function validMerchant(params) {
  const tmnCode = String(process.env.VNPAY_TMN_CODE || '').trim();
  return Boolean(tmnCode && params.vnp_TmnCode === tmnCode);
}

paymentRouter.get('/payment/vnpay_ipn', async (req, res) => {
  const params = { ...req.query };
  const secret = String(process.env.VNPAY_HASH_SECRET || '').trim();

  if (!secret || !validMerchant(params) || !verifyVnpayResponse(params, secret)) {
    res.status(200).json({ RspCode: '97', Message: 'Invalid signature' });
    return;
  }

  const txnRef = String(params.vnp_TxnRef || '').trim();
  if (!txnRef) {
    res.status(200).json({ RspCode: '01', Message: 'Order not Found' });
    return;
  }

  const amount = vnpayAmountToVnd(params.vnp_Amount);
  if (amount === null) {
    res.status(200).json({ RspCode: '04', Message: 'Invalid Amount' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await getVnpayOrder(client, txnRef);
    if (!order) {
      await client.query('ROLLBACK');
      res.status(200).json({ RspCode: '01', Message: 'Order not Found' });
      return;
    }

    if (Math.round(Number(order.amount)) !== Number(amount) || Math.round(Number(order.grand_total)) !== Number(amount)) {
      await client.query('ROLLBACK');
      res.status(200).json({ RspCode: '04', Message: 'Invalid Amount' });
      return;
    }

    const responseCode = String(params.vnp_ResponseCode || '99');
    const transactionStatus = String(params.vnp_TransactionStatus || '99');
    const transactionNo = String(params.vnp_TransactionNo || '').trim() || null;

    if (order.payment_status === 'paid' && order.status === 'paid') {
      if (order.provider_transaction_ref && transactionNo && order.provider_transaction_ref !== transactionNo) {
        await client.query('ROLLBACK');
        res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
        return;
      }
      await client.query('COMMIT');
      res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
      return;
    }

    if (!['pending', 'processing'].includes(order.payment_status) || !['payment_pending', 'pending'].includes(order.status)) {
      await client.query('ROLLBACK');
      res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
      return;
    }

    const success = responseCode === '00' && transactionStatus === '00';
    if (success) {
      await client.query(`
        UPDATE payments
        SET status = 'paid', provider_transaction_ref = $1,
            provider_response_code = $2, paid_at = NOW(), updated_at = NOW()
        WHERE id = $3;
      `, [transactionNo, responseCode, order.payment_id]);
      await client.query(`
        UPDATE orders
        SET status = 'paid', updated_at = NOW()
        WHERE id = $1;
      `, [order.id]);
    } else {
      await client.query(`
        UPDATE payments
        SET status = 'failed', provider_transaction_ref = $1,
            provider_response_code = $2, updated_at = NOW()
        WHERE id = $3;
      `, [transactionNo, responseCode, order.payment_id]);

      // Checkout reserves stock. Once VNPAY definitively reports a failed
      // payment, release that reservation exactly once while the order row
      // is still locked by this transaction.
      const items = await client.query(
        'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
        [order.id]
      );
      for (const item of items.rows) {
        await client.query(
          'UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2',
          [item.quantity, item.product_id]
        );
      }

      await client.query(`
        UPDATE orders
        SET status = 'payment_failed', updated_at = NOW()
        WHERE id = $1;
      `, [order.id]);
    }

    await client.query('COMMIT');
    res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('VNPAY IPN processing failed', { txnRef, error: error.message });
    res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
  } finally {
    client.release();
  }
});

paymentRouter.get('/payment/vnpay_return', async (req, res) => {
  const params = { ...req.query };
  const secret = String(process.env.VNPAY_HASH_SECRET || '').trim();
  const frontendOrigin = String(process.env.VNPAY_FRONTEND_ORIGIN || '').trim() || 'https://localhost:8443';
  const txnRef = String(params.vnp_TxnRef || '').trim();

  if (!secret || !validMerchant(params) || !verifyVnpayResponse(params, secret)) {
    res.redirect(`${frontendOrigin}/#/payment-result?status=invalid&code=97`);
    return;
  }

  const amount = vnpayAmountToVnd(params.vnp_Amount);
  if (amount === null || !txnRef) {
    res.redirect(`${frontendOrigin}/#/payment-result?status=invalid&code=04`);
    return;
  }

  try {
    const result = await query(`
      SELECT o.id, o.grand_total, o.status
      FROM orders o
      WHERE o.order_number = $1
      LIMIT 1;
    `, [txnRef]);

    if (result.rowCount === 0 || Math.round(Number(result.rows[0].grand_total)) !== Number(amount)) {
      res.redirect(`${frontendOrigin}/#/payment-result?status=invalid&code=04`);
      return;
    }

    const status = String(params.vnp_ResponseCode || '') === '00' && String(params.vnp_TransactionStatus || '') === '00'
      ? 'success'
      : 'failed';
    res.redirect(`${frontendOrigin}/#/payment-result?order=${encodeURIComponent(result.rows[0].id)}&status=${status}&code=${encodeURIComponent(String(params.vnp_ResponseCode || '99'))}`);
  } catch (error) {
    console.error('VNPAY return processing failed', { txnRef, error: error.message });
    res.redirect(`${frontendOrigin}/#/payment-result?status=invalid&code=99`);
  }
});

export { vnpayAmountToVnd };
