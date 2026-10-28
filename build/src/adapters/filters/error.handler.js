"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendErrorResponse = void 0;
const crypto_1 = __importDefault(require("crypto"));
const debug_1 = __importDefault(require("debug"));
const config_1 = __importDefault(require("../../config/config"));
const debug = (0, debug_1.default)(`${config_1.default.basicConfig.DEBUG}:error-handler`);
function sendErrorResponse(error, _request, response, _next) {
    const status = error.status ?? 500;
    const currentDate = new Date().toISOString();
    const description = error.message;
    const _uuid = error.UUID ?? crypto_1.default.randomUUID();
    debug(`UUID: ${_uuid} - Response getting API nodejs arqsw Challenge 2: complete exception - status code: ${status} - Message: ${error.message}`);
    const responseBody = {
        uuid: _uuid,
        StatusCode: status,
        Description: description,
        TimeStamp: currentDate,
    };
    debug(`UUID: ${_uuid} - Response getting API nodejs arqsw Challenge 2: ${JSON.stringify(responseBody)}`);
    response.status(status).json(responseBody);
}
exports.sendErrorResponse = sendErrorResponse;
//# sourceMappingURL=error.handler.js.map