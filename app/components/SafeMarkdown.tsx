import type { ReactNode } from "react";

function safeHref(raw: string) {
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
}

function inline(text: string, keyPrefix: string): ReactNode[] {
  const result: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let index = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > index) result.push(text.slice(index, match.index));
    if (match[2]) result.push(<strong key={`${keyPrefix}-${match.index}`}>{match[2]}</strong>);
    else {
      const href = safeHref(match[4]);
      result.push(href ? <a href={href} key={`${keyPrefix}-${match.index}`} rel="noreferrer">{match[3]}</a> : match[3]);
    }
    index = pattern.lastIndex;
  }
  if (index < text.length) result.push(text.slice(index));
  return result;
}

export function SafeMarkdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }
    if (line.startsWith("### ")) nodes.push(<h3 key={index}>{inline(line.slice(4), `h3-${index}`)}</h3>);
    else if (line.startsWith("## ")) nodes.push(<h2 key={index}>{inline(line.slice(3), `h2-${index}`)}</h2>);
    else if (/^-\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (index < lines.length && /^-\s+/.test(lines[index].trim())) {
        const value = lines[index].trim().replace(/^-\s+/, "");
        items.push(<li key={index}>{inline(value, `li-${index}`)}</li>);
        index += 1;
      }
      nodes.push(<ul key={`ul-${index}`}>{items}</ul>);
      continue;
    } else {
      const paragraph = [line];
      while (index + 1 < lines.length && lines[index + 1].trim() && !/^(## |### |-\s+)/.test(lines[index + 1].trim())) {
        paragraph.push(lines[index + 1].trim());
        index += 1;
      }
      nodes.push(<p key={index}>{inline(paragraph.join(" "), `p-${index}`)}</p>);
    }
    index += 1;
  }
  return <div className="safe-markdown">{nodes}</div>;
}
