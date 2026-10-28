# Integración de autenticación móvil

La API expone las rutas bajo `${API_BASE_URL}/auth`. Con `API_PATH=/v1`, la ruta de perfil es `GET /v1/auth/me`.

## Flujo por correo

1. `POST /v1/auth/email/request-code` con `{ "email": "ana@example.com" }`.
2. Guardar el `challengeId` de la respuesta en memoria mientras se muestra la pantalla del código.
3. `POST /v1/auth/email/verify` con `{ "challengeId": "...", "email": "ana@example.com", "code": "123456" }`.
4. Guardar `accessToken` y `refreshToken` en almacenamiento seguro del sistema operativo (Keychain/Keystore). No guardarlos en AsyncStorage.

## Enviar el Bearer token

Para rutas protegidas, incluido `GET /v1/auth/me`, enviar el access token en el header:

```http
Authorization: Bearer <accessToken>
```

Ejemplo con `fetch`:

```ts
const response = await fetch(`${API_BASE_URL}/auth/me`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});

if (response.status === 401) {
  // Solicitar un access token nuevo con POST /auth/refresh.
}
```

El access token vence en una hora (`expiresIn: 3600`). Para renovarlo, enviar `POST /v1/auth/refresh` con `{ "refreshToken": "..." }`, y reemplazar ambos tokens por los valores de la respuesta. Para cerrar sesión, enviar `POST /v1/auth/logout` con el refresh token y borrar ambos tokens del almacenamiento seguro.

El middleware reutilizable `requireBearerAuth` está en `src/adapters/middlewares/bearer-auth.middleware.ts`. Se aplica a `/auth/me` y puede agregarse a las demás rutas privadas. El identificador autenticado queda disponible en `res.locals.authUserId` para que cada caso de uso limite sus consultas a ese usuario.
