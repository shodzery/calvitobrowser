# Contribuir

Necesitas Node.js 24 y Windows para compilar instaladores. Ejecuta `npm ci`,
`npm run check`, `npm test` y `npm run test:smoke`. Electron se prueba con un
perfil temporal y un servidor local, sin acceder a tu historial real.

Mantén el IPC pequeño y validado. No habilites Node en páginas remotas ni
desactives sandbox, webSecurity o TLS para resolver compatibilidad.
Los cambios de navegación, privacidad y actualizaciones requieren pruebas.
El código es MIT; las dependencias conservan sus licencias.
