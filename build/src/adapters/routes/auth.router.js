"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const debug_1 = __importDefault(require("debug"));
const auth_service_1 = require("../../application/use-cases/auth.service");
const bearer_auth_middleware_1 = require("../middlewares/bearer-auth.middleware");
const authRouter = (0, express_1.Router)();
const debug = (0, debug_1.default)('claridad:auth');
const asyncRoute = (handler) => (req, res, next) => { handler(req, res).catch(next); };
const bodyString = (req, name) => {
    const value = req.body?.[name];
    if (typeof value !== 'string' || !value.trim())
        throw new auth_service_1.AuthError(400, 'INVALID_REQUEST', `El campo ${name} es obligatorio.`);
    return value.trim();
};
authRouter.post('/email/request-code', asyncRoute(async (req, res) => {
    const requestIp = req.ip || req.socket.remoteAddress || 'unknown';
    res.status(202).json(await (0, auth_service_1.requestEmailCode)(bodyString(req, 'email'), requestIp));
}));
authRouter.post('/email/verify', asyncRoute(async (req, res) => {
    const challengeId = bodyString(req, 'challengeId');
    const email = bodyString(req, 'email');
    const code = bodyString(req, 'code');
    if (!/^\d{6}$/.test(code))
        throw new auth_service_1.AuthError(400, 'INVALID_OR_EXPIRED_CODE', 'El código no es válido o expiró.');
    res.status(200).json(await (0, auth_service_1.verifyEmailCode)(challengeId, email, code));
}));
authRouter.post('/oauth/:provider', asyncRoute(async (req, res) => {
    const provider = req.params.provider;
    if (provider !== 'google' && provider !== 'facebook')
        throw new auth_service_1.AuthError(404, 'NOT_FOUND', 'Ruta no encontrada.');
    res.status(200).json(await (0, auth_service_1.oauthLogin)(provider, bodyString(req, 'identityToken')));
}));
authRouter.get('/me', bearer_auth_middleware_1.requireBearerAuth, asyncRoute(async (_req, res) => {
    res.status(200).json(await (0, auth_service_1.getCurrentUser)(res.locals.authUserId));
}));
authRouter.post('/refresh', asyncRoute(async (req, res) => {
    res.status(200).json(await (0, auth_service_1.refreshSession)(bodyString(req, 'refreshToken')));
}));
authRouter.post('/logout', asyncRoute(async (req, res) => {
    await (0, auth_service_1.logoutSession)(bodyString(req, 'refreshToken'));
    res.status(204).end();
}));
authRouter.use((error, _req, res, _next) => {
    if (error instanceof auth_service_1.AuthError) {
        res.status(error.status).json({ error: { code: error.code, message: error.message } });
        return;
    }
    const databaseCode = error.code;
    // Log only server-side diagnostics; never log request bodies, OTPs, or tokens.
    debug(`Authentication request failed (${databaseCode || error.name}): ${error.message}`);
    if (databaseCode === 'ER_NO_SUCH_TABLE') {
        res.status(503).json({ error: { code: 'DATABASE_SCHEMA_NOT_READY', message: 'Faltan tablas de autenticación. Ejecuta docs/claridad-auth-mysql.sql.' } });
        return;
    }
    if (databaseCode === 'ECONNREFUSED' || databaseCode === 'ETIMEDOUT' || databaseCode === 'ER_ACCESS_DENIED_ERROR' || databaseCode === 'ER_BAD_DB_ERROR') {
        res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'No se pudo conectar con la base de datos. Revisa MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD y MYSQL_DATABASE.' } });
        return;
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' } });
});
exports.default = authRouter;
//# sourceMappingURL=auth.router.js.map