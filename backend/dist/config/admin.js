"use strict";
// backend/config/admin.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ({ env }) => ({
    auth: {
        secret: env('ADMIN_JWT_SECRET', '6z0u3EBsS6Vc++psWNiDKuTfzw/NAFCojbrVE0QWmco='),
    },
    apiToken: {
        salt: env('API_TOKEN_SALT', 'NGhq0GjFk6WQUVOBvmRUf47H7tnJ0OmMI7WsEQQQaEs='),
    },
    transfer: {
        token: {
            salt: env('TRANSFER_TOKEN_SALT', 'CLxLKF+87vtZiUo4bXPPNQ3i5CQMMb7PHkHObtSdrxI='),
        },
    },
});
