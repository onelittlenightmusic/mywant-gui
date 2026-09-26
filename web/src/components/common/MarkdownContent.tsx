import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Markdown renderer for want-card content.
 *
 * Every size here is in `em` so the whole block scales with the inherited
 * font size — inside a card that is CARD_CONTENT_SIZE (see useSystemFontSize),
 * which the System Font setting drives. Nothing may set an absolute px size.
 *
 * Spacing is deliberately tight: the smallest card is 96px tall, so default
 * markdown margins would push everything out of view.
 */

/**
 * Markdown is denser than the plain one-liners the rest of a card shows — it
 * carries headings, lists and code that all need to fit at once — so it renders
 * a step below the card's body size. Everything inside is `em`-relative, so
 * this single class scales the whole block and still follows the System Font
 * setting. Pass `fontScale` to override; do not add a second text-* class,
 * since two arbitrary sizes on one element resolve by stylesheet order.
 */
const DEFAULT_FONT_SCALE = 'text-[0.6em]';

/**
 * Whether a string carries markdown worth parsing.
 *
 * Plain prose must NOT go through the parser: markdown folds single newlines
 * into one paragraph, so a plain multi-line reply would lose its line breaks.
 * Callers that mix agent output of both kinds test this first and fall back to
 * pre-wrapped text.
 */
export function looksLikeMarkdown(text: string): boolean {
  return (
    /```/.test(text) ||                 // fenced code
    /^#{1,6}\s/m.test(text) ||          // heading
    /^\s*[-*+]\s+\S/m.test(text) ||     // bullet list
    /^\s*\d+\.\s+\S/m.test(text) ||    // ordered list
    /^\s*>\s/m.test(text) ||           // blockquote
    /^\s*\|.*\|\s*$/m.test(text) ||     // table row
    /\[[^\]]+\]\([^)]+\)/.test(text) || // link
    /\*\*[^*\n]+\*\*/.test(text)        // bold
  );
}

interface MarkdownContentProps {
  children: string;
  className?: string;
  /** Tailwind text-size class, em-relative. Defaults to DEFAULT_FONT_SCALE. */
  fontScale?: string;
}

const heading = (size: string) =>
  function Heading({ children }: { children?: React.ReactNode }) {
    return <div className={`${size} font-semibold mt-1.5 mb-0.5 first:mt-0`}>{children}</div>;
  };

const components = {
  h1: heading('text-[1.15em]'),
  h2: heading('text-[1.1em]'),
  h3: heading('text-[1.05em]'),
  h4: heading('text-[1em]'),
  h5: heading('text-[1em]'),
  h6: heading('text-[1em]'),

  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-1 first:mt-0 last:mb-0 break-words">{children}</p>
  ),

  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-1 pl-4 list-disc space-y-0.5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-1 pl-4 list-decimal space-y-0.5">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="break-words">{children}</li>
  ),

  // Inline code. Fenced blocks reach here too, but wrapped in <pre>, which
  // resets these styles via the arbitrary-variant selectors below.
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="text-[0.9em] font-mono px-1 py-0.5 rounded bg-gray-200/70 dark:bg-gray-700/70">
      {children}
    </code>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre
      className="my-1 p-2 rounded-md overflow-x-auto bg-gray-200/60 dark:bg-gray-900/60
                 text-[0.9em] leading-snug
                 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-[1em]"
      onWheel={(e) => e.stopPropagation()}
    >
      {children}
    </pre>
  ),

  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-1 pl-2 border-l-2 border-gray-300 dark:border-gray-600 opacity-80">
      {children}
    </blockquote>
  ),

  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline text-blue-600 dark:text-blue-400 break-all"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  ),

  hr: () => <hr className="my-1.5 border-gray-300 dark:border-gray-600" />,

  // GFM tables — scroll inside their own box rather than widening the card.
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-1 overflow-x-auto" onWheel={(e) => e.stopPropagation()}>
      <table className="text-[0.9em] border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-gray-300 dark:border-gray-600 px-1.5 py-0.5 font-semibold text-left">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-gray-300 dark:border-gray-600 px-1.5 py-0.5">{children}</td>
  ),

  img: ({ src, alt }: { src?: string; alt?: string }) => (
    <img src={src} alt={alt} className="max-w-full h-auto rounded my-1" />
  ),
};

export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  children, className, fontScale = DEFAULT_FONT_SCALE,
}) => (
  <div className={className ? `${fontScale} ${className}` : fontScale}>
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </Markdown>
  </div>
);
