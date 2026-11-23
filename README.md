# Smart Hotel IoT — Web SPA

Frontend web ligero en React + TypeScript + Vite que implementa todos los puntos de [integration-web.md](./integration-web.md):

- **Autenticación**: Amazon Cognito User Pool (`ALLOW_USER_SRP_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`, soporte `NEW_PASSWORD_REQUIRED`) + intercambio de `idToken` en Cognito Identity Pool para credenciales AWS temporales.
- **HTTP API v2 (13 endpoints)**: `GET /state`, `POST /commands/lights`, `POST /commands/garage` (con manejo de `409 Conflict`), `POST /commands/door`, `POST /commands/alarm`, `GET /camera/stream`, `GET /camera/snapshots`, `GET /me`, `PUT /me` (solo `name`), `GET/POST/DELETE /rfid-cards`, `GET /events`.
- **Tiempo real MQTT over WSS**: `wss://<iot-ats-endpoint>:443/mqtt` firmado con AWS SigV4 (Web Crypto nativo), solo suscripción a `building/<env>/events`, `building/<env>/telemetry` y `building/<env>/camera/status`.
- **Video y Snapshots**: KVS HLS (`.m3u8`) con `hls.js` y renovación automática antes de 300s + galería S3 Presigned URLs.
- **Modo Demo Local**: permite probar toda la interfaz y flujos localmente sin configurar AWS todavía.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre `http://127.0.0.1:5173`. Si todavía no creaste `.env.local`, puedes entrar directamente con **Modo Demo Local**.

## Conectar con tu stack AWS

1. Copia `.env.example` a `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Completa los outputs de CloudFormation (`smart-hotel-iot-<env>`) y el endpoint de IoT (`aws iot describe-endpoint --endpoint-type iot:Data-ATS`).
3. Reinicia `npm run dev`.

## Build y despliegue (S3 + CloudFront OAC)

```bash
npm run build
aws s3 sync ./dist s3://<WebBucketName> --delete
```
