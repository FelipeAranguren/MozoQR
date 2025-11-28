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
    ],
};
