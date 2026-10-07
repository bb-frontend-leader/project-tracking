# 📚 Books&Books - Sistema de Monitoreo de Sitios Web

Sistema automatizado para monitorear la disponibilidad de sitios web servidos con **nginx** y enviar alertas por correo electrónico cuando se detecten caídas.

## 🚀 Características

- ✅ Verificación periódica de múltiples URLs (en paralelo)
- 🔍 **Validación de contenido**: título esperado, textos prohibidos (página por defecto de nginx, soft-404), listados de directorio y archivos JS/CSS de las SPAs
- 📧 Alertas por email **sin spam**: un aviso al caer, recordatorios espaciados y un aviso de recuperación
- 🗂️ **Lista de servicios en `services.json`** (fuera de git): se relee en cada ciclo, sin commit ni deploy
- 📊 Logs en JSON, un archivo por día, con retención configurable
- ⏰ Configuración de horarios con expresiones cron
- 🎯 Control de fallos consecutivos antes de enviar alertas
- 💓 Heartbeat opcional para detectar si el propio monitor se cae
- 🏗️ Arquitectura limpia (Clean Architecture + Repository Pattern)

## 📋 Requisitos

- Node.js 22 o superior (LTS)
- Cuenta de correo con acceso SMTP (ej: Gmail)

## 🔧 Instalación

1. Clona el repositorio o descarga el código

2. Instala las dependencias:
```bash
npm install
```

3. Crea el archivo `.env` basado en `.env.example`:
```bash
cp .env.example .env
```

4. Configura tus variables de entorno en `.env`:
```env
# Para Gmail, genera una "Contraseña de aplicación" en tu cuenta Google
MAILER_SERVICE=gmail
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-contraseña-de-aplicacion

EMAIL_FROM=tu-email@gmail.com
EMAIL_TO=destinatario1@example.com,destinatario2@example.com

# Verificar cada 5 minutos
CHECK_INTERVAL=*/5 * * * *

TIMEZONE=America/Bogota
MAX_CONSECUTIVE_FAILURES=2
ALERT_REMINDER_MINUTES=360
HTTP_TIMEOUT=10000
```

5. Crea la lista de servicios a partir de la plantilla:
```bash
cp services.example.json services.json
```

### Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `MAILER_SERVICE` | `gmail` | Servicio de correo de nodemailer (`gmail`, `hotmail`, ...) |
| `SMTP_USER`, `SMTP_PASS` | — (requeridas) | Credenciales del correo |
| `EMAIL_FROM`, `EMAIL_TO` | — (requeridas) | Remitente y destinatarios (separados por coma) |
| `CHECK_INTERVAL` | `*/5 * * * *` | Expresión cron de las verificaciones |
| `TIMEZONE` | `America/Bogota` | Zona horaria del cron, los logs y los correos |
| `MAX_CONSECUTIVE_FAILURES` | `2` | Fallos seguidos antes de enviar la primera alerta |
| `ALERT_REMINDER_MINUTES` | `360` | Minutos entre recordatorios mientras siga caído (`0` = sin recordatorios) |
| `HTTP_TIMEOUT` | `10000` | Tiempo máximo (ms) de cada verificación, incluyendo la descarga del contenido |
| `SERVICES_FILE` | `services.json` | Ruta del archivo de servicios (relativa a la carpeta desde la que se ejecuta) |
| `LOG_RETENTION_DAYS` | `30` | Días que se conservan los logs diarios |
| `HEARTBEAT_URL` | — | URL a la que se hace un GET al terminar cada ciclo (opcional) |

## 📝 Configuración de Servicios

Los sitios a monitorear se definen en `services.json`, que **no se guarda en git**: cada despliegue tiene el suyo. En el repositorio solo está la plantilla `services.example.json`.

```json
{
  "defaults": {
    "contentValidation": {
      "checkForDirectoryListing": true,
      "forbiddenText": ["Welcome to nginx!", "Página no encontrada"]
    }
  },
  "services": [
    {
      "name": "300 OVAS 2026",
      "url": "https://demos.booksandbooksdigital.com.co/300-ovas-2026/",
      "contentValidation": { "expectedTitle": "300 OVAS 2026", "checkAssets": true }
    },
    {
      "name": "Mi Sitio Web",
      "url": "https://mi-sitio.com"
    }
  ]
}
```

- `defaults.contentValidation` (opcional) se aplica a todos los servicios; el `contentValidation` de cada servicio se mezcla encima y puede cambiar cualquier valor.
- **El archivo se relee al inicio de cada ciclo**: para agregar, quitar o editar un sitio basta con guardar `services.json` y esperar al siguiente ciclo, sin reiniciar ni hacer deploy. Los servicios que se mantienen conservan su estado (fallos consecutivos e incidente abierto), y se identifican por su URL.
- Si el archivo queda inválido mientras el monitor corre, se mantiene la lista anterior y se registra el error. Si no existe o es inválido **al arrancar**, el monitor no inicia y explica qué corregir.
- Las claves desconocidas se rechazan, así un error de tipeo como `expectedTitel` no pasa desapercibido.
- Como el archivo no tiene historial en git, conviene guardar una copia de respaldo.

### Validación de contenido

El sistema no solo verifica que el sitio responda con código 2xx; además puede validar la página:

| Opción | Tipo | Qué hace |
|---|---|---|
| `expectedTitle` | texto | El `<title>` debe contener este texto (sin distinguir mayúsculas). Detecta páginas por defecto, soft-404 y sitios equivocados |
| `checkForDirectoryListing` | `true`/`false` | Falla si la página es un listado `Index of /...` (nginx `autoindex` o Apache): indica archivos faltantes |
| `forbiddenText` | lista de textos | Falla si la página contiene alguno (ej. `Welcome to nginx!`, `Página no encontrada`) |
| `checkAssets` | `true`/`false` | Para SPAs (Vite, etc.): verifica que los `<script>` y `<link rel="stylesheet">` del mismo origen respondan OK (máx. 5). Detecta el "200 con pantalla en blanco" cuando falta el bundle |

> **Nota sobre nginx:** un directorio sin `index.html` responde **403 Forbidden** y una ruta inexistente **404**, que ya se detectan por el código de estado. Por eso `expectedTitle` y `forbiddenText` son las validaciones más útiles para páginas que responden 200 pero no son el sitio correcto.

## 🚀 Uso

### Modo Desarrollo (con recarga automática)
```bash
npm run dev
```

### Modo Producción
```bash
# Compilar
npm run build

# Ejecutar
npm start
```

### Otros comandos
```bash
npm test          # Tests (node:test)
npm run typecheck # Verificación de tipos
npm run lint      # ESLint
```

## 🔄 Ejecución continua

El monitor es un proceso único: usa un supervisor para que arranque con el servidor y se reinicie si falla. Ejecútalo siempre desde la carpeta del proyecto (ahí se buscan `.env`, `services.json` y `logs/`).

**pm2**
```bash
npm run build
pm2 start dist/main.js --name project-tracking
pm2 save && pm2 startup
```

**systemd** (`/etc/systemd/system/project-tracking.service`)
```ini
[Unit]
Description=Books&Books Website Monitor
After=network-online.target

[Service]
WorkingDirectory=/opt/project-tracking
ExecStart=/usr/bin/node dist/main.js
Restart=always

[Install]
WantedBy=multi-user.target
```

**Actualizar el código:** `git pull && npm ci && npm run build` y reiniciar el proceso. **Cambiar los sitios:** solo editar `services.json`.

Para enterarte si el propio monitor se cae, configura `HEARTBEAT_URL` con un servicio como [healthchecks.io](https://healthchecks.io): se hace un GET al terminar cada ciclo y, si dejan de llegar pings, ese servicio te avisa.

## ⏰ Expresiones Cron

Ejemplos de configuración para `CHECK_INTERVAL`:

- `*/5 * * * *` - Cada 5 minutos
- `*/15 * * * *` - Cada 15 minutos
- `0 */1 * * *` - Cada hora
- `0 9,17 * * *` - A las 9 AM y 5 PM
- `0 * * * *` - Cada hora en punto

## 📧 Alertas

Para cada servicio se envía un máximo de tres tipos de correo:

1. **🚨 Caído**: cuando falla `MAX_CONSECUTIVE_FAILURES` veces seguidas. Se envía una sola vez por incidente.
2. **⏰ Recordatorio**: si sigue caído, cada `ALERT_REMINDER_MINUTES` minutos (`0` lo desactiva).
3. **✅ Recuperado**: cuando vuelve a responder bien, con la duración de la caída.

Si el correo no se puede entregar, se reintenta en el siguiente ciclo. El estado de los incidentes vive en memoria: tras reiniciar el monitor, un sitio que siga caído volverá a avisar al cumplir el umbral de fallos.

### Configuración de Gmail

Para usar Gmail como servidor SMTP:

1. Ve a tu cuenta de Google
2. Habilita la verificación en dos pasos
3. Genera una "Contraseña de aplicación":
   - Ve a: https://myaccount.google.com/apppasswords
   - Genera una contraseña para "Correo"
   - Usa esa contraseña en `SMTP_PASS`

Si el servidor SMTP no responde al arrancar, el monitor **sigue vigilando** (los fallos quedan en los logs) y reintenta enviar las alertas en cada ciclo.

## 📊 Logs

Los logs se guardan en la carpeta `logs/`, un archivo por día: `monitor-AAAA-MM-DD.log` (el día se calcula con `TIMEZONE`). Los archivos más antiguos que `LOG_RETENTION_DAYS` se eliminan automáticamente.

- Una línea JSON por verificación, con `timestamp` en ISO 8601 (UTC) y `responseTime` numérico en milisegundos, fácil de procesar:
  ```json
  {"timestamp":"2026-10-07T15:30:00.000Z","name":"VIMEP 2025","url":"https://...","status":"success","code":200,"message":"Service is up (200)","responseTime":432}
  ```
- También se muestran en consola con colores.

## 🏗️ Arquitectura

El proyecto implementa **Clean Architecture** con **Repository Pattern**:

```
src/
├── domain/                      # Lógica de negocio pura
│   ├── entities/                # Entidades del dominio
│   │   ├── log.entity.ts
│   │   └── service.entity.ts
│   ├── repositories/            # Contratos (interfaces)
│   │   ├── email.repository.ts
│   │   ├── http-checker.repository.ts
│   │   └── log.repository.ts
│   ├── use-cases/               # Casos de uso
│   │   ├── alerts/
│   │   │   └── decide-alert.ts  # Política de alertas (caído / recordatorio / recuperado)
│   │   ├── checks/
│   │   │   └── check.use-case.ts
│   │   └── email/
│   │       ├── send-email-alert.use-case.ts
│   │       └── verify-email-connection.use-case.ts
│   └── value-objects/           # Objetos de valor
│       ├── alert-notification.value-object.ts
│       ├── check-result.value-object.ts
│       ├── content-validation.value-object.ts
│       ├── email-config.value-object.ts
│       └── monitor-config.value-object.ts
├── infrastructure/              # Implementaciones técnicas
│   ├── datasources/
│   │   └── file-system.datasource.ts
│   ├── email/
│   │   └── email-sender.ts
│   ├── heartbeat.ts
│   └── http-checker.ts
├── presentation/                # Capa de presentación
│   └── monitor-service.ts
├── config/                      # Configuración
│   ├── plugins/
│   │   └── env.plugin.ts
│   └── services.loader.ts       # Lectura y validación de services.json
├── utils/                       # Utilidades puras
│   ├── escape-html.ts
│   └── format-duration.ts
└── main.ts                      # Punto de entrada
```

Los tests (`*.test.ts`) están junto al código que prueban.

**Principios aplicados:**
- ✅ Separación de responsabilidades
- ✅ Inversión de dependencias
- ✅ Repository Pattern para abstracción de datos
- ✅ Use Cases para lógica de negocio
- ✅ Value Objects para datos inmutables

## 🛠️ Tecnologías

- **TypeScript** - Lenguaje tipado
- **Node.js** - Runtime
- **node-cron** - Programación de tareas
- **nodemailer** - Envío de emails
- **dotenv** / **env-var** - Gestión de variables de entorno

## ❤️ Hecho con el 💙 en Books&Books  

Nos enorgullece desarrollar este proyecto como parte del compromiso de **Books&Books** con la educación y la innovación tecnológica. 🌟  

Gracias por visitar nuestro proyecto. ¡Juntos podemos hacer del aprendizaje una experiencia increíble! 🥳✨
