# 📚 Books&Books - Guía Rápida de Configuración

## Paso 1: Configurar el correo (Gmail)

1. Ve a tu cuenta de Google: https://myaccount.google.com
2. En el menú izquierdo, selecciona **Seguridad**
3. Activa la **Verificación en dos pasos** si no la tienes
4. Busca **Contraseñas de aplicaciones**
5. Genera una nueva contraseña:
   - Selecciona "Correo" como aplicación
   - Selecciona "Otro" como dispositivo
   - Dale un nombre: "Monitor Sitios Web"
6. Copia la contraseña de 16 caracteres

**Otro proveedor:** el proyecto usa el `service` de nodemailer, así que basta con cambiar `MAILER_SERVICE`
(por ejemplo `hotmail` para Outlook/Hotmail o `yahoo`). La lista completa está en la
[documentación de nodemailer](https://nodemailer.com/smtp/well-known-services/).

## Paso 2: Editar el archivo .env

Copia la plantilla y completa los valores:

```bash
cp .env.example .env
```

```env
# Gmail
MAILER_SERVICE=gmail
SMTP_USER=tu-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx    # La contraseña de aplicación de 16 caracteres

# Configuración de emails
EMAIL_FROM=tu-email@gmail.com
EMAIL_TO=destinatario@example.com

# Monitoreo cada 5 minutos
CHECK_INTERVAL=*/5 * * * *

TIMEZONE=America/Bogota
MAX_CONSECUTIVE_FAILURES=2
ALERT_REMINDER_MINUTES=360
HTTP_TIMEOUT=10000
```

Todas las variables están descritas en [README.md](README.md#variables-de-entorno).

## Paso 3: Configurar los sitios a monitorear

Los sitios viven en `services.json`, un archivo que **no se guarda en git**. Créalo desde la plantilla:

```bash
cp services.example.json services.json
```

Y edítalo:

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
      "name": "VIMEP 2025",
      "url": "https://demos.booksandbooksdigital.com.co/12-vimep-2025/",
      "contentValidation": { "expectedTitle": "12 OVAS VIMEP 2025", "checkAssets": true }
    },
    {
      "name": "Mi Proyecto Web",
      "url": "https://mi-sitio.com"
    }
  ]
}
```

**💡 Validación de Contenido** (todas opcionales):
- `expectedTitle` - Texto que debe aparecer en el `<title>` de la página
- `checkForDirectoryListing: true` - Detecta listados "Index of /" (indica archivos faltantes)
- `forbiddenText` - Textos que no deben aparecer (página por defecto de nginx, "Página no encontrada")
- `checkAssets: true` - Para SPAs: verifica que los JS/CSS de la página respondan

**🔄 Sin reiniciar ni hacer deploy:** el monitor relee `services.json` en cada ciclo. Para agregar, quitar o editar un sitio, guarda el archivo y espera al siguiente ciclo. Si el archivo queda con errores, el monitor mantiene la lista anterior y muestra qué corregir en la consola.

## Paso 4: Ejecutar

```bash
# Desarrollo (con recarga automática al cambiar el código)
npm run dev

# Producción
npm run build
npm start
```

Para dejarlo corriendo de forma permanente (pm2, systemd) consulta
[Ejecución continua](README.md#-ejecución-continua) en el README. Ejecútalo siempre desde la carpeta del proyecto.

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
HTTP_TIMEOUT=15000  # 15 segundos (cubre la respuesta completa)
```

### Cambiar número de fallos antes de alertar
```env
MAX_CONSECUTIVE_FAILURES=3  # Alertar después de 3 fallos consecutivos
```

### Recordatorios mientras un sitio sigue caído
```env
ALERT_REMINDER_MINUTES=120  # Un recordatorio cada 2 horas (0 = sin recordatorios)
```

### Múltiples destinatarios
```env
EMAIL_TO=admin@example.com,soporte@example.com,manager@example.com
```

### Usar otra ubicación para la lista de servicios
```env
SERVICES_FILE=/etc/project-tracking/services.json
```

### Detectar si el monitor se cae
```env
HEARTBEAT_URL=https://hc-ping.com/tu-uuid   # Se hace un GET al final de cada ciclo
```

## 📊 Revisar Logs

Los logs se guardan en `logs/monitor-AAAA-MM-DD.log` (un archivo por día) en formato JSON, una línea por verificación. Los archivos con más de `LOG_RETENTION_DAYS` días (30 por defecto) se borran solos.

Para ver los logs de hoy:
```bash
# Windows (PowerShell)
Get-Content logs\monitor-2026-10-07.log -Tail 20

# Linux/Mac
tail -f logs/monitor-$(date +%F).log
```

## 🔍 Verificar que funciona

1. Inicia el sistema: `npm run dev`
2. Verás mensajes en consola mostrando las verificaciones
3. Si todo está bien, verás: ✅ Service is up (200)
4. Para probar alertas, puedes agregar temporalmente a `services.json` una URL inexistente: tras `MAX_CONSECUTIVE_FAILURES` ciclos recibirás el correo de caída, y al quitarla (o corregirla) el de recuperación

## 🆘 Solución de Problemas

### "No se pudo cargar la lista de servicios"
- Verifica que exista `services.json` (cópialo desde `services.example.json`)
- El mensaje indica la línea del problema: JSON mal formado, URL inválida, claves desconocidas, etc.

### "Invalid login: 535-5.7.8 Username and Password not accepted"
- Asegúrate de usar una Contraseña de Aplicación, no tu contraseña normal de Gmail
- Verifica que la verificación en dos pasos esté activada

### "ECONNREFUSED" al enviar correos
- Verifica `MAILER_SERVICE` y tu conexión a internet
- El monitor sigue funcionando y reintenta el envío en cada ciclo

### No se envían emails
- Revisa la carpeta de spam
- Verifica que `EMAIL_TO` tenga un email válido
- Recuerda que solo se envía un aviso por incidente, más los recordatorios y la recuperación

### Los sitios aparecen como "down" pero están activos
- Aumenta `HTTP_TIMEOUT`
- Verifica que las URLs tengan el protocolo correcto (https://)
- Revisa el mensaje del log: si dice `Unexpected page title`, el `expectedTitle` no coincide con el título real de la página

## 🎉 ¡Listo!

Una vez configurado correctamente, el sistema:
- ✅ Verificará automáticamente tus sitios
- ✅ Enviará un correo al caer, recordatorios y un aviso al recuperarse
- ✅ Mantendrá logs detallados
- ✅ Mostrará el estado en tiempo real en consola

## ❤️ Hecho con el 💙 en Books&Books  

Nos enorgullece desarrollar este proyecto como parte del compromiso de **Books&Books** con la educación y la innovación tecnológica. 🌟  

Gracias por visitar nuestro proyecto. ¡Juntos podemos hacer del aprendizaje una experiencia increíble! 🥳✨
