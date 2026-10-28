"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxService = void 0;
const debug_1 = __importDefault(require("debug"));
const config_1 = __importDefault(require("../../config/config"));
const debug = (0, debug_1.default)(`${config_1.default.basicConfig.DEBUG}:tax.service`);
class TaxService {
    calculateTax(UUID, data) {
        debug(`UUID: ${UUID}, data: ${JSON.stringify(data)} in APINodejs Service`);
        return { IVA: data.amount * 0.19 };
    }
}
exports.TaxService = TaxService;
//# sourceMappingURL=tax.service.js.map