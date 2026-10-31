import type { ReactNode } from "react";
import { tokenizeLua } from "../lib/luaTokens";

/** Read-only Lua or Luau, coloured with the .tok-* classes the landing page uses. */
export function LuaCode({ code }: { code: string }) {
  return (
    <>
      {tokenizeLua(code).map((token, index) =>
        token.kind ? (
          <span className={`tok-${token.kind}`} key={index}>
            {token.text}
          </span>
        ) : (
          token.text
        )
      )}
    </>
  );
}

const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Prose where `backticks` mark code, **stars** bold, and [text](/href) a link; outside links open in a new tab. */
export function Inline({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    if (match[1] !== undefined) {
      nodes.push(<code key={match.index}>{match[1]}</code>);
    } else if (match[2] !== undefined) {
      nodes.push(
        <strong key={match.index}>
          <Inline text={match[2]} />
        </strong>
      );
    } else {
      const external = /^https?:/.test(match[4]);
      nodes.push(
        <a key={match.index} href={match[4]} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
          <Inline text={match[3]} />
        </a>
      );
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

/** The words without the markup Inline reads, for meta tags and structured data. */
export function plainText(text: string): string {
  return text.replace(INLINE, (_, code, bold, label) => code ?? bold ?? plainText(label));
}

/** Text as an anchor id: "Is Luau faster?" becomes "is-luau-faster". */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
