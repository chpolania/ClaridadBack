import { Request } from 'express';
import { IncomingHttpHeaders } from 'http';

export interface IHeadersDTORequest {
    'X-RqUID': string;
    'Content-Type': string;
    'X-Name': string;
}

export type IHeadersCustom = IncomingHttpHeaders & IHeadersDTORequest;

export interface ICustomRequest<T = object> extends Request {
    body: T;
    headers: IHeadersCustom;
}
export type IRequest = ICustomRequest | Request;

export type IParamType = 'body' | 'headers';
