# Publicar Calvito

Repositorio: https://github.com/shodzery/calvitobrowser

Sube el código a `main` o `master`. El workflow comprueba sintaxis, ejecuta
pruebas unitarias y abre Electron con un perfil temporal. Después construye
los ejecutables Windows x64. Si la versión de `package.json` no tiene una
release, crea un borrador, carga instalador, portable, blockmap y `latest.yml`,
y lo publica. El repositorio debe ser público para consultar releases sin
credenciales. Nunca se incluye un token en el navegador.

## Publicar una actualización

```powershell
npm version patch --no-git-tag-version
git add package.json package-lock.json src
git commit -m "Publicar nueva version"
git push origin main
```

Sube también cualquier otro archivo modificado. No reutilices una versión
publicada: el workflow conserva sus archivos. Un push sin cambio de versión
ejecuta pruebas y genera artefactos, pero no publica una actualización.
También admite tags `vX.Y.Z` y ejecución manual desde Actions. El tag debe
coincidir con la versión del paquete.

Las instalaciones NSIS consultan GitHub al iniciar y cada cuatro horas salvo
que desactives la opción. El usuario descarga y pulsa **Reiniciar e instalar**.
La edición portable requiere descargar el ejecutable nuevo manualmente.

## Compilar localmente

```powershell
npm ci
npm run check
npm test
npm run test:smoke
npm run dist
```

Archivos en `dist/`: `Calvito-Setup-1.1.0-x64.exe`,
`Calvito-Portable-1.1.0-x64.exe`, blockmap y `latest.yml`.
En CI el destino se obtiene de `GITHUB_REPOSITORY`; localmente, de
`package.json.repository`. El instalador incluye ese destino permanentemente.

## Firma y prueba final

No hay certificado de firma configurado. Windows puede mostrar SmartScreen.
Para identidad verificada configura `CSC_LINK` y `CSC_KEY_PASSWORD` como
secretos de Actions compatibles con electron-builder. No se desactiva la
comprobación de firmas del actualizador.

La prueba completa requiere instalar una versión publicada, publicar otra
superior, buscarla, descargarla y reiniciar. Las pruebas automatizadas cubren
los estados del actualizador, no una actualización real entre releases.

Referencias: [electron-builder](https://www.electron.build/docs/features/auto-update/),
[seguridad de Electron](https://www.electronjs.org/docs/latest/tutorial/security).
