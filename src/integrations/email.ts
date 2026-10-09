import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

/** Strategy interface: SMTP in real life, console in development/tests. */
export interface EmailProvider {
  readonly name: string;
  send(msg: EmailMessage): Promise<{ id: string }>;
}

class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  private transporter: Transporter;
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
    });
  }
  async send(msg: EmailMessage) {
    const info = await this.transporter.sendMail({ from: env.smtp.from, ...msg });
    return { id: info.messageId };
  }
}

class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  async send(msg: EmailMessage) {
    // Subject only - the body contains personal data and must not be logged.
    logger.info("email_console_provider", { subject: msg.subject, recipients: [msg.to].flat().length });
    return { id: `console-${Date.now()}` };
  }
}

let provider: EmailProvider | null = null;

/** Factory + lazy singleton. */
export function getEmailProvider(): EmailProvider {
  provider ??= env.smtp.host ? new SmtpEmailProvider() : new ConsoleEmailProvider();
  return provider;
}

/** Test hook. */
export function setEmailProvider(p: EmailProvider | null) {
  provider = p;
}
