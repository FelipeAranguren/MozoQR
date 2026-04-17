export default {
    routes: [
        {
            method: 'GET',
            path: '/restaurants/:slug/menus',
            handler: 'menus.find',
            config: {
                auth: false,
                policies: ['global::by-restaurant'],
            },
        },
        {
            method: 'GET',
            path: '/restaurants/:slug/catalog-for-owner',
            handler: 'menus.findForOwner',
            config: {
                auth: {},
                policies: ['global::by-restaurant-owner'],
            },
        },
    ],
};
