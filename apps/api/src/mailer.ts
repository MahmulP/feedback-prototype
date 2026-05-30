import type { ApiEnv } from "./env.js";
import type { Logger } from "./logger.js";

/**
 * Thin email-sending abstraction.
 *
 * The API never depends on a concrete SMTP client at the route layer; routes
 * (via the notifier) talk to this interface. v1 ships an SMTP driver built on
 * `nodemailer` plus a no-op driver used whenever SMTP is not configured, so
 * the app boots and runs fine without any mail setup.
 */

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  /** True when this mailer will actually deliver mail. */
  readonly enabled: boolean;
  send(input: SendMailInput): Promise<void>;
}

/** Discards everything. Used when SMTP is not configured. */
export class NoopMailer implements Mailer {
  readonly enabled = false;
  async send(): Promise<void> {
    /* intentionally does nothing */
  }
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

/**
 * SMTP mailer backed by nodemailer. The transport is created lazily on first
 * send so importing this module has no side effects and nodemailer is only
 * pulled in when mail is actually configured.
 */
export class SmtpMailer implements Mailer {
  readonly enabled = true;
  private config: SmtpConfig;
  private logger: Logger;
  // nodemailer Transporter — typed loosely to avoid a hard type dependency.
  private transporter: { sendMail: (opts: Record<string, unknown>) => Promise<unknown> } | null =
    null;
  private transporterPromise: Promise<void> | null = null;

  constructor(config: SmtpConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  private async ensureTransporter(): Promise<void> {
    if (this.transporter) return;
    if (this.transporterPromise) return this.transporterPromise;
    this.transporterPromise = (async () => {
      const nodemailer = await import("nodemailer");
      const createTransport = nodemailer.createTransport ?? nodemailer.default?.createTransport;
      if (typeof createTransport !== "function") {
        throw new Error("nodemailer.createTransport is unavailable");
      }
      this.transporter = createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        ...(this.config.user
          ? { auth: { user: this.config.user, pass: this.config.pass } }
          : {}),
      });
    })();
    return this.transporterPromise;
  }

  async send(input: SendMailInput): Promise<void> {
    await this.ensureTransporter();
    if (!this.transporter) throw new Error("smtp transporter not initialized");
    await this.transporter.sendMail({
      from: this.config.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    });
  }
}

/**
 * Build a mailer from env. Returns a NoopMailer (with `enabled === false`)
 * unless both SMTP_HOST and SMTP_FROM are configured.
 */
export function createMailer(env: ApiEnv, logger: Logger): Mailer {
  if (!env.SMTP_HOST || !env.SMTP_FROM) {
    logger.info("email disabled (SMTP_HOST / SMTP_FROM not set)");
    return new NoopMailer();
  }
  logger.info("email enabled", { host: env.SMTP_HOST, port: env.SMTP_PORT });
  return new SmtpMailer(
    {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      ...(env.SMTP_USER ? { user: env.SMTP_USER } : {}),
      ...(env.SMTP_PASS ? { pass: env.SMTP_PASS } : {}),
      from: env.SMTP_FROM,
    },
    logger
  );
}
