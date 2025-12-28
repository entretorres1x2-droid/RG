# Guía Paso a Paso: Tu App en el Móvil con GitHub

Para tener RentaGol en tu móvil como una app real, necesitamos subirla a un sitio seguro (HTTPS). GitHub Pages es la mejor opción gratuita. Sigue estos pasos:

### 1. Crear tu cuenta y repositorio
1. Entra en [github.com](https://github.com) e inicia sesión.
2. Pulsa el botón **"+"** arriba a la derecha y elige **"New repository"**.
3. Ponle de nombre: `rentagol`.
4. Asegúrate de que esté en **Public**.
5. Pulsa en **"Create repository"**.

### 2. Subir tus archivos (La forma más fácil)
1. En la página de tu nuevo repositorio, verás un texto que dice: *"uploading an existing file"*. Haz clic ahí.
2. Abre la carpeta `RentaGolWeb` en tu ordenador.
3. **Selecciona todos estos archivos** y arrástralos a la web de GitHub:
   - `index.html`
   - `style.css`
   - `app.js`
   - `worker.js`
   - `manifest.json`
   - `sw.js`
   - `icon.png`
4. Espera a que se carguen y pulsa el botón verde **"Commit changes"** abajo del todo.

### 3. Activar la App Web
1. Arriba en las pestañas de tu repositorio, entra en **Settings** (Ajustes).
2. En la columna de la izquierda, haz clic en **Pages**.
3. En el apartado "Build and deployment" > "Branch", selecciona **main** (o master) y pulsa **Save**.
4. ¡Listo! Espera 1 minuto y aparecerá un enlace arriba que dice: `"Your site is live at..."`.

### 4. Instalar en tu Móvil
1. Abre **ese enlace** en el navegador de tu móvil (Safari en iPhone, Chrome en Android).
2. **En iPhone**: Pulsa el icono de **Compartir** (cuadrado con flecha hacia arriba) y busca la opción **"Añadir a pantalla de inicio"**.
3. **En Android**: Pulsa los **tres puntos** arriba a la derecha y elige **"Instalar aplicación"** o **"Añadir a pantalla de inicio"**.

¡Ya tendrás el icono de RentaGol en tu escritorio móvil!
