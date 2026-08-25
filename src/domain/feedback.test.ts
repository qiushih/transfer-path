import { describe, expect, it } from "vitest";
import { MESSAGE_MAX, MESSAGE_MIN, formatFeedbackEmail, validateFeedback } from "./feedback";

const AT = new Date("2026-08-22T12:00:00.000Z");

describe("validating a submission", () => {
  it("accepts an ordinary suggestion", () => {
    const result = validateFeedback({ message: "The CO average looks wrong to me." });
    expect(result.ok).toBe(true);
  });

  it("trims surrounding whitespace before judging the length", () => {
    const result = validateFeedback({ message: `   ${"a".repeat(MESSAGE_MIN)}   ` });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.message).toHaveLength(MESSAGE_MIN);
  });

  it("rejects a message that is too short to act on", () => {
    const result = validateFeedback({ message: "bad" });
    expect(result.ok).toBe(false);
  });

  it("rejects a message past the length cap", () => {
    const result = validateFeedback({ message: "a".repeat(MESSAGE_MAX + 1) });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-string message rather than coercing it", () => {
    expect(validateFeedback({ message: { evil: true } }).ok).toBe(false);
    expect(validateFeedback({}).ok).toBe(false);
  });

  it("treats a blank contact as anonymous rather than invalid", () => {
    const result = validateFeedback({ message: "A perfectly fine suggestion.", contact: "  " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.contact).toBeNull();
  });

  it("rejects a contact that is not an email address", () => {
    const result = validateFeedback({ message: "A perfectly fine suggestion.", contact: "not-an-email" });
    expect(result.ok).toBe(false);
  });
});

describe("the honeypot", () => {
  it("rejects a submission that filled the hidden field", () => {
    const result = validateFeedback({ message: "A perfectly fine suggestion.", honeypot: "spam" });
    expect(result.ok).toBe(false);
  });

  it("marks it silent so the response cannot tell a bot what gave it away", () => {
    const result = validateFeedback({ message: "A perfectly fine suggestion.", honeypot: "spam" });
    expect(result.ok === false && result.silent).toBe(true);
  });

  it("does not treat an empty honeypot as suspicious", () => {
    expect(validateFeedback({ message: "A perfectly fine suggestion.", honeypot: "" }).ok).toBe(true);
  });
});

describe("the profile is attached only on request", () => {
  it("attaches nothing when the field is absent", () => {
    const result = validateFeedback({ message: "A perfectly fine suggestion." });
    expect(result.ok && result.value.profile).toBeNull();
  });

  it("attaches the profile when one is supplied", () => {
    const result = validateFeedback({
      message: "My CS check looks wrong.",
      profile: { currentProgram: "SCI-BIO", attempts: [] },
    });
    expect(result.ok && result.value.profile).toContain("SCI-BIO");
  });

  it("truncates an oversized profile instead of failing the send", () => {
    const attempts = Array.from({ length: 5000 }, (_, i) => ({ course: `C${i}` }));
    const result = validateFeedback({ message: "A perfectly fine suggestion.", profile: { attempts } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.profile!.length).toBeLessThan(20100);
      expect(result.value.profile).toContain("truncated");
    }
  });
});

describe("formatting the email", () => {
  const valid = { message: "The CO average looks wrong.\nSecond line.", contact: "s@example.com", profile: null };

  it("uses the first line as the subject so the inbox is scannable", () => {
    expect(formatFeedbackEmail(valid, AT).subject).toContain("The CO average looks wrong.");
    expect(formatFeedbackEmail(valid, AT).subject).not.toContain("Second line");
  });

  it("sets reply-to only when a contact was given", () => {
    expect(formatFeedbackEmail(valid, AT).replyTo).toBe("s@example.com");
    expect(formatFeedbackEmail({ ...valid, contact: null }, AT).replyTo).toBeNull();
  });

  it("states plainly when no profile was attached", () => {
    expect(formatFeedbackEmail(valid, AT).text).toContain("Profile: not attached");
  });

  it("marks an attached profile as sent at the student's request", () => {
    const text = formatFeedbackEmail({ ...valid, profile: '{"a":1}' }, AT).text;
    expect(text).toContain("at the sender's request");
    expect(text).toContain('{"a":1}');
  });

  it("keeps the message itself first, ahead of the metadata", () => {
    expect(formatFeedbackEmail(valid, AT).text.startsWith("The CO average looks wrong.")).toBe(true);
  });
});
