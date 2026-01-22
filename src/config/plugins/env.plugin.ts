import env from 'env-var';

import 'dotenv/config';

export const envs = {
    SMTP_HOST: env.get('SMTP_HOST').required().asString(),
    SMTP_PORT: env.get('SMTP_PORT').required().asIntPositive(),
    SMTP_SECURE: env.get('SMTP_SECURE').default('false').asBool(),
    SMTP_USER: env.get('SMTP_USER').required().asString(),
    SMTP_PASS: env.get('SMTP_PASS').required().asString(),
    EMAIL_FROM: env.get('EMAIL_FROM').required().asString(),
    EMAIL_TO: env.get('EMAIL_TO').required().asString().split(',').map(email => email.trim()),
    CHECK_INTERVAL: env.get('CHECK_INTERVAL').default('*/5 * * * *').asString(),
    TIMEZONE: env.get('TIMEZONE').default('America/Bogota').asString(),
    MAX_CONSECUTIVE_FAILURES: env.get('MAX_CONSECUTIVE_FAILURES').default('2').asIntPositive(),
    HTTP_TIMEOUT: env.get('HTTP_TIMEOUT').default('10000').asIntPositive(),
}
