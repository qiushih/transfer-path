import { formatFeedbackEmail, validateFeedback } from "@/domain/feedback";

/**
 * Receives suggestion-box submissions and forwards them by email via Resend.
 *
 * This is the only server-side code in the app, and it exists because the
 * Resend API key cannot go in the browser: anything shipped to a client is
 * readable by anyone who opens devtools, and a leaked key lets a stranger send
 * mail as this domain. The key is read from the environment here and never
 * leaves the server.
 *
 * The recipient is an environment variable too, so the address is not sitting
 * in a public repository waiting to be scraped, and can be changed without a
 * code change.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** POST is never cached by Next, so no route config is needed to keep it live. */
export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_TO_EMAIL;
  // Resend only accepts a `from` on a domain you have verified. A new account
  // can use onboarding@resend.dev, which delivers only to your own address.
  const from = process.env.FEEDBACK_FROM_EMAIL ?? "onboarding@resend.dev";

  if (!apiKey || !to) {
    // Missing configuration is an operator problem, not the student's, so it
    // is reported distinctly from a rejected message.
    return Response.json(
      { error: "Feedback is not configured on this deployment." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const result = validateFeedback((body ?? {}) as Record<string, unknown>);

  if (!result.ok) {
    // A bot gets the same response a person does, so probing tells it nothing.
    if (result.silent) return Response.json({ ok: true });
    return Response.json({ error: result.error }, { status: 400 });
  }

  const email = formatFeedbackEmail(result.value, new Date());

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: email.subject,
        text: email.text,
        // Lets you reply straight to the student when they left an address.
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
    });

    if (!response.ok) {
      // Resend's message can name the real problem — an unverified domain, a
      // bad key — so it is logged for the operator but never returned to the
      // browser, where it would leak configuration details.
      console.error("Resend rejected the message:", response.status, await response.text());
      return Response.json({ error: "Could not send your message. Try again later." }, { status: 502 });
    }
  } catch (error) {
    console.error("Failed to reach Resend:", error);
    return Response.json({ error: "Could not send your message. Try again later." }, { status: 502 });
  }

  return Response.json({ ok: true });
}
