"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const http_1 = __importDefault(require("http"));
const main_1 = __importDefault(require("../main"));
const config_1 = __importDefault(require("../config/config"));
const debug = (0, debug_1.default)(`${config_1.default.basicConfig.DEBUG}:server`);
const port = normalizePort(config_1.default.basicConfig.PORT);
main_1.default.set('port', port);
debug(`Port set to: ${config_1.default.basicConfig.PORT}`);
const server = http_1.default.createServer(main_1.default);
debug(`Server initialized!`);
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);
function normalizePort(val) {
    const nPort = parseInt(val, 10);
    if (isNaN(nPort)) {
        return val;
    }
    if (nPort >= 0) {
        return nPort;
    }
    return false;
}
function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }
    const bind = typeof port === 'string'
        ? `Pipe ${port}`
        : `Port ${port}`;
    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(`${bind} requires elevated privileges`);
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(`${bind} is already in use`);
            process.exit(1);
            break;
        default:
            throw error;
    }
}
/**
 * Event listener for HTTP server 'listening' event.
 */
function onListening() {
    const addr = server.address();
    const bind = typeof addr === 'string'
        ? `pipe ${addr}`
        : `port ${addr.port}`;
    debug('Listening on: %j', bind);
}
exports.default = server;
//# sourceMappingURL=www.js.map