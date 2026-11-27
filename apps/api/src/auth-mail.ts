type MailBindings = { AUTH_EMAIL_API_KEY?: string; AUTH_EMAIL_FROM?: string };

export function authMailConfigured(env: MailBindings) {
  return Boolean(env.AUTH_EMAIL_API_KEY && env.AUTH_EMAIL_FROM);
}

export async function sendAuthMail(env: MailBindings, to: string, subject: string, link: URL) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${env.AUTH_EMAIL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.AUTH_EMAIL_FROM,
      to: [to],
      subject,
      text: `${subject}\n\n${link.href}\n\nIgnore this message if you did not request it.`,
    }),
  });
  if (!response.ok) throw new Error("Authentication email delivery failed");
}
