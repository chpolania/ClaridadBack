"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const server_configuration_1 = require("./infrastructure/server/server.configuration");
const error_handler_1 = require("./adapters/filters/error.handler");
const tax_router_1 = __importDefault(require("./adapters/routes/tax.router"));
const auth_router_1 = __importDefault(require("./adapters/routes/auth.router"));
const calendar_router_1 = __importDefault(require("./adapters/routes/calendar.router"));
const server = new server_configuration_1.ServerConfiguration();
const app = server.app;
const fullApiPath = server.fullApiPath;
app.use(fullApiPath, tax_router_1.default);
app.use(`${fullApiPath}/auth`, auth_router_1.default);
app.use(`${fullApiPath}/calendar`, calendar_router_1.default);
app.use(error_handler_1.sendErrorResponse);
exports.default = app;
//# sourceMappingURL=main.js.map