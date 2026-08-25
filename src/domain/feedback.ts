/**
 * Validation and formatting for suggestion-box submissions.
 *
 * Kept in the domain layer, away from the route handler, for the same reason
 * the eligibility rules are: it is pure, so it can be tested without a server,
 * and the route handler stays a thin shell around it.
 *
 * The privacy rule this file enforces: **a submission carries the student's
 * academic profile only when they explicitly ask it to.** Everything else in
 * this app keeps the transcript in the browser, and a feedback form is exactly
 * the kind of feature that quietly breaks that promise by attaching "helpful
 * diagnostics" nobody asked for.
 */

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 4000;
export const CONTACT_MAX = 200;

export type FeedbackInput = {
  message?: unknown;
  /** Optional, so the student can be replied to. */
  contact?: unknown;
  /** Opt-in only. The raw profile the app stores locally. */
  profile?: unknown;
  /** Hidden field no human fills in; a value means a bot. */
  honeypot?: unknown;
};

export type ValidFeedback = {
  message: string;
  contact: string | null;
  profile: string | null;
};

export type ValidationResult =
  | { ok: true; value: ValidFeedback }
  /** `silent` marks a bot: accept the request, send nothing, reveal nothing. */
  | { ok: false; error: string; silent?: boolean };

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateFeedback(input: FeedbackInput): ValidationResult {
  // A filled honeypot is a bot. Returning an error would tell it which field
  // gave it away, so the caller responds with success and drops the message.
  if (asString(input.honeypot).length > 0) {
    return { ok: false, error: "ignored", silent: true };
  }

  const message = asString(input.message);
  if (message.length < MESSAGE_MIN) {
    return { ok: false, error: `Please write at least ${MESSAGE_MIN} characters.` };
  }
  if (message.length > MESSAGE_MAX) {
    return { ok: false, error: `Please keep it under ${MESSAGE_MAX} characters.` };
  }

  const contact = asString(input.contact);
  if (contact.length > CONTACT_MAX) {
    return { ok: false, error: "That contact address is too long." };
  }
  // Deliberately loose: this is a reply-to hint, not an identity claim, and
  // rejecting unusual but valid addresses would lose real feedback.
  if (contact.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
    return { ok: false, error: "That does not look like an email address." };
  }

  let profile: string | null = null;
  if (input.profile !== undefined && input.profile !== null) {
    try {
      const serialised = JSON.stringify(input.profile, null, 2);
      // A pasted transcript can be large; a truncated profile is still useful
      // for diagnosis and keeps the email from being rejected for size.
      profile = serialised.length > 20000 ? `${serialised.slice(0, 20000)}\n… truncated` : serialised;
    } catch {
      profile = null;
    }
  }

  return { ok: true, value: { message, contact: contact || null, profile } };
}

export type FeedbackEmail = { subject: string; text: string; replyTo: string | null };

export function formatFeedbackEmail(feedback: ValidFeedback, receivedAt: Date): FeedbackEmail {
  const firstLine = feedback.message.split("\n")[0].slice(0, 60);

  const parts = [
    feedback.message,
    "",
    "—",
    `Received: ${receivedAt.toISOString()}`,
    `Contact: ${feedback.contact ?? "not provided"}`,
  ];

  if (feedback.profile) {
    parts.push("", "Profile (attached at the sender's request):", feedback.profile);
  } else {
    parts.push("Profile: not attached");
  }

  return {
    subject: `Transfer planner feedback: ${firstLine}`,
    text: parts.join("\n"),
    replyTo: feedback.contact,
  };
}
