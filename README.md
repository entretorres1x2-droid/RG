# RentaGol Web App

Esta es la versión web de **RentaGol**, diseñada para funcionar en móviles y ordenadores modernos.

## 🚀 Cómo ejecutar la App

**IMPORTANTE**: Debido a que la app usa "Web Workers" para realizar los cálculos matemáticos pesados en segundo plano, **NO funcionará correctamente si simplemente haces doble clic en `index.html`** (los navegadores bloquean los workers en archivos locales por seguridad).

Tienes dos opciones sencillas:

### Opción A: Usar "Web Server for Chrome" (o similar)
Cualquier extensión que sirva ficheros locales funcionará.

### Opción B: Usar Python o Node (Recomendado)
Si tienes Python instalado, abre una terminal en esta carpeta y escribe:
```bash
python -m http.server
```
Luego ve a `http://localhost:8000`.

Si tienes Node.js:
```bash
npx serve
```

## 📱 Uso en el Móvil
Una vez iniciada en tu ordenador:
1. Asegúrate de que el móvil y el PC estén en la misma red WiFi.
2. Averigua la IP de tu PC (comando `ipconfig`).
3. En el móvil, entra a `http://TU_IP:8000`.

## ⚠️ Nota sobre la API (CORS)
La descarga de datos desde `api.eduardolosilla.es` puede ser bloqueada por el navegador. Si ves un error de conexión:
1. Ve a la web de Eduardo Losilla o usa la App de escritorio para copiar los porcentajes raw.
2. Pégalos en las pestañas "Reales" y "LAE" de la Web App.
