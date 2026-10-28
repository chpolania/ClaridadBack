"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerConfiguration = void 0;
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_1 = __importDefault(require("express"));
const express_actuator_1 = __importDefault(require("express-actuator"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const config_1 = __importDefault(require("../../config/config"));
class ServerConfiguration {
    constructor() {
        this._app = (0, express_1.default)();
        this._apiPath = config_1.default.basicConfig.API_PATH;
        this._fullApiPath = `${this._apiPath}`;
        this.configure();
    }
    configure() {
        this._app.use((0, morgan_1.default)('dev', { skip: (req, res) => req.path === '/management/health' }));
        this._app.use(express_1.default.json());
        this._app.use(express_1.default.urlencoded({ extended: false }));
        this._app.use((0, cookie_parser_1.default)());
        this._app.use(express_1.default.static(path_1.default.join(__dirname, '../static')));
        this._app.use((_, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
            res.header('Allow', 'GET, POST, OPTIONS, PUT, DELETE');
            next();
        });
        this._app.use((0, express_actuator_1.default)({
            basePath: '/management',
        }));
    }
    get app() {
        return this._app;
    }
    get fullApiPath() {
        return this._fullApiPath;
    }
}
exports.ServerConfiguration = ServerConfiguration;
//# sourceMappingURL=server.configuration.js.map