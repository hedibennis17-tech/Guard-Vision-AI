/**
 * emailSender — Phase 7
 * Envoi d'emails via SendGrid (ou Nodemailer en dev).
 *
 * Variable d'environnement requise : SENDGRID_API_KEY
 * (à ajouter dans Firebase Functions config ou Secret Manager)
 */

import { defineSecret } from "firebase-functions/params";

const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");

interface EmailOptions {
  to:       string;
  subject:  string;
  orgId:    string;
  eventId?: string;
  title:    string;
  body:     string;
  severity: string;
}

export async function sendEmail(opts: EmailOptions): Promise<void> {
  const apiKey = SENDGRID_API_KEY.value();
  if (!apiKey) {
    console.warn("[emailSender] SENDGRID_API_KEY non configuré — email non envoyé.");
    return;
  }

  const html = buildEmailTemplate(opts);

  const payload = {
    personalizations: [{ to: [{ email: opts.to }] }],
    from:    { email: "noreply@visionguard.ai", name: "Vision Guard" },
    subject: opts.subject,
    content: [{ type: "text/html", value: html }],
  };

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`SendGrid error ${response.status}: ${err}`);
  }

  console.log(JSON.stringify({
    module: "emailSender",
    action: "sent",
    to: opts.to,
    subject: opts.subject,
    severity: opts.severity,
  }));
}

function buildEmailTemplate(opts: EmailOptions): string {
  const SEVERITY_COLORS: Record<string, string> = {
    critical: "#EF4444",
    warning:  "#F59E0B",
    info:     "#64748B",
  };
  const color = SEVERITY_COLORS[opts.severity] ?? "#0EA5E9";

  return /* html */ `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#0F172A;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1E293B;border-radius:16px;overflow:hidden;max-width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:${color};padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="color:white;font-size:18px;font-weight:700;">Vision Guard</span>
                    <span style="color:rgba(255,255,255,0.6);font-size:13px;margin-left:8px;">AI Platform</span>
                  </td>
                  <td align="right">
                    <span style="background:rgba(255,255,255,0.2);color:white;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;">
                      ${opts.severity}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="color:#F1F5F9;font-size:20px;font-weight:600;margin:0 0 8px;">${opts.title}</h1>
              <p style="color:#94A3B8;font-size:14px;line-height:1.6;margin:0 0 24px;">${opts.body}</p>

              <a href="https://app.visionguard.ai/events${opts.eventId ? `?event=${opts.eventId}` : ""}"
                 style="display:inline-block;background:#0EA5E9;color:white;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;">
                Voir l'événement →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #334155;padding:20px 32px;">
              <p style="color:#475569;font-size:12px;margin:0;">
                Reçu car vous avez activé les notifications email pour cette organisation.
                <a href="https://app.visionguard.ai/settings/notifications" style="color:#0EA5E9;text-decoration:none;">Gérer les préférences</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
