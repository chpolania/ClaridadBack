"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const basicConfig = {
    API_PATH: process.env.API_PATH ?? '/v1',
    DEBUG: process.env.DEBUG ?? 'mati-arqsw:*',
    PORT: process.env.PORT ?? '9080'
};
exports.default = {
    basicConfig,
};
//# sourceMappingURL=config.js.map