export interface IGetTaxRequest {
    id: string;
    amount: number;
    idClient: string;
    email: string;
}

export interface IGetTaxResponse {
    IVA: number;
}
