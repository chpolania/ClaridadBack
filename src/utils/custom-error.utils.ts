export class CustomError extends Error {
    UUID: string;
    status: number;

    constructor(
        UUID: string,
        status: number = 500,
        message?: string
    ) {
        super(message);
        this.UUID = UUID;
        this.status = status;

        Object.setPrototypeOf(this, CustomError.prototype);
    }
}
