# Contrato de autenticación para Claridad

Este documento define el backend necesario para conectar la pantalla actual de acceso de Claridad. El repositorio todavía no tiene backend ni proveedor de autenticación configurados.

## Flujo que presenta el frontend

- La pantalla inicial solicita correo y ofrece botones de Google y Facebook.
- No hay campo de contraseña. El flujo recomendado para correo es un código de un solo uso enviado por email (OTP).
- Después de solicitar el código, el frontend debe mostrar una segunda pantalla para ingresarlo. La pantalla actual todavía no incluye ese paso y hoy solo muestra avisos informativos.
- Google y Facebook son botones visuales; el frontend aún no inicia OAuth. Cada uno deberá abrir el flujo OAuth nativo/web y enviar al backend una credencial de identidad firmada por el proveedor.
- Al validar cualquier método, el backend devuelve los mismos tokens y el mismo perfil de usuario. La app los usa para abrir la experiencia principal.

## API propuesta

Base URL configurable por entorno, por ejemplo `https://api.<dominio>/v1`. Todas las respuestas JSON; fechas en ISO 8601 UTC. TLS obligatorio.

### Solicitar código por correo

`POST /auth/email/request-code`

```json
{ "email": "ana@example.com" }
```

Respuesta `202 Accepted` (mensaje idéntico exista o no la cuenta):

```json
{
  "message": "Si el correo puede usarse, enviaremos un código.",
  "challengeId": "uuid",
  "expiresIn": 600,
  "resendAfter": 60
}
```

El backend genera un código aleatorio de un solo uso, lo envía por correo, guarda solo su hash, lo limita a 10 minutos y limita intentos y reenvíos por correo/IP. La respuesta no debe revelar si una cuenta existe.

### Verificar código e iniciar sesión

`POST /auth/email/verify`

```json
{ "challengeId": "uuid", "email": "ana@example.com", "code": "123456" }
```

Respuesta `200 OK`:

```json
{
  "accessToken": "<JWT de corta duración>",
  "expiresIn": 3600,
  "refreshToken": "<token aleatorio opaco>",
  "user": {
    "id": "uuid",
    "email": "ana@example.com",
    "emailVerified": true,
    "displayName": null,
    "avatarUrl": null
  }
}
```

`challengeId` debe consumirse una sola vez. Al validar, crear o encontrar el usuario y vincular el método de email en una transacción. El token de acceso incluye `sub` igual a `user.id`; no incluir información sensible.

### Acceso con Google o Facebook

`POST /auth/oauth/{provider}` donde `{provider}` es `google` o `facebook`.

```json
{ "identityToken": "<token emitido por el proveedor>" }
```

La respuesta exitosa usa el mismo formato de tokens y `user` de `/auth/email/verify`. El backend debe validar firma y claves públicas vigentes, emisor, audiencia/client ID, expiración y sujeto del token. Para Google validar también `nonce` cuando el flujo lo use. No confiar en email, `userId` ni perfil enviados como campos independientes por el cliente. Identificar la cuenta social por `(provider, provider_subject)`.

El frontend debe usar OAuth mediante navegador/SDK oficial y PKCE cuando corresponda; nunca incluir secretos OAuth de servidor en la app. Si el flujo elegido entrega un authorization code en vez de un ID token, el backend debe exponer un intercambio equivalente y validar `state`/PKCE. Registrar las URLs de retorno de desarrollo y producción antes de habilitar los botones.

### Sesión

- `GET /auth/me` — requiere `Authorization: Bearer <accessToken>`; devuelve `{ "user": ... }`.
- `POST /auth/refresh` — recibe `{ "refreshToken": "..." }`; rota el refresh token y devuelve tokens nuevos con el mismo formato de inicio de sesión.
- `POST /auth/logout` — recibe `{ "refreshToken": "..." }`; revoca esa sesión y devuelve `204 No Content`.

El access token dura una hora. Guardar en base de datos solo el hash de cada refresh token, rotarlo en cada uso y revocar la familia si se reutiliza uno antiguo. En el cliente, guardar tokens en almacenamiento seguro del sistema, nunca en AsyncStorage ni logs.

## Esquema de base de datos (PostgreSQL)

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE,
  email_verified_at TIMESTAMPTZ,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at TIMESTAMPTZ
);

CREATE TABLE auth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('email', 'google', 'facebook')),
  provider_subject TEXT NOT NULL,
  provider_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject)
);

CREATE INDEX auth_identities_user_id_idx ON auth_identities(user_id);

CREATE TABLE email_login_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX email_login_challenges_email_created_idx
  ON email_login_challenges(email_normalized, created_at DESC);

CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by UUID REFERENCES auth_sessions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX auth_sessions_user_id_idx ON auth_sessions(user_id);
```

Normalizar correo con `trim` y minúsculas antes de comparar. No asumir que las direcciones con puntos o `+alias` son equivalentes. No guardar contraseñas: este contrato usa acceso passwordless. `code_hash` debe ser hash con secreto del servidor (HMAC) o hash resistente a búsqueda; los códigos cortos son susceptibles a fuerza bruta. Borrar retos expirados/consumidos y sesiones vencidas mediante tarea de mantenimiento.

## Errores y protección

Formato común:

```json
{ "error": { "code": "INVALID_OR_EXPIRED_CODE", "message": "El código no es válido o expiró." } }
```

Códigos sugeridos: `INVALID_OR_EXPIRED_CODE` (400), `RATE_LIMITED` (429), `INVALID_IDENTITY_TOKEN` (401), `SESSION_EXPIRED` (401), `ACCOUNT_DISABLED` (403). No retornar stack traces ni distinguir correos existentes en la solicitud del OTP. Aplicar límites por IP y correo, límites de intentos por reto, auditoría sin tokens/códigos y política CORS para los orígenes web aprobados.

## Variables de entorno del backend

- `DATABASE_URL`
- `ACCESS_TOKEN_SIGNING_KEY` (gestor de secretos; nunca incluir en el cliente)
- `GOOGLE_CLIENT_ID` y configuración de verificación de token
- `FACEBOOK_APP_ID` y configuración de verificación de token
- Configuración de proveedor de correo (host/credenciales remitente)
- `APP_DEEP_LINK_SCHEME=rnlearning57` para documentar el retorno móvil; registrar además los redirect URIs específicos de cada proveedor

No guardar estos valores reales en el repositorio. Proveer `.env.example` solo con placeholders.

## Cambios necesarios en el frontend

1. Configurar `EXPO_PUBLIC_API_URL` por entorno y crear un cliente HTTP que traduzca errores del contrato.
2. Al pulsar «Continuar con correo», llamar a `request-code`; mostrar la pantalla de código con reenvío temporizado; verificar con `challengeId`, correo y código.
3. Conectar Google/Facebook con el flujo OAuth seleccionado y enviar la credencial de identidad al endpoint correspondiente. El botón actual no hace autenticación.
4. Guardar tokens en almacenamiento seguro, llamar a `/auth/refresh` cuando expire la sesión y a `/auth/logout` al cerrar sesión.
5. Añadir un estado de sesión en el layout: mostrar login cuando no hay sesión y las pestañas actuales cuando sí la hay. No proteger datos solo ocultando pantallas; el backend debe autorizar cada recurso.
6. Para sincronizar tareas en la nube, crear tablas de tareas vinculadas a `users.id` y aplicar autorización por `sub` en cada consulta. Hoy las tareas son locales.

## Criterios de aceptación

- Un correo válido solicita código sin revelar si existe una cuenta.
- Código correcto, vigente y no usado crea/inicia sesión y retorna un perfil estable con UUID.
- Código incorrecto, expirado o reutilizado falla de forma segura y respeta el límite de intentos.
- Google y Facebook solo crean/inician sesión tras validar token del proveedor en backend.
- Access token permite `/auth/me`; refresh rota; logout revoca la sesión.
- Ninguna contraseña, código OTP, token de proveedor ni refresh token en claro se persiste en la base de datos o logs.
