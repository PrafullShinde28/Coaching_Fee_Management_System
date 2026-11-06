import { env } from '../config/env.js';
import { clock } from '../config/clock.js';

export function renderReminderTemplate({
  language = 'en',
  studentName,
  instalmentSeq,
  amountPaise,
  dueDate,
  paymentUrl
}) {
  const rupeesStr = (amountPaise / 100).toLocaleString('en-IN');
  const dateStr = typeof dueDate === 'string' ? dueDate.slice(0, 10) : new Date(dueDate).toISOString().slice(0, 10);

  if (language === 'hi') {
    return (
      `प्रिय अभिभावक, FEETrack कोचिंग संस्थान की ओर से यह एक सूचना है कि ${studentName} की किस्त ${instalmentSeq} ` +
      `की राशि रु ${rupeesStr} की देय तिथि ${dateStr} है। कृपया इस लिंक के माध्यम से भुगतान करें: ${paymentUrl}। धन्यवाद।`
    );
  }

  return (
    `Dear Parent, this is a reminder from FEETrack Coaching Institute that instalment ${instalmentSeq} ` +
    `for ${studentName} of Rs. ${rupeesStr} is due on ${dateStr}. Please complete the payment using this link: ${paymentUrl}. Thank you.`
  );
}

export class MockWhatsAppProvider {
  constructor() {
    this.shouldFail = false;
    this.failureError = 'Mock WhatsApp network timeout';
  }

  setShouldFail(shouldFail, error = 'Mock WhatsApp network timeout') {
    this.shouldFail = shouldFail;
    this.failureError = error;
  }

  async sendWhatsAppMessage({ recipientPhone, body, metadata = {} }) {
    if (this.shouldFail) {
      const err = new Error(this.failureError);
      err.provider = 'mock-whatsapp';
      throw err;
    }

    const providerRef = `MOCK-WA-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    return {
      delivered: true,
      channel: 'whatsapp',
      recipientPhone,
      providerRef,
      timestamp: clock.now()
    };
  }
}

export class MockSmsProvider {
  constructor() {
    this.shouldFail = false;
    this.failureError = 'Mock SMS gateway error';
  }

  setShouldFail(shouldFail, error = 'Mock SMS gateway error') {
    this.shouldFail = shouldFail;
    this.failureError = error;
  }

  async sendSmsMessage({ recipientPhone, body, metadata = {} }) {
    if (this.shouldFail) {
      const err = new Error(this.failureError);
      err.provider = 'mock-sms';
      throw err;
    }

    const providerRef = `MOCK-SMS-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    return {
      delivered: true,
      channel: 'sms',
      recipientPhone,
      providerRef,
      timestamp: clock.now()
    };
  }
}

export class MessageProvider {
  constructor(channel = env.MESSAGE_PROVIDER) {
    this.channel = channel;
    this.whatsapp = new MockWhatsAppProvider();
    this.sms = new MockSmsProvider();
  }

  async sendMessage({ channel = 'whatsapp', recipientPhone, body, metadata = {} }) {
    if (channel === 'sms') {
      return this.sms.sendSmsMessage({ recipientPhone, body, metadata });
    }
    return this.whatsapp.sendWhatsAppMessage({ recipientPhone, body, metadata });
  }
}

export const messageProvider = new MessageProvider();
