# 📚 Books&Books - Sistema de Monitoreo de Sitios Web

Sistema automatizado profesional para monitorear la disponibilidad de sitios web y enviar alertas por correo electrónico cuando se detecten caídas.

## 🚀 Características

- ✅ Verificación periódica de múltiples URLs
- 🔍 **Detección de Apache Index** (identifica listados de directorios)
- 📧 Envío automático de alertas por email
- 📊 Logs detallados de todas las verificaciones
- ⏰ Configuración de horarios con expresiones cron
- 🎯 Control de fallos consecutivos antes de enviar alertas
- 📈 Monitoreo de tiempos de respuesta
- 🏗️ Arquitectura limpia (Clean Architecture + Repository Pattern)

## 📋 Requisitos

- Node.js 18 o superior
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
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-contraseña-de-aplicacion

EMAIL_FROM=tu-email@gmail.com
EMAIL_TO=destinatario1@example.com,destinatario2@example.com

# Verificar cada 5 minutos
CHECK_INTERVAL=*/5 * * * *

TIMEZONE=America/Bogota
MAX_CONSECUTIVE_FAILURES=2
HTTP_TIMEOUT=10000
```

## 📝 Configuración de Servicios

Edita el archivo `src/config/services.config.ts` para agregar los sitios que deseas monitorear:

```typescript
export const servicesConfig = [
    {
        name: 'VIMEP 2025',
        url: 'https://demos.booksandbooksdigital.com.co/12-vimep-2025/',
        contentValidation: {
            checkForApacheIndex: true  // Detecta "Index of" de Apache
        }
    },
    {
        name: 'Mi Sitio Web',
        url: 'https://mi-sitio.com',
        contentValidation: {
            checkForApacheIndex: true
        }
    },
    // Agrega más sitios aquí...
];
```

**📖 Validación de Contenido:**

El sistema no solo verifica que el sitio responda con código 200, sino que también:

- ✅ **Detecta "Index of" de Apache** - Identifica sitios que muestran listado de directorios en lugar del contenido real (indica archivos faltantes o mal configuración del servidor)

## 🚀 Uso

### Modo Desarrollo
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

## ⏰ Expresiones Cron

Ejemplos de configuración para `CHECK_INTERVAL`:

- `*/5 * * * *` - Cada 5 minutos
- `*/15 * * * *` - Cada 15 minutos
- `0 */1 * * *` - Cada hora
- `0 9,17 * * *` - A las 9 AM y 5 PM
- `0 * * * *` - Cada hora en punto

## 📧 Configuración de Gmail

Para usar Gmail como servidor SMTP:

1. Ve a tu cuenta de Google
2. Habilita la verificación en dos pasos
3. Genera una "Contraseña de aplicación":
   - Ve a: https://myaccount.google.com/apppasswords
   - Genera una contraseña para "Correo"
   - Usa esa contraseña en `SMTP_PASS`

## 📊 Logs

Los logs se guardan en la carpeta `logs/`:
- `monitor.log` - Log principal con todas las verificaciones
- Formato JSON para fácil análisis
- También se muestran en consola con colores

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
│   │   ├── checks/
│   │   │   └── check.use-case.ts
│   │   └── email/
│   │       ├── send-email-alert.use-case.ts
│   │       └── verify-email-connection.use-case.ts
│   └── value-objects/           # Objetos de valor
│       ├── check-result.value-object.ts
│       ├── content-validation.value-object.ts
│       ├── email-config.value-object.ts
│       └── monitor-config.value-object.ts
├── infrastructure/              # Implementaciones técnicas
│   ├── datasources/
│   │   └── file-system.datasource.ts
│   ├── email/
│   │   └── email-sender.ts
│   └── http-checker.ts
├── presentation/                # Capa de presentación
│   └── monitor-service.ts
├── config/                      # Configuración
│   ├── plugins/
│   │   └── env.plugin.ts
│   └── services.config.ts
└── main.ts                      # Punto de entrada
```

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
- **dotenv** - Gestión de variables de entorno

## ❤️ Hecho con el 💙 en Books&Books  

Nos enorgullece desarrollar este proyecto como parte del compromiso de **Books&Books** con la educación y la innovación tecnológica. 🌟  

Gracias por visitar nuestro proyecto. ¡Juntos podemos hacer del aprendizaje una experiencia increíble! 🥳✨
