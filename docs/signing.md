# Code signing (optional)

An unsigned installer works, but Windows SmartScreen warns users. To sign it you need a code-signing certificate from a certificate authority (or a cloud signing service). Never commit the certificate or its password to Git.

Typical setup with electron-builder (set these environment variables in the terminal that runs the build, not in files):

```powershell
$env:CSC_LINK = "C:\path\to\certificate.pfx"
$env:CSC_KEY_PASSWORD = "your-certificate-password"
npm run dist:win
```

electron-builder signs the app and installer automatically when it finds a certificate. Even with a signed installer, SmartScreen reputation can take time to build. See the electron-builder "Code Signing" documentation for current options (including Azure Trusted Signing).
