// Types for the modules @lezer/generator's Vite plugin builds from lua.grammar.
declare module "*lua.grammar" {
  import type { LRParser } from "@lezer/lr";

  export const parser: LRParser;
}

declare module "*lua.grammar.terms" {
  export const LineComment: number;
  export const BlockComment: number;
  export const LongString: number;
  export const Label: number;
  export const closeAngle: number;
}
