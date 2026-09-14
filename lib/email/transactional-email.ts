import { runtimeEnv } from "@/lib/runtime-env";

export interface TransactionalEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}

export interface EmailDeliveryResult {
  configured: boolean;
  delivered: boolean;
}

interface TransactionalEmailProvider {
  send(message: TransactionalEmail): Promise<EmailDeliveryResult>;
}

class UnconfiguredEmailProvider implements TransactionalEmailProvider {
  async send() {
    return { configured: false, delivered: false };
  }
}

class ResendEmailProvider implements TransactionalEmailProvider {
  constructor(private readonly apiKey: string, private readonly from: string) {}

  async send(message: TransactionalEmail) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        "idempotency-key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) throw new Error("EMAIL_PROVIDER_REJECTED_REQUEST");
    return { configured: true, delivered: true };
  }
}

export function getTransactionalEmailProvider(): TransactionalEmailProvider {
  const provider = runtimeEnv("EMAIL_PROVIDER")?.trim().toLowerCase();
  const apiKey = runtimeEnv("RESEND_API_KEY")?.trim();
  const from = runtimeEnv("EMAIL_FROM")?.trim();
  return provider === "resend" && apiKey && from
    ? new ResendEmailProvider(apiKey, from)
    : new UnconfiguredEmailProvider();
}

