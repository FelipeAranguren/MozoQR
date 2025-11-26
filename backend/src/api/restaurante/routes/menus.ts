export default {
    routes: [
        {
            method: 'GET',
            path: '/restaurants/:slug/menus',
            handler: 'menus.find',
            config: {
                policies: ['global::by-restaurant'],
            },
        },
    ],
};
