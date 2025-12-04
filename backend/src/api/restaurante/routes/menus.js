export default {
    routes: [
        {
            method: 'GET',
            path: '/restaurants/:slug/menus',
            handler: 'menus.find',
            config: {
                auth: false, // public
                policies: ['global::by-restaurant'],
            },
        },
    ],
};
