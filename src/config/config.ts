import dotenv from 'dotenv';

dotenv.config();

const basicConfig = {
    API_PATH: process.env.API_PATH ?? '/v1',
    DEBUG: process.env.DEBUG ?? 'mati-arqsw:*',
    PORT: process.env.PORT ?? '9080'
}

export default {
    basicConfig,
}
