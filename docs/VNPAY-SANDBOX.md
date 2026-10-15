# VNPAY Sandbox Integration

TechGear uses VNPAY gateway version 2.1.0 with HMAC-SHA512.

## Runtime flow

1. Checkout creates a server-priced `payment_pending` order and a `pending` VNPAY payment record.
2. The customer clicks **Thanh toán bằng VNPAY** (or checkout immediately redirects after order creation).
3. `POST /api/payment/create` reads the order from PostgreSQL, verifies ownership/status/amount, and creates a signed VNPAY payment URL.
4. VNPAY redirects the browser to `GET /api/payment/vnpay_return` after payment.
5. VNPAY calls `GET /api/payment/vnpay_ipn` server-to-server. TechGear verifies the HMAC-SHA512 signature first, compares `vnp_Amount` with the order amount from PostgreSQL, then updates payment/order status atomically.

## Environment

Set these variables in `.env` (never commit them):

```text
VNPAY_TMN_CODE=<8-character merchant code>
VNPAY_HASH_SECRET=<VNPAY secret>
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://localhost:8443/api/payment/vnpay_return
VNPAY_IPN_URL=https://<public-host>/api/payment/vnpay_ipn
VNPAY_FRONTEND_ORIGIN=https://localhost:8443
VNPAY_ORDER_TYPE=other
VNPAY_LOCALE=vn
VNPAY_TIMEZONE=Asia/Ho_Chi_Minh
VNPAY_EXPIRE_MINUTES=15
```

`VNPAY_RETURN_URL` can point to `localhost` for a local browser demo. `VNPAY_IPN_URL` needs a public HTTPS URL that VNPAY can reach; Cloudflare Tunnel is suitable for the demo deployment.

## Sandbox setup

Register a sandbox merchant at VNPAY's developer registration page and use the merchant `vnp_TmnCode` and `vnp_HashSecret` supplied there. Then register/configure the IPN URL in the merchant portal.

Official sandbox gateway:
`https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`

The integration follows VNPAY's 2.1.0 requirements: HTTPS return/IPN URLs, amount multiplied by 100, sorted parameters, and HMAC-SHA512 checksum.
