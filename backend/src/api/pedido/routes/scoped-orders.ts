export default {
    routes: [
        // Public create (customer)
        {
            method: 'POST',
            path: '/restaurants/:slug/orders',
            handler: 'scoped-orders.create',
            config: {
                policies: ['global::by-restaurant'],
            },
        },
        // Staff/Owner list (polling)
        {
            method: 'GET',
            path: '/restaurants/:slug/orders',
            handler: 'scoped-orders.find',
            config: {
                auth: {},
                policies: ['global::by-restaurant'],
            },
        },
        // Staff status change
        {
            method: 'PATCH',
            path: '/restaurants/:slug/orders/:id/status',
            handler: 'scoped-orders.updateStatus',
            config: {
                auth: {},
                policies: ['global::by-restaurant'],
            },
        },
    ],
};
