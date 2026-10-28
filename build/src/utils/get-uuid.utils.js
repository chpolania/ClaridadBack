"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRequestUUID = void 0;
const crypto_1 = __importDefault(require("crypto"));
function getRequestUUID(req) {
    let UUID = '';
    if (req.header('X-RqUID') !== '') {
        UUID = req.header('X-RqUID');
    }
    else {
        UUID = crypto_1.default.randomUUID();
    }
    return UUID;
}
exports.getRequestUUID = getRequestUUID;
//# sourceMappingURL=get-uuid.utils.js.map