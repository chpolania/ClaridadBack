"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mysqlPool = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const promise_1 = __importDefault(require("mysql2/promise"));
dotenv_1.default.config();
/** Pool compartido por los adaptadores de persistencia del backend. */
exports.mysqlPool = promise_1.default.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'claridad',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'claridad',
    connectionLimit: 10,
    timezone: 'Z',
});
//# sourceMappingURL=mysql.pool.js.map