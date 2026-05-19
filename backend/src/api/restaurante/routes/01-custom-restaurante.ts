
export default {
    routes: [
        {
            method: 'POST',
            path: '/restaurantes/impersonate',
            handler: 'restaurante.impersonate',
            config: {
                auth: {},
                policies: ['global::is-platform-admin'],
            },
        },
    ],
};
