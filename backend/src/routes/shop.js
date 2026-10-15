import crypto from 'node:crypto';
import { Router } from 'express';
import { pool, query } from '../db/pool.js';
import { loadAuthenticatedUser, requireAuth } from '../middleware/auth.js';
import { parsePositiveId } from '../utils/validation.js';
import { parseCartItemBody, parseQuantityBody, parseCheckoutBody } from '../utils/order-validation.js';
import { encryptSensitive, decryptSensitive } from '../utils/crypto.js';

export const shopRouter = Router();
// Authentication applies only to shopping resources; public catalog/auth routes are unaffected.
shopRouter.use(['/cart', '/checkout', '/orders'], loadAuthenticatedUser, requireAuth);

shopRouter.get('/cart', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT c.id AS cart_id, c.status AS cart_status,
             ci.id AS cart_item_id, ci.quantity,
             p.id AS product_id, p.sku, p.name, p.price, p.stock_quantity,
             pi.image_url, pi.alt_text
      FROM carts c
      LEFT JOIN cart_items ci ON ci.cart_id = c.id
      LEFT JOIN products p ON p.id = ci.product_id
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = TRUE
      WHERE c.user_id = $1 AND c.status = 'active'
      ORDER BY ci.id ASC;
    `, [req.auth.userId]);

    if (result.rowCount === 0) {
      const error = new Error('Cart not found');
      error.statusCode = 404;
      error.code = 'CART_NOT_FOUND';
      throw error;
    }

    const rows = result.rows;
    const items = rows.filter((row) => row.cart_item_id !== null).map((row) => ({
      id: row.cart_item_id,
      quantity: row.quantity,
      product: {
        id: row.product_id,
        sku: row.sku,
        name: row.name,
        price: Number(row.price),
        stockQuantity: row.stock_quantity,
        primaryImage: row.image_url ? { imageUrl: row.image_url, altText: row.alt_text } : null
      },
      lineTotal: Number(row.price) * row.quantity
    }));

    res.json({
      success: true,
      data: {
        id: rows[0].cart_id,
        status: rows[0].cart_status,
        items,
        subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0)
      }
    });
  } catch (error) {
    next(error);
  }
});

shopRouter.post('/cart/items', async (req, res, next) => {
  try {
    const { productId, quantity } = parseCartItemBody(req.body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const cartResult = await client.query(`
        SELECT id FROM carts WHERE user_id = $1 AND status = 'active' FOR UPDATE;
      `, [req.auth.userId]);
      if (cartResult.rowCount === 0) {
        const error = new Error('Cart not found');
        error.statusCode = 404;
        error.code = 'CART_NOT_FOUND';
        throw error;
      }

      const productResult = await client.query(`
        SELECT id, price, stock_quantity, status FROM products WHERE id = $1 FOR UPDATE;
      `, [productId]);
      if (productResult.rowCount === 0 || productResult.rows[0].status !== 'active') {
        const error = new Error('Product not found');
        error.statusCode = 404;
        error.code = 'PRODUCT_NOT_FOUND';
        throw error;
      }
      const product = productResult.rows[0];

      const current = await client.query(`
        SELECT quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2 FOR UPDATE;
      `, [cartResult.rows[0].id, productId]);
      const nextQuantity = Number(current.rows[0]?.quantity || 0) + quantity;
      if (nextQuantity > product.stock_quantity) {
        const error = new Error('Requested quantity exceeds current stock');
        error.statusCode = 409;
        error.code = 'INSUFFICIENT_STOCK';
        throw error;
      }

      const itemResult = await client.query(`
        INSERT INTO cart_items (cart_id, product_id, quantity)
        VALUES ($1, $2, $3)
        ON CONFLICT (cart_id, product_id)
        DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()
        RETURNING id, product_id, quantity;
      `, [cartResult.rows[0].id, productId, nextQuantity]);

      await client.query('COMMIT');
      res.status(current.rowCount ? 200 : 201).json({
        success: true,
        data: {
          id: itemResult.rows[0].id,
          productId: itemResult.rows[0].product_id,
          quantity: itemResult.rows[0].quantity,
          unitPrice: Number(product.price)
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

shopRouter.patch('/cart/items/:id', async (req, res, next) => {
  try {
    const itemId = parsePositiveId(req.params.id);
    const { quantity } = parseQuantityBody(req.body);
    const result = await query(`
      SELECT ci.id, p.stock_quantity, p.status
      FROM cart_items ci
      INNER JOIN carts c ON c.id = ci.cart_id
      INNER JOIN products p ON p.id = ci.product_id
      WHERE ci.id = $1 AND c.user_id = $2 AND c.status = 'active';
    `, [itemId, req.auth.userId]);
    if (result.rowCount === 0) {
      const error = new Error('Cart item not found');
      error.statusCode = 404;
      error.code = 'CART_ITEM_NOT_FOUND';
      throw error;
    }
    if (result.rows[0].status !== 'active' || quantity > result.rows[0].stock_quantity) {
      const error = new Error('Requested quantity exceeds current stock');
      error.statusCode = 409;
      error.code = 'INSUFFICIENT_STOCK';
      throw error;
    }

    await query('UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2', [quantity, itemId]);
    res.json({ success: true, data: { id: itemId, quantity } });
  } catch (error) {
    next(error);
  }
});

shopRouter.delete('/cart/items/:id', async (req, res, next) => {
  try {
    const itemId = parsePositiveId(req.params.id);
    const result = await query(`
      DELETE FROM cart_items ci
      USING carts c
      WHERE ci.cart_id = c.id AND ci.id = $1 AND c.user_id = $2 AND c.status = 'active'
      RETURNING ci.id;
    `, [itemId, req.auth.userId]);
    if (result.rowCount === 0) {
      const error = new Error('Cart item not found');
      error.statusCode = 404;
      error.code = 'CART_ITEM_NOT_FOUND';
      throw error;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

shopRouter.post('/checkout', async (req, res, next) => {
  try {
    const { recipientName, recipientPhone, shippingAddress } = parseCheckoutBody(req.body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const cartResult = await client.query(`
        SELECT c.id
        FROM carts c
        WHERE c.user_id = $1 AND c.status = 'active'
        FOR UPDATE;
      `, [req.auth.userId]);
      if (cartResult.rowCount === 0) {
        const error = new Error('Cart not found');
        error.statusCode = 404;
        error.code = 'CART_NOT_FOUND';
        throw error;
      }
      const cartId = cartResult.rows[0].id;

      const itemsResult = await client.query(`
        SELECT ci.product_id, ci.quantity, p.sku, p.name, p.price, p.stock_quantity, p.status
        FROM cart_items ci
        INNER JOIN products p ON p.id = ci.product_id
        WHERE ci.cart_id = $1
        ORDER BY ci.id ASC
        FOR UPDATE OF p;
      `, [cartId]);
      if (itemsResult.rowCount === 0) {
        const error = new Error('Cart is empty');
        error.statusCode = 409;
        error.code = 'CART_EMPTY';
        throw error;
      }

      let subtotal = 0;
      for (const item of itemsResult.rows) {
        if (item.status !== 'active') {
          const error = new Error('One or more cart items are unavailable');
          error.statusCode = 409;
          error.code = 'PRODUCT_UNAVAILABLE';
          throw error;
        }
        if (item.quantity > item.stock_quantity) {
          const error = new Error(`Insufficient stock for ${item.sku}`);
          error.statusCode = 409;
          error.code = 'INSUFFICIENT_STOCK';
          throw error;
        }
        subtotal += Number(item.price) * item.quantity;
      }

      const orderNumber = `TG-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const phoneEncrypted = encryptSensitive(recipientPhone);
      const addressEncrypted = encryptSensitive(shippingAddress);
      const orderResult = await client.query(`
        INSERT INTO orders (
          user_id, order_number, status, currency, subtotal, shipping_fee,
          discount_total, grand_total, recipient_name,
          recipient_phone_encrypted, shipping_address_encrypted
        )
        VALUES ($1, $2, 'payment_pending', 'VND', $3, 0, 0, $3, $4, $5, $6)
        RETURNING id, order_number, status, currency, subtotal, shipping_fee, discount_total, grand_total, created_at;
      `, [req.auth.userId, orderNumber, subtotal, recipientName, phoneEncrypted, addressEncrypted]);

      const order = orderResult.rows[0];
      for (const item of itemsResult.rows) {
        const lineTotal = Number(item.price) * item.quantity;
        await client.query(`
          INSERT INTO order_items (
            order_id, product_id, product_name_snapshot, sku_snapshot,
            unit_price, quantity, line_total
          ) VALUES ($1, $2, $3, $4, $5, $6, $7);
        `, [order.id, item.product_id, item.name, item.sku, item.price, item.quantity, lineTotal]);

        await client.query(`
          UPDATE products
          SET stock_quantity = stock_quantity - $1, updated_at = NOW()
          WHERE id = $2;
        `, [item.quantity, item.product_id]);
      }

      await client.query(`
        INSERT INTO payments (order_id, provider, status, amount, currency)
        VALUES ($1, 'vnpay', 'pending', $2, 'VND');
      `, [order.id, order.grand_total]);

      // The cart is a reusable shopping resource, not order history.
      // Order/order_items preserve the checkout snapshot, so clear the
      // purchased items and keep the user's cart active for the next order.
      await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
      await client.query(
        "UPDATE carts SET status = 'active', updated_at = NOW() WHERE id = $1",
        [cartId]
      );

      await client.query('COMMIT');
      res.status(201).json({
        success: true,
        data: {
          order: {
            id: order.id,
            orderNumber: order.order_number,
            status: order.status,
            currency: order.currency,
            subtotal: Number(order.subtotal),
            shippingFee: Number(order.shipping_fee),
            discountTotal: Number(order.discount_total),
            grandTotal: Number(order.grand_total),
            createdAt: order.created_at
          }
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

shopRouter.get('/orders', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT id, order_number, status, currency, subtotal, shipping_fee, discount_total,
             grand_total, recipient_name, created_at, updated_at
      FROM orders
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC;
    `, [req.auth.userId]);
    res.json({
      success: true,
      data: result.rows.map(mapOrderSummary)
    });
  } catch (error) {
    next(error);
  }
});

shopRouter.get('/orders/:id', async (req, res, next) => {
  try {
    const orderId = parsePositiveId(req.params.id);
    const orderResult = await query(`
      SELECT id, order_number, status, currency, subtotal, shipping_fee, discount_total,
             grand_total, recipient_name, recipient_phone_encrypted, shipping_address_encrypted,
             created_at, updated_at
      FROM orders
      WHERE id = $1 AND user_id = $2;
    `, [orderId, req.auth.userId]);
    if (orderResult.rowCount === 0) {
      const error = new Error('Order not found');
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    const itemsResult = await query(`
      SELECT id, product_id, product_name_snapshot, sku_snapshot, unit_price, quantity, line_total
      FROM order_items
      WHERE order_id = $1
      ORDER BY id ASC;
    `, [orderId]);

    const paymentResult = await query(`
      SELECT provider, status, amount, currency, provider_transaction_ref, provider_response_code, paid_at
      FROM payments
      WHERE order_id = $1;
    `, [orderId]);

    const row = orderResult.rows[0];
    res.json({
      success: true,
      data: {
        ...mapOrderSummary(row),
        recipient: {
          name: row.recipient_name,
          phone: decryptSensitive(row.recipient_phone_encrypted),
          shippingAddress: decryptSensitive(row.shipping_address_encrypted)
        },
        items: itemsResult.rows.map((item) => ({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name_snapshot,
          sku: item.sku_snapshot,
          unitPrice: Number(item.unit_price),
          quantity: item.quantity,
          lineTotal: Number(item.line_total)
        })),
        payment: paymentResult.rows[0] ? {
          provider: paymentResult.rows[0].provider,
          status: paymentResult.rows[0].status,
          amount: Number(paymentResult.rows[0].amount),
          currency: paymentResult.rows[0].currency,
          providerTransactionRef: paymentResult.rows[0].provider_transaction_ref,
          providerResponseCode: paymentResult.rows[0].provider_response_code,
          paidAt: paymentResult.rows[0].paid_at
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
});

shopRouter.post('/orders/:id/cancel', async (req, res, next) => {
  try {
    const orderId = parsePositiveId(req.params.id);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const orderResult = await client.query(`
        SELECT id, status FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE;
      `, [orderId, req.auth.userId]);
      if (orderResult.rowCount === 0) {
        const error = new Error('Order not found');
        error.statusCode = 404;
        error.code = 'ORDER_NOT_FOUND';
        throw error;
      }
      const status = orderResult.rows[0].status;
      if (!['pending', 'payment_pending'].includes(status)) {
        const error = new Error('Order cannot be cancelled in its current state');
        error.statusCode = 409;
        error.code = 'ORDER_NOT_CANCELLABLE';
        throw error;
      }

      const items = await client.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
      for (const item of items.rows) {
        await client.query('UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2', [item.quantity, item.product_id]);
      }
      await client.query(`
        UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1;
      `, [orderId]);
      await client.query(`
        UPDATE payments SET status = 'cancelled', updated_at = NOW()
        WHERE order_id = $1 AND status = 'pending';
      `, [orderId]);

      await client.query('COMMIT');
      res.json({ success: true, data: { id: orderId, status: 'cancelled' } });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

function mapOrderSummary(row) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    currency: row.currency,
    subtotal: Number(row.subtotal),
    shippingFee: Number(row.shipping_fee),
    discountTotal: Number(row.discount_total),
    grandTotal: Number(row.grand_total),
    recipientName: row.recipient_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
