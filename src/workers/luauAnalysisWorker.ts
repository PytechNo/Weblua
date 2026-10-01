import { Analysis } from "@luau-rs/luau/analysis";
import type { AnalysisRequest, AnalysisResponse } from "../lib/types";
import {
  handleAnalysisRequest,
  LuauAnalysisSession,
  WEBLUA_LUAU_DEFINITIONS
} from "./luauAnalysisSession";

const ctx: Worker = self as unknown as Worker;

// One analyzer for the life of the worker. Compiling its ~5 MB of wasm costs
// far more than any check, and its module caches are what keep rechecks to a
// few milliseconds.
const session = Analysis.create({
  mode: "strict",
  lint: true,
  definitions: [{ name: "weblua", source: WEBLUA_LUAU_DEFINITIONS }]
}).then((analysis) => new LuauAnalysisSession(analysis));

// Every request reports a failed load itself; this only keeps the rejection
// from also surfacing as unhandled before the first request arrives.
session.catch(() => undefined);

// Requests await the same promise, so they are answered in arrival order and
// each runs to completion before the next starts.
ctx.onmessage = async (event: MessageEvent<AnalysisRequest>) => {
  const request = event.data;
  let response: AnalysisResponse;

  try {
    response = { id: request.id, ok: true, result: handleAnalysisRequest(await session, request) };
  } catch (error) {
    response = {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }

  ctx.postMessage(response);
};
