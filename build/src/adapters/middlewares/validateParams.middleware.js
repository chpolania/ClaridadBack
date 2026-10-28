"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestHeaders = exports.validateRequestBody = void 0;
const index_utils_1 = require("../../utils/index.utils");
const validateParams = (paramProvider, paramType) => async (req, _res, next) => {
    const UUID = (0, index_utils_1.getRequestUUID)(req);
    const params = paramProvider(req);
    const isParamValid = (param) => {
        if (param === null || param === undefined) {
            return false;
        }
        return true;
    };
    if (params.some((param) => !isParamValid(param))) {
        return next(new index_utils_1.CustomError(`UUID: ${UUID}, 400, ${paramType}: parameters is not valid)`));
    }
    next();
};
exports.validateRequestBody = validateParams((req) => Object.values(req.body), 'body');
exports.validateRequestHeaders = validateParams((req) => Object.values(req.headers), 'headers');
//# sourceMappingURL=validateParams.middleware.js.map