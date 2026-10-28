"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tax_controller_1 = require("../controllers/tax.controller");
const tax_service_1 = require("../../application/use-cases/tax.service");
const validateParams_middleware_1 = require("../middlewares/validateParams.middleware");
const taxRouter = (0, express_1.Router)();
const taxController = new tax_controller_1.TaxController(new tax_service_1.TaxService());
taxRouter.use([validateParams_middleware_1.validateRequestHeaders, validateParams_middleware_1.validateRequestBody], taxController.getRouter());
exports.default = taxRouter;
//# sourceMappingURL=tax.router.js.map