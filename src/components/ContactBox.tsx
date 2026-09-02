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
 * The browsable URL, not the `git@github.com:...` SSH form - that one is a
 * clone address and does nothing when a browser follows it.
 */
const REPO_URL = "https://github.com/qiushih/transfer-path";

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

      <div className="mt-4 border-t border-black/10 pt-3 dark:border-white/15">
        <p className="text-sm">
          <span aria-hidden>&#11088;</span>{" "}
          <a
            className="font-medium underline"
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Star this project on GitHub
          </a>
        </p>
        <p className="mt-1 text-xs opacity-70">
          It is open source, so you can check exactly how every requirement is evaluated and where
          each one was transcribed from. A star helps other Waterloo students find it.
        </p>
      </div>
    </Section>
  );
}
