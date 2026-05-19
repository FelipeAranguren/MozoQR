export default {
    routes: [
        {
            method: 'GET',
            path: '/restaurants/:slug/orders',
            handler: 'scoped-orders.find',
            config: {
                auth: {},
                policies: ['global::is-restaurant-staff'],
            },
        },
        {
            method: 'POST',
            path: '/restaurants/:slug/orders',
            handler: 'scoped-orders.create',
            config: {
                auth: {},
                policies: ['global::is-restaurant-staff'],
            },
        },
        {
            method: 'PATCH',
            path: '/restaurants/:slug/orders/:id/status',
            handler: 'scoped-orders.updateStatus',
            config: {
                auth: {},
                policies: ['global::is-restaurant-staff'],
            },
        },
        {
            method: 'POST',
            path: '/restaurants/:slug/orders/:id/items',
            handler: 'scoped-orders.addItem',
            config: {
                auth: {},
                policies: ['global::is-restaurant-staff'],
            },
        },
        {
            method: 'PATCH',
            path: '/restaurants/:slug/orders/:id/items/:itemId',
            handler: 'scoped-orders.updateItem',
            config: {
                auth: {},
                policies: ['global::is-restaurant-staff'],
            },
        },
        {
            method: 'DELETE',
            path: '/restaurants/:slug/orders/:id/items/:itemId',
            handler: 'scoped-orders.deleteItem',
            config: {
                auth: {},
                policies: ['global::is-restaurant-staff'],
            },
        },
    ],
};
