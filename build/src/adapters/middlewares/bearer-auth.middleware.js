"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireBearerAuth = void 0;
const auth_service_1 = require("../../application/use-cases/auth.service");
/** Valida el JWT de acceso enviado por la app en Authorization: Bearer <token>. */
function requireBearerAuth(req, res, next) {
    const authorization = req.header('Authorization') || '';
    const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
    if (!match) {
        next(new auth_service_1.AuthError(401, 'SESSION_EXPIRED', 'Se requiere un access token Bearer válido.'));
        return;
    }
    try {
        const userId = (0, auth_service_1.verifyAccessToken)(match[1]);
        (0, auth_service_1.getCurrentUser)(userId)
            .then(() => {
            res.locals.authUserId = userId;
            next();
        })
            .catch(next);
    }
    catch (error) {
        next(error);
    }
}
exports.requireBearerAuth = requireBearerAuth;
//# sourceMappingURL=bearer-auth.middleware.js.map