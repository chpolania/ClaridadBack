"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomError = void 0;
class CustomError extends Error {
    constructor(UUID, status = 500, message) {
        super(message);
        this.UUID = UUID;
        this.status = status;
        Object.setPrototypeOf(this, CustomError.prototype);
    }
}
exports.CustomError = CustomError;
//# sourceMappingURL=custom-error.utils.js.map