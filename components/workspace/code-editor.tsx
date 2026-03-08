"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const KEYWORD_PATTERN = /\b(const|let|var|function|return|if|else|for|while|switch|case|break|continue|class|interface|type|export|import|from|async|await|try|catch|throw|extends|implements|new|default)\b/g;
const STRING_PATTERN = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
const COMMENT_PATTERN = /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm;
const NUMBER_PATTERN = /\b\d+(?:\.\d+)?\b/g;
const TAG_PATTERN = /(<\/?[a-zA-Z][^>]*>)/g;
const JSON_KEY_PATTERN = /("[^"]+")(?=\s*:)/g;
const MD_HEADING_PATTERN = /^(#{1,6}\s.*)$/gm;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlight(value: string, language: string) {
  let html = escapeHtml(value);

  if (["typescript", "javascript", "tsx", "ts", "js", "jsx"].includes(language)) {
    html = html.replace(COMMENT_PATTERN, '<span class="text-zinc-500">$1</span>');
    html = html.replace(STRING_PATTERN, '<span class="text-emerald-300">$1</span>');
    html = html.replace(KEYWORD_PATTERN, '<span class="text-sky-300">$1</span>');
    html = html.replace(NUMBER_PATTERN, '<span class="text-amber-300">$1</span>');
    return html;
  }

  if (language === "json") {
    html = html.replace(JSON_KEY_PATTERN, '<span class="text-sky-300">$1</span>');
    html = html.replace(STRING_PATTERN, '<span class="text-emerald-300">$1</span>');
    html = html.replace(NUMBER_PATTERN, '<span class="text-amber-300">$1</span>');
    return html;
  }

  if (language === "html") {
    return html.replace(TAG_PATTERN, '<span class="text-fuchsia-300">$1</span>');
  }

  if (language === "markdown") {
    return html
      .replace(MD_HEADING_PATTERN, '<span class="text-sky-300">$1</span>')
      .replace(STRING_PATTERN, '<span class="text-emerald-300">$1</span>');
  }

  return html;
}

export function CodeEditor({
  value,
  onChange,
  language,
  fontSize,
  className,
}: {
  value: string;
  onChange: (nextValue: string) => void;
  language: string;
  fontSize: number;
  className?: string;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const preRef = React.useRef<HTMLPreElement>(null);
  const gutterRef = React.useRef<HTMLDivElement>(null);
  const lineCount = Math.max(1, value.split("\n").length);
  const lines = React.useMemo(
    () => Array.from({ length: lineCount }, (_, index) => index + 1),
    [lineCount],
  );
  const highlighted = React.useMemo(
    () => highlight(value || " ", language),
    [language, value],
  );

  const syncScroll = React.useCallback(() => {
    const top = textareaRef.current?.scrollTop ?? 0;
    const left = textareaRef.current?.scrollLeft ?? 0;

    if (preRef.current) {
      preRef.current.scrollTop = top;
      preRef.current.scrollLeft = left;
    }

    if (gutterRef.current) {
      gutterRef.current.scrollTop = top;
    }
  }, []);

  return (
    <div className={cn("relative flex h-full min-h-0 overflow-hidden", className)}>
      <div
        ref={gutterRef}
        className="w-12 shrink-0 overflow-hidden border-r border-zinc-800 bg-zinc-950/80 px-2 py-4 text-right font-mono text-[11px] leading-6 text-zinc-600"
        style={{ fontSize }}
      >
        {lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
      <div className="relative flex-1 overflow-hidden bg-[#0a0a0c]">
        <pre
          ref={preRef}
          className="pointer-events-none h-full overflow-auto p-4 font-mono leading-6 text-zinc-300"
          style={{ fontSize }}
          dangerouslySetInnerHTML={{ __html: highlighted + "\n" }}
        />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={syncScroll}
          spellCheck={false}
          className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent p-4 font-mono leading-6 text-transparent caret-zinc-100 outline-none"
          style={{ fontSize }}
        />
      </div>
    </div>
  );
}
