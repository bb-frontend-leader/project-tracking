import env from 'env-var';

import 'dotenv/config';

export const envs = {
    MAILER_SERVICE: env.get('MAILER_SERVICE').default('gmail').asString(),
    SMTP_USER: env.get('SMTP_USER').required().asString(),
    SMTP_PASS: env.get('SMTP_PASS').required().asString(),
    EMAIL_FROM: env.get('EMAIL_FROM').required().asString(),
    EMAIL_TO: env.get('EMAIL_TO').required().asString().split(',').map(email => email.trim()),
    CHECK_INTERVAL: env.get('CHECK_INTERVAL').default('*/5 * * * *').asString(),
    TIMEZONE: env.get('TIMEZONE').default('America/Bogota').asString(),
    MAX_CONSECUTIVE_FAILURES: env.get('MAX_CONSECUTIVE_FAILURES').default('2').asIntPositive(),
    HTTP_TIMEOUT: env.get('HTTP_TIMEOUT').default('10000').asIntPositive(),
    // Minutes between reminders while a service stays down (0 disables reminders)
    ALERT_REMINDER_MINUTES: Math.max(0, env.get('ALERT_REMINDER_MINUTES').default('360').asInt()),
    // Path of the monitored services file (relative paths are resolved from the working directory)
    SERVICES_FILE: env.get('SERVICES_FILE').default('services.json').asString(),
    // Days to keep daily log files
    LOG_RETENTION_DAYS: env.get('LOG_RETENTION_DAYS').default('30').asIntPositive(),
    // Optional URL pinged after every check cycle (e.g. healthchecks.io) to detect a dead monitor
    HEARTBEAT_URL: env.get('HEARTBEAT_URL').asUrlString(),
}
