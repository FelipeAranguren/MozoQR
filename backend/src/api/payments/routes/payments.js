// backend/src/api/payment/routes/payments.js
'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/restaurants/:slug/payments',
      handler: 'payments.create',
      config: {
        auth: false, // public (mock)
        policies: ['global::by-restaurant'],
      },
    },
  ],
};
