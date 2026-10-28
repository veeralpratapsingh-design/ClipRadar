# Troubleshooting

**`EBUSY: resource busy or locked` during `npm install`**
A running copy of the app (or Electron) is locking files. Quit ClipRadar from the tray, run `taskkill /F /IM electron.exe /T`, then retry. If it persists, antivirus may be scanning `node_modules`: delete the `node_modules` folder and run `npm install` again.

**`Cannot create symbolic link` / `winCodeSign` error during `npm run dist:win`**
electron-builder unpacks helper tools that contain symbolic links. Either turn on Windows **Developer Mode** (Settings → System → For developers) or run PowerShell as Administrator, delete `%LOCALAPPDATA%\electron-builder\Cache`, and build again.

**Download errors (Electron or builder tools)**
Check your internet/proxy/VPN. Then delete `node_modules` and `%LOCALAPPDATA%\electron-builder\Cache` and retry.

**`npm audit` reports vulnerabilities**
Keep Electron up to date: `npm install electron@latest --save-dev`, then rebuild. Avoid `npm audit fix --force`.

**Version not found (`ETARGET`) for electron or electron-builder**
Run `npm install electron@latest electron-builder@latest --save-dev` to update the version ranges in `package.json`.

**The installer or app has the wrong icon**
`assets\icon.ico` must contain a 256×256 image (it does). After replacing it, delete `dist` and rebuild; Windows may cache old icons – restart Explorer or reboot to refresh.

**The installed app doesn't show in the tray / window won't reopen**
It is running in the tray (Settings → App → Keep running in the tray). Click the tray icon, or quit it from the tray menu.

<a id="logo-licence"></a>
**Logo licence**
`assets/icon.*` and `src/renderer/logo.png` were supplied by the project owner. If the logo came from an icon library, check that its licence (and any attribution requirement) allows use in a distributed app before publishing the installer.

**Poppins font licence**
The bundled Poppins fonts are under the SIL Open Font License 1.1. When you distribute the app, include the font's `OFL.txt` (from the official Poppins release) next to the fonts in `src/renderer/fonts/`.
