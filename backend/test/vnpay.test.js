import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVnpayPaymentUrl,
  buildVnpaySignData,
  verifyVnpayResponse,
  vnpayAmountToVnd
} from '../src/utils/vnpay.js';

const secret = 'TEST_SECRET_0123456789';
const base = {
  vnp_Version: '2.1.0',
  vnp_Command: 'pay',
  vnp_TmnCode: 'DEMO1234',
  vnp_Amount: '359000000',
  vnp_CurrCode: 'VND',
  vnp_TxnRef: 'TG-TEST-001',
  vnp_OrderInfo: 'Thanh toan don hang TG-TEST-001',
  vnp_OrderType: 'other',
  vnp_Locale: 'vn',
  vnp_ReturnUrl: 'https://localhost:8443/api/payment/vnpay_return',
  vnp_IpAddr: '127.0.0.1',
  vnp_CreateDate: '20261006220000',
  vnp_ExpireDate: '20261006221500'
};

test('VNPAY sign data is sorted and URL is signed with HMAC-SHA512', () => {
  const signData = buildVnpaySignData(base);
  assert.match(signData, /^vnp_Amount=/);
  const url = buildVnpayPaymentUrl(base, secret);
  assert.match(url, /vnp_SecureHash=[0-9a-f]{128}$/);
});

test('VNPAY response signature validates and tampering fails', () => {
  const url = buildVnpayPaymentUrl({ ...base, vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_TransactionNo: '12345678' }, secret);
  const query = Object.fromEntries(new URL(url).searchParams.entries());
  assert.equal(verifyVnpayResponse(query, secret), true);
  query.vnp_Amount = '359000100';
  assert.equal(verifyVnpayResponse(query, secret), false);
});

test('VNPAY amount conversion requires integer VND multiplied by 100', () => {
  assert.equal(vnpayAmountToVnd('359000000'), 3590000n);
  assert.equal(vnpayAmountToVnd('359000001'), null);
  assert.equal(vnpayAmountToVnd('abc'), null);
});
