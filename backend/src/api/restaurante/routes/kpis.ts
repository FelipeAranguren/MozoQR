export default {
    routes: [
        {
            method: 'GET',
            path: '/restaurants/:slug/kpis',
            handler: 'kpis.today',
            config: {
                auth: {},
                policies: ['global::by-restaurant'],
            },
        },
        {
            method: 'GET',
            path: '/restaurants/:slug/export',
            handler: 'kpis.exportCsv',
            config: {
                auth: {},
                policies: ['global::by-restaurant'],
            },
        },
    ],
};
