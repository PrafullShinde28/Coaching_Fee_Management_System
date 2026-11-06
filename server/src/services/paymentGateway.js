import crypto from 'node:crypto';
import { env } from '../config/env.js';

export class MockPaymentGateway {
  constructor(secret = env.PAYMENT_WEBHOOK_SECRET) {
    this.secret = secret;
  }

  /**
   * Create a mock payment order / link for an outstanding instalment.
   */
  async createPaymentLink({ instalmentId, studentId, amount, paymentLinkToken }) {
    if (!instalmentId || !studentId) {
      throw new TypeError('instalmentId and studentId are required');
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new TypeError('Amount must be a positive integer in paise');
    }

    const token = paymentLinkToken || `link_${instalmentId}_${studentId}`;
    const orderId = `ORD_${instalmentId.toString().slice(-6)}_${Date.now()}`;
    const gatewayRef = `GW_MOCK_${orderId}`;
    const paymentUrl = `https://checkout.feetrack-mock.test/pay/${token}?orderId=${orderId}&amount=${amount}`;

    return {
      orderId,
      gatewayRef,
      paymentUrl,
      amount,
      instalmentId: String(instalmentId),
      studentId: String(studentId)
    };
  }

  /**
   * Compute HMAC-SHA256 signature for a raw payload string/Buffer.
   */
  generateWebhookSignature(rawBody, secret = this.secret) {
    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '', 'utf8');
    return crypto.createHmac('sha256', secret).update(bodyBuffer).digest('hex');
  }

  /**
   * Verify HMAC-SHA256 signature safely using timingSafeEqual.
   */
  verifyWebhookSignature({ rawBody, signature, secret = this.secret }) {
    if (!signature || typeof signature !== 'string') {
      return false;
    }
    if (!rawBody) {
      return false;
    }

    try {
      const computedHex = this.generateWebhookSignature(rawBody, secret);
      const computedBuffer = Buffer.from(computedHex, 'hex');
      const signatureBuffer = Buffer.from(signature, 'hex');

      if (computedBuffer.length !== signatureBuffer.length) {
        return false;
      }
      return crypto.timingSafeEqual(computedBuffer, signatureBuffer);
    } catch {
      return false;
    }
  }
}

/**
 * Factory for payment gateway adapters.
 */
export function getPaymentGateway(provider = env.PAYMENT_GATEWAY_PROVIDER) {
  switch (provider.toLowerCase()) {
    case 'mock':
      return new MockPaymentGateway();
    default:
      throw new Error(`Unsupported payment gateway provider: ${provider}`);
  }
}

export const paymentGateway = getPaymentGateway();
