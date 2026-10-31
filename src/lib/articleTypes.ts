import type { RuntimeFlavor } from "./types";

/** The runtimes a page shows output for. */
export type ShownFlavor = "lua51" | "lua54" | "luau";

export interface CodeBlock {
  code: string;
  /** The runtime the playground opens it on. */
  flavor: RuntimeFlavor;
  /**
   * What each runtime prints, as the page shows it. Pinned by
   * articles.execution.test.ts, which runs every block. Empty for code whose
   * output differs per run, such as a benchmark.
   */
  outputs: Partial<Record<ShownFlavor, string>>;
  /** A second runtime for Run it here when `outputs` is empty. */
  compare?: RuntimeFlavor;
}

/** A value in a walkthrough: arrays and objects draw as tables, `null` as nil. */
export type TraceValue = string | number | boolean | null | TraceValue[] | { [key: string]: TraceValue } | { raw: string };

export interface TraceStep {
  /** The 1-based line that just ran. */
  line: number;
  /** What happened, in a sentence or two. `backticks` mark code. */
  say: string;
  /** Variables written in the innermost running frame, or in the newest frame named `frame`. */
  set?: Record<string, TraceValue>;
  frame?: string;
  /** Variables that went out of scope, such as a loop's counter after the loop. */
  drop?: string[];
  /** One line of output. Pinned against a real run, so a step per printed line. */
  print?: string;
  /** Starts a function call: a new frame with this name. */
  enter?: string;
  /** Ends the innermost frame. "kept" leaves it on screen, for a closure holding on to it. */
  leave?: true | "kept";
}

/** A program animated line by line. See TraceStage in components/Learn.tsx. */
export interface Trace {
  title: string;
  code: string;
  steps: TraceStep[];
  /** The outer frame's label; "Variables" unless the walkthrough tracks something else, such as types. */
  scope?: string;
}

export interface Quiz {
  question: string;
  /** Run by the test, whose output must equal the right option (tabs as spaces). */
  code?: string;
  options: string[];
  /** Index of the right option. */
  answer: number;
  why: string;
}

/** Tables a key lookup walks through, each one's __index pointing at the next. */
export interface Lookup {
  chain: Array<{ name: string; keys: Record<string, string> }>;
  /** The keys offered to try; one should be missing everywhere. */
  tries: string[];
}

export interface ArticleTable {
  head: string[];
  /** Cells allow `backticks` and links; exactly "Yes" or "No" draws a mark. */
  rows: string[][];
}

/** One section of a page. Everything but `heading` is optional and renders in this order. */
export interface ArticleBlock {
  heading?: string;
  /** Prose paragraphs, where `backticks` mark inline code and [text](/href) a link. */
  text?: string[];
  list?: string[];
  table?: ArticleTable;
  trace?: Trace;
  lookup?: Lookup;
  code?: CodeBlock;
  /** A live editor on the page, opened on a built-in example and run once it loads. */
  embed?: { example: string; compare?: RuntimeFlavor; title: string };
  quiz?: Quiz;
  /** A highlighted aside: a pitfall or a tip. */
  note?: string;
}

export interface Exercise {
  /** What the learner starts from; the checks are appended. */
  starter: string;
  /** The starter with the gap filled in, shown on request and pinned by a test. */
  solution: string;
  /** Labels and Luau function bodies that return true when the answer is right. */
  checks: Array<[label: string, body: string]>;
}

export interface ArticlePage {
  slug: string;
  /** The page's <h1>. */
  title: string;
  /** The <title> tag. */
  metaTitle: string;
  description: string;
  /** The question answered in a few sentences, first thing on the page, so it can be quoted whole. */
  answer: string;
  blocks: ArticleBlock[];
  /** Lessons: rough reading and doing time. */
  minutes?: number;
  /** Lessons: what the learner will be able to do. */
  outcomes?: string[];
  exercise?: Exercise;
  /** A closing summary. */
  recap?: string[];
  faq?: Array<[question: string, answer: string]>;
  sources?: Array<[label: string, url: string]>;
  related?: Array<[label: string, href: string]>;
}

export interface ArticleHub {
  title: string;
  metaTitle: string;
  description: string;
  intro: string[];
  pages: ArticlePage[];
  blocks?: ArticleBlock[];
  faq?: ArticlePage["faq"];
}

export const lua = (code: string, outputs: CodeBlock["outputs"]): CodeBlock => ({ code, flavor: "lua54", outputs });
export const lua51 = (code: string, outputs: CodeBlock["outputs"]): CodeBlock => ({ code, flavor: "lua51", outputs });
export const luau = (code: string, outputs: CodeBlock["outputs"]): CodeBlock => ({ code, flavor: "luau", outputs });

/** Marks a value that isn't data, such as a function, for a trace. */
export const raw = (text: string): { raw: string } => ({ raw: text });

/** When the site's articles last changed; shown on each page and in its structured data. */
export const CONTENT_UPDATED = "2026-10-31";
