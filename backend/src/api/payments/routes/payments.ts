// backend/src/api/payments/routes/payments.ts
export default {
  routes: [
    {
      method: 'POST',
      path: '/payments/create-preference',
      handler: 'payments.createPreference',
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/payments/card-pay',            // ⬅️ NUEVA
      handler: 'payments.cardPay',
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};
