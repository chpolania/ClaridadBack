"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxController = void 0;
const debug_1 = __importDefault(require("debug"));
const express_1 = require("express");
const index_utils_1 = require("../../utils/index.utils");
const config_1 = __importDefault(require("../../config/config"));
const debug = (0, debug_1.default)(`${config_1.default.basicConfig.DEBUG}: tax.controller`);
class TaxController {
    constructor(taxCalculator) {
        this.taxCalculator = taxCalculator;
        this.router = (0, express_1.Router)();
        this.router.post(`/tax`, (req, res, next) => {
            this.getTax(req, res, next);
        });
    }
    getTax(req, res, next) {
        const UUID = (0, index_utils_1.getRequestUUID)(req);
        try {
            const data = req.body;
            const response = this.taxCalculator.calculateTax(UUID, data);
            res.status(200).json(response);
            debug(`UUID: ${UUID} - Response with content ${JSON.stringify(response)}`);
        }
        catch (error) {
            const err = new index_utils_1.CustomError(UUID, error.StatusCOode, error.message);
            next(err);
        }
    }
    getRouter() {
        return this.router;
    }
}
exports.TaxController = TaxController;
//# sourceMappingURL=tax.controller.js.map