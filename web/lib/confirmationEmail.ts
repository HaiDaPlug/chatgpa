// web/lib/confirmationEmail.ts

export function confirmationEmail(siteUrl: string) {
  const subject = "You’re on the Carpool AI waitlist!🚗";

  const text = `You’re in! Thanks for joining the Carpool AI waitlist.
You’ll be among the first to try Carpool AI and receive your founding-rider bonus fuel.

Visit: ${siteUrl}

— Carpool AI
contact@khyteteam.com`;

  // Always use PNG for email (SVG is poorly supported)
  const faviconUrl = `${siteUrl.replace(/\/$/, '')}/favicon.png`;

  const html = `<!DOCTYPE html>
<html>
  <body style="background-color:#000; color:#fff; font-family:Inter,Arial,sans-serif; padding:32px; margin:0;">
    <table width="100%" style="max-width:600px; margin:0 auto;">
      <tr>
        <td style="text-align:center; padding-bottom:24px;">
          <table style="margin:0 auto;">
            <tr>
              <td style="vertical-align:middle; padding-right:8px;">
                <img src="${faviconUrl}" alt="Carpool AI" width="28" height="28" style="display:block;"/>
              </td>
              <td style="vertical-align:middle;">
                <h1 style="font-size:24px; margin:0; color:#fff;">Carpool AI</h1>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="background:#111; border-radius:12px; padding:24px; text-align:center;">
          <h2 style="margin:0; font-size:20px; color:#fff;">You’re in! 🎉</h2>
          <p style="margin:16px 0; font-size:16px; color:#aaa;">
            Thanks for joining the waitlist. You’ll be among the first to try
            <strong style="color:#fff;">Carpool AI</strong> and receive your founding-rider bonus fuel.
          </p>
          <a href="${siteUrl}"
             style="display:inline-block; margin-top:12px; background:#fff; color:#000; text-decoration:none;
                    padding:12px 20px; border-radius:8px; font-weight:600;">
            Visit Carpool AI
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding-top:24px; text-align:center; font-size:12px; color:#666;">
          © ${new Date().getFullYear()} Carpool AI —
          <a href="mailto:contact@khyteteam.com" style="color:#888;">contact@khyteteam.com</a><br/>
          If this isn’t for you, you can safely ignore this email.
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
