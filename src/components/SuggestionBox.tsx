"use client";

import { useState } from "react";
import { MESSAGE_MAX, MESSAGE_MIN } from "@/domain/feedback";
import type { AcademicProfile } from "@/domain/types";
import { Section, inputClass } from "./ui";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

/**
 * Lets a student send a suggestion without leaving the page.
 *
 * The profile checkbox defaults to off and says exactly what it attaches.
 * Everywhere else this app keeps the transcript in the browser, and quietly
 * bundling "helpful diagnostics" into a feedback email would break that
 * promise at the one moment the student is trusting the tool most.
 */
export function SuggestionBox({ profile }: { profile: AcademicProfile }) {
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [includeProfile, setIncludeProfile] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const tooShort = message.trim().length > 0 && message.trim().length < MESSAGE_MIN;
  const canSend = message.trim().length >= MESSAGE_MIN && status.kind !== "sending";

  async function send() {
    setStatus({ kind: "sending" });
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          contact,
          honeypot,
          profile: includeProfile ? profile : undefined,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setStatus({ kind: "error", message: data.error ?? "Something went wrong." });
        return;
      }

      setStatus({ kind: "sent" });
      setMessage("");
      setContact("");
      setIncludeProfile(false);
    } catch {
      setStatus({ kind: "error", message: "Could not reach the server. Check your connection." });
    }
  }

  if (status.kind === "sent") {
    return (
      <Section title="Suggestions" subtitle="Thanks — your message was sent.">
        <button
          className="rounded border border-black/20 px-3 py-1 text-sm dark:border-white/25"
          onClick={() => setStatus({ kind: "idle" })}
        >
          Send another
        </button>
      </Section>
    );
  }

  return (
    <Section
      title="Suggestions"
      subtitle="Found a requirement that looks wrong, or something that would make this more useful? Tell me."
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium opacity-80">Your suggestion</span>
        <textarea
          className={`${inputClass} h-28`}
          placeholder="A rule that does not match what my advisor told me, a program that is missing, anything confusing…"
          maxLength={MESSAGE_MAX}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <span className="text-xs opacity-60">
          {message.trim().length}/{MESSAGE_MAX}
          {tooShort && ` · at least ${MESSAGE_MIN} characters`}
        </span>
      </label>

      <label className="mt-3 flex flex-col gap-1 text-sm">
        <span className="font-medium opacity-80">Email (optional)</span>
        <input
          className={inputClass}
          type="email"
          placeholder="So I can reply. Leave blank to stay anonymous."
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
      </label>

      <label className="mt-3 flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={includeProfile}
          onChange={(e) => setIncludeProfile(e.target.checked)}
        />
        <span>
          Attach my courses and grades to this message. Off by default — your transcript otherwise
          never leaves this browser. Turn it on only if your suggestion is about a result that looks
          wrong for your specific record.
        </span>
      </label>

      {/* Not display:none — some bots skip hidden fields but fill offscreen ones. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-40"
          disabled={!canSend}
          onClick={send}
        >
          {status.kind === "sending" ? "Sending…" : "Send suggestion"}
        </button>
        {status.kind === "error" && (
          <span className="text-xs text-red-700 dark:text-red-300">{status.message}</span>
        )}
      </div>
    </Section>
  );
}
