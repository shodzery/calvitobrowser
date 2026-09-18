# Seguridad y privacidad

Calvito es un navegador experimental basado en Electron/Chromium, no un motor
independiente ni un sustituto auditado de Brave. Mantener Electron actualizado
es parte esencial del mantenimiento.

- Páginas aisladas, sin Node ni puente IPC; sandbox y contextIsolation.
- IPC reservado a la ventana local y su frame principal.
- Navegación y enlaces externos limitados a HTTP(S). No se desactiva TLS.
- Cámara/micrófono, ubicación, notificaciones y portapapeles requieren permiso.
- Bloqueo local de dominios conocidos con excepciones por sitio. No equivale
  a EasyList, antihuella, Safe Browsing, VPN o Tor.
- Perfiles separados. Las pestañas privadas no guardan historial ni sesión;
  sus particiones son temporales. Invitado crea una partición nueva cada vez.
  Los archivos descargados se conservan.
- Datos en JSON local sin cifrar: no guardes secretos en las notas.
- Consultar actualizaciones contacta GitHub. No hay analítica de Calvito.

Se usa una ventana para evitar conflictos del perfil activo. Ventanas
independientes, extensiones Chrome, sincronización y gestor de contraseñas
requieren trabajo adicional. El inventario de datos muestra dominios con
cookies, no enumera todos los orígenes con solo IndexedDB o caché.

Reporta vulnerabilidades desde Security de GitHub si está habilitado. No
publiques claves, datos personales o información de terceros en issues.
