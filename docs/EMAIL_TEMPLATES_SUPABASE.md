# Configuración de correos de autenticación (Supabase)

Los correos de **confirmación de email** y **recuperación de contraseña** se gestionan desde el **Dashboard de Supabase** → Authentication → Email Templates.

**Importante:** Cambiar solo el código de la aplicación **no** actualiza estos correos. La plantilla debe pegarse **manualmente** en el Dashboard (Authentication → Email Templates → Confirm signup). Si no actualizas la plantilla ahí, los usuarios seguirán recibiendo el texto por defecto de Supabase.

## Regla de negocio

- **Confirmar email** solo demuestra que el correo pertenece al usuario.
- **Activación de la plataforma** (`profiles.is_active`) es independiente: la determina un administrador.
- Confirmar el email **no** concede acceso a la aplicación privada hasta que un administrador active la cuenta.

---

## Plantilla: Confirm signup (Confirmar registro)

Plantilla final, lista para copiar y pegar. Debe configurarse **solo** en Supabase Dashboard; el código de la app no modifica este correo.

### Dónde configurar (obligatorio, manual)

1. **Supabase Dashboard** → tu proyecto.
2. **Authentication** → **Email Templates**.
3. Selecciona **Confirm signup**.
4. Pega el **Subject** y el **Message (HTML)** siguientes.
5. Guarda los cambios.

---

### 1. Subject (asunto) — listo para pegar

```
Confirma tu correo — SAP Notes Hub
```

---

### 2. Message — HTML (cuerpo del correo)

Copia y pega este HTML en el campo **Message** de la plantilla. Incluye branding, CTA y línea de soporte.

```html
<div style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px 24px; color: #334155; background: #ffffff;">
  <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
    <strong style="font-size: 20px; color: #0f172a; letter-spacing: -0.02em;">SAP Notes Hub</strong>
  </div>
  <h1 style="font-size: 22px; font-weight: 600; color: #0f172a; margin: 0 0 16px 0; line-height: 1.3;">
    Confirma tu correo electrónico
  </h1>
  <p style="font-size: 15px; line-height: 1.65; margin: 0 0 16px 0; color: #475569;">
    Has solicitado crear una cuenta en SAP Notes Hub. Para continuar, confirma tu correo haciendo clic en el botón siguiente.
  </p>
  <div style="font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; padding: 16px; background: #f1f5f9; border-radius: 10px; border-left: 4px solid #6366f1;">
    <strong style="color: #1e293b;">Importante:</strong> Confirmar el correo <strong>no</strong> te da acceso a la plataforma. Tu cuenta quedará <strong>pendiente de aprobación</strong> por un administrador. Cuando un administrador active tu cuenta, recibirás un segundo correo y entonces podrás iniciar sesión.
  </div>
  <p style="margin: 28px 0;">
    <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 14px 28px; background: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 10px;">Confirmar correo</a>
  </p>
  <p style="font-size: 13px; color: #64748b; margin: 24px 0 0 0;">
    Si no has solicitado esta cuenta, puedes ignorar este mensaje.
  </p>
  <p style="font-size: 12px; color: #94a3b8; margin: 32px 0 0 0; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    SAP Notes Hub — Uso interno. Si tienes dudas, contacta al administrador de la plataforma.
  </p>
</div>
```

**Nota:** Supabase sustituye `{{ .ConfirmationURL }}` por el enlace real. No cambies el nombre de la variable.

---

### 3. Versión solo texto (opcional)

Para clientes de correo que no muestran HTML correctamente:

```
SAP Notes Hub — Confirma tu correo

Has solicitado crear una cuenta en SAP Notes Hub.

1. Confirma tu correo haciendo clic en el enlace siguiente.
2. Después de confirmar, tu cuenta quedará pendiente de aprobación por un administrador.
3. Recibirás otro correo cuando un administrador active tu cuenta y puedas acceder a la plataforma.

Confirmar el correo no significa acceso concedido: el acceso lo habilita un administrador.

Enlace para confirmar: {{ .ConfirmationURL }}

Si no has solicitado esta cuenta, ignora este mensaje.

—
SAP Notes Hub. Si tienes dudas, contacta al administrador de la plataforma.
```

---

### Variables disponibles (Supabase)

| Variable | Uso |
|----------|-----|
| `{{ .ConfirmationURL }}` | Enlace de confirmación (obligatorio en el cuerpo) |
| `{{ .Email }}` | Correo del usuario |
| `{{ .Token }}` | Token (no mostrar en el cuerpo) |
| `{{ .TokenHash }}` | Hash del token |
| `{{ .SiteURL }}` | URL del sitio configurada en el proyecto |

---

### Puntos importantes

- No uses frases del tipo "Tu cuenta ya está lista" o "Ya puedes acceder" en este correo.
- Deja claro que tras confirmar el correo la cuenta sigue **pendiente de aprobación**.
- Indica que recibirán **otro correo** cuando un administrador active la cuenta (ese correo se envía desde la app con `sendActivationNotification` cuando el superadmin activa al usuario).

---

## Otros correos

- **Magic Link / Invite**: si usas invitaciones, adapta el texto para que no sugiera que el acceso está concedido hasta la activación, si aplica.
- **Reset password**: puede mantenerse genérico; no afecta a la lógica de activación.
