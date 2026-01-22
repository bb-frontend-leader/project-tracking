# 📚 Books&Books - Guía Rápida de Configuración

## Paso 1: Configurar Gmail para SMTP

### Opción A: Usar Contraseña de Aplicación (Recomendado)

1. Ve a tu cuenta de Google: https://myaccount.google.com
2. En el menú izquierdo, selecciona **Seguridad**
3. Activa la **Verificación en dos pasos** si no la tienes
4. Busca **Contraseñas de aplicaciones**
5. Genera una nueva contraseña:
   - Selecciona "Correo" como aplicación
   - Selecciona "Otro" como dispositivo
   - Dale un nombre: "Monitor Sitios Web"
6. Copia la contraseña de 16 caracteres

### Opción B: Usar otro servicio SMTP

**Outlook/Hotmail:**
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
```

**Yahoo:**
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false
```

**Servicio SMTP personalizado:**
Usa las credenciales proporcionadas por tu proveedor

## Paso 2: Editar el archivo .env

Abre el archivo `.env` en la raíz del proyecto y completa:

```env
# Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx    # La contraseña de aplicación de 16 caracteres

# Configuración de emails
EMAIL_FROM=tu-email@gmail.com
EMAIL_TO=destinatario@example.com

# Monitoreo cada 5 minutos
CHECK_INTERVAL=*/5 * * * *

TIMEZONE=America/Bogota
MAX_CONSECUTIVE_FAILURES=2
HTTP_TIMEOUT=10000
```

## Paso 3: Configurar los sitios a monitorear

Edita `src/config/services.config.ts`:

```typescript
export const servicesConfig = [
    {
        name: 'VIMEP 2025',
        url: 'https://demos.booksandbooksdigital.com.co/12-vimep-2025/',
        contentValidation: {
            checkForApacheIndex: true  // Detecta listados de directorios
        }
    },
    {
        name: 'Mi Proyecto Web',
        url: 'https://mi-sitio.com',
        contentValidation: {
            checkForApacheIndex: true
        }
    },
    // Agrega más sitios...
];
```

**💡 Validación de Contenido:**
- `checkForApacheIndex: true` - Detecta si el sitio muestra "Index of" de Apache (indica archivos faltantes)

## Paso 4: Ejecutar

```bash
# Desarrollo (con recarga automática)
npm run dev

# Producción
npm run build
npm start
```

## 🎯 Expresiones Cron Comunes

- `*/5 * * * *` - Cada 5 minutos
- `*/10 * * * *` - Cada 10 minutos
- `*/30 * * * *` - Cada 30 minutos
- `0 * * * *` - Cada hora
- `0 */2 * * *` - Cada 2 horas
- `0 9-18 * * *` - Cada hora entre 9 AM y 6 PM
- `0 9,12,15,18 * * *` - A las 9 AM, 12 PM, 3 PM y 6 PM
- `0 9 * * 1-5` - A las 9 AM de lunes a viernes

## ⚙️ Configuraciones Avanzadas

### Cambiar timeout de HTTP
```env
HTTP_TIMEOUT=15000  # 15 segundos
```

### Cambiar número de fallos antes de alertar
```env
MAX_CONSECUTIVE_FAILURES=3  # Alertar después de 3 fallos consecutivos
```

### Múltiples destinatarios
```env
EMAIL_TO=admin@example.com,soporte@example.com,manager@example.com
```

## 📊 Revisar Logs

Los logs se guardan en `logs/monitor.log` en formato JSON.

Para ver los últimos logs:
```bash
# Windows
type logs\monitor.log

# Linux/Mac
tail -f logs/monitor.log
```

## 🔍 Verificar que funciona

1. Inicia el sistema: `npm run dev`
2. Verás mensajes en consola mostrando las verificaciones
3. Si todo está bien, verás: ✅ Service is up (200)
4. Para probar alertas, puedes temporalmente poner una URL inválida

## 🆘 Solución de Problemas

### "Invalid login: 535-5.7.8 Username and Password not accepted"
- Asegúrate de usar una Contraseña de Aplicación, no tu contraseña normal de Gmail
- Verifica que la verificación en dos pasos esté activada

### "ECONNREFUSED"
- Verifica el host y puerto SMTP
- Asegúrate de tener conexión a internet

### No se envían emails
- Revisa la carpeta de spam
- Verifica que `EMAIL_TO` tenga un email válido

### Los sitios aparecen como "down" pero están activos
- Aumenta `HTTP_TIMEOUT`
- Verifica que las URLs tengan el protocolo correcto (https://)

## 🎉 ¡Listo!

Una vez configurado correctamente, el sistema:
- ✅ Verificará automáticamente tus sitios
- ✅ Enviará emails profesionales cuando detecte problemas
- ✅ Mantendrá logs detallados
- ✅ Mostrará el estado en tiempo real en consola

## ❤️ Hecho con el 💙 en Books&Books  

Nos enorgullece desarrollar este proyecto como parte del compromiso de **Books&Books** con la educación y la innovación tecnológica. 🌟  

Gracias por visitar nuestro proyecto. ¡Juntos podemos hacer del aprendizaje una experiencia increíble! 🥳✨