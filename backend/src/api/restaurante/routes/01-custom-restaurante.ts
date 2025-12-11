
export default {
    routes: [
        {
            method: 'POST',
            path: '/restaurantes/impersonate',
            handler: 'restaurante.impersonate',
            config: {
                policies: [], // We will check admin role in controller or via global policy if available
            },
        },
    ],
};
