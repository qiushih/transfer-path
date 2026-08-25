import { Section } from "./ui";

/**
 * A contact address rather than a form.
 *
 * A form would need a server to hold an API key, which would end the app's
 * "no backend, nothing leaves your browser" property for the sake of one
 * message. A plain `mailto:` link costs nothing, needs no JavaScript, and lets
 * the student keep a copy of what they sent.
 */

const CONTACT_EMAIL = "linjason0502.2003@gmail.com";
const SUBJECT = "Waterloo Path Feedback";

/**
 * Built with `encodeURIComponent` rather than a hand-written `%20` so the
 * subject cannot drift out of encoding if it is ever reworded.
 */
const MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(SUBJECT)}`;

export function ContactBox() {
  return (
    <Section title="Have an idea?" subtitle="Tell us what you'd like to see.">
      <p className="text-sm opacity-80">
        Spotted a requirement that looks wrong, a program that is missing, or something confusing?
        Get in touch.
      </p>

      <a
        className="mt-3 inline-block rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        href={MAILTO}
      >
        {CONTACT_EMAIL}
      </a>

      <p className="mt-2 text-xs opacity-60">
        If a requirement looks wrong for your record, saying which program and which line helps most.
      </p>
    </Section>
  );
}
