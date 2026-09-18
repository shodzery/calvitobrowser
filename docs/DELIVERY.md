# Entrega 1.1.0

- Instalador: `dist/Calvito-Setup-1.1.0-x64.exe`.
- Portable: `dist/Calvito-Portable-1.1.0-x64.exe`.
- Código: licencia MIT; historial Git local con remoto configurado.
- Repo: https://github.com/shodzery/calvitobrowser

## Publicación pendiente por autenticación

El repositorio está público y vacío. El equipo no tiene credenciales de Git
para subir; la integración GitHub devolvió `403 Resource not accessible by
integration` al intentar escribir. No se publicó código ni una release.

Desde esta carpeta, abre PowerShell y ejecuta:

```powershell
git push -u origin main
```

Completa el inicio de sesión que solicite Git Credential Manager. Si tu
organización o token restringe workflows, autoriza también la escritura de
`.github/workflows`. El commit ya está preparado. Al subirlo, revisa la pestaña
Actions: si las pruebas y compilación terminan correctamente, se publica 1.1.0.

## Comprobaciones

`npm run check`, ocho pruebas unitarias y `npm run test:smoke` verifican
navegación HTTP local, aislamiento de Node/IPC, pestañas privadas, comandos,
notas, perfiles, permisos persistentes, rotación de invitado y temas.
`node tests/packaged.cjs` comprueba el ejecutable empaquetado, su versión,
destino GitHub y el SHA-512 del instalador contra `latest.yml`.

No se instaló el programa en el perfil real ni se probó una actualización
entre dos releases: eso requiere publicar dos versiones. Los ejecutables
no están firmados con un certificado de editor.
