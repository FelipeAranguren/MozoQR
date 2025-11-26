export default {
    routes: [
        {
            method: "GET",
            path: "/restaurantes/:slug/products-per-day",
            handler: "products-per-day.find",
            config: {
                // Para pruebas puede quedar público; luego protegelo con roles/permisos
            },
        },
    ],
};
