# Analytics

`src/lib/telemetry.ts` loads the optional analytics integrations. `src/lib/pageTelemetry.ts`
records public-page interactions; the feature components record outcomes where they happen.
The same fixed event metadata goes to Umami and, when configured, Plausible. Source code,
stdin, output, patterns, replacement text, converted documents, project/file names, gist IDs,
and raw error messages are never event properties.

## Setup and exclusions

- Set `VITE_UMAMI_SCRIPT_URL` and `VITE_UMAMI_WEBSITE_ID` before building/redeploying.
- Optionally set `VITE_ANALYTICS_DOMAINS=weblua.com,www.weblua.com` to exclude staging
  and preview hosts. With no domain list, any production host can count visits.
- Development builds, Global Privacy Control, and Do Not Track disable telemetry, including
  Sentry. No analytics script loads for those visits.
- Visit `/?analytics=off` once in every browser/profile you use to test the production site.
  This writes Umami's `umami.disabled` browser flag, also honored by our Plausible/Sentry
  wrappers. Visit `/?analytics=on` to reverse it; privacy signals still win. A fresh page load
  unloads any integrations already running. Weblua has no admin account with which to infer
  operator identity, so this explicit browser preference is the operator exclusion.
- Umami enables `data-performance=true` (Core Web Vitals, Umami 3.1+) and a before-send
  hook (Umami 2.18+). Use a supported current tracker for these controls. Keep tracker and
  server versions compatible.

Every Umami payload strips fragments and all query parameters except `utm_source`,
`utm_medium`, `utm_campaign`, `utm_term`, and `utm_content`. Titles are fixed route labels.
Same-site referrers are removed; external referrers keep only the origin. Duplicate page views
caused by share/gist hash changes are suppressed, and performance is reported once per page.
Identification payloads are refused. Plausible retains its existing policy of not loading
on source-bearing URLs; Umami is the recommended provider for the complete tracking setup.

Events waiting for either script are queued separately in memory, up to 100 per provider,
and flushed once ready. Opting out clears them. No events are stored for later offline
delivery. Ad blockers, failed script loads, closed pages, and network failures can still
reduce counts. Tracker exceptions never interrupt a product action.

## Events

All custom events include a sanitized `page` and `surface`. Embedded editors distinguish
`site-embed` and `external-embed`; same-origin embeds include the sanitized `parentPage`.
Only resolved built-in examples supply an `example` ID. `trigger: auto|manual` distinguishes
article autoruns from user-initiated runs. IDs below refer to shipped public content only.

| Event | When / properties |
| --- | --- |
| `playground_cta` | Link to the playground, Lua, or Luau editor; `place`: hero, nav, content, aside, access, final, footer. Destination page views still count separately. |
| `try_demo` | Landing hero becomes interactive; `place: hero`. |
| `showcase_tab` | Landing showcase tab selected; `tab: run|share|embed`. |
| `read` | A marked landing section or article block enters the reading area, once per part per page; `part`. Includes lazy content and exercises. Visibility is a reading proxy, not proof of reading. |
| `faq` | A question opened, once per question per page; numeric `question` within that page. |
| `outbound` | External HTTP(S) link clicked; destination hostname `to`, `place`. Never the full link. |
| `app_installed` | Browser emits `appinstalled`; browser support varies. |
| `example_try`, `example_select` | Article example activated / playground example selected; built-in `example`, `flavor`. |
| `content_open` | Initial share, gist, or example link resolved or failed; `how`, `status`, `flavor` on success, fixed `reason` on failure. No payload or gist ID. |
| `run_start`, `run` | Run attempted / completed; `flavor`, `trigger`, `timeoutMs`, optional `compare`; completion `status`, fixed failure `reason` for thrown runtime errors. Stopped and timed-out runs retain their existing statuses. |
| `check_start`, `check` | Explicit check attempted / completed; `flavor`, `types`; completion `status`, `problems`, `typeChecked`, or failure `reason`. Background linting is not counted. |
| `format` | Format result; `flavor`, `status`, optional fixed `reason`. |
| `open_bytecode` | Bytecode tab opened. |
| `runtime`, `compare`, `type_mode` | Mode selection; `to` (and `tool` for the standalone pattern tester). |
| `share_start`, `copy_share` | Share attempted / native share or clipboard completed; `flavor`, `method: native|clipboard`. Cancellation is not success. |
| `embed_start`, `copy_embed` | Embed generation attempted / iframe markup copied; `flavor`. |
| `copy_input`, `copy_output`, `copy_bytecode` | Clipboard succeeds; `flavor`. Content is never sent. |
| `open_gist` | Gist opened from Projects; `flavor`. Initial URL loads use `content_open`. |
| `project` | Successful local operation; `action: new|save|open|rename|delete|import|export|reset`; `flavor` and numeric `files` where useful. |
| `file` | File operation succeeds; `action: add|rename|delete|entry`, numeric `files` where useful. |
| `action_failed` | Failed action, with fixed `action` and `reason` such as clipboard, encode, too-large, cancelled, invalid, load, storage, read, unsupported. No exception text. |
| `tool_use` | First interaction per standalone tool/runtime/direction in this mount; `tool`, `flavor`, optional `direction`. Passive default demos do not count; copying their result does. |
| `tool_result` | First success and first error per tool/runtime/direction after use; `status`. Debounced executions are not counted on every keystroke. |
| `tool_preset`, `tool_direction`, `tool_copy` | Preset selected (numeric index, or guide), conversion direction changed, result copied; `tool`, optional `direction`, `preset`, `status`. Copy failures use `action_failed`. |
| `walkthrough`, `lookup_try` | First manual walkthrough interaction / lookup tried; public `block`; walkthrough `action: play|step`. Automatic animation is not an interaction. |
| `quiz_attempt` | A new option attempted; public `block`, `result: correct|incorrect`, numeric `attempts`. Repeated selection of the same option is ignored. |
| `quiz_answer`, `solution_reveal` | Answer / exercise solution opened by the user, once per block per page. Automatic quiz explanation after success does not count as an answer reveal. |
| `exercise_result` | First failed and first passed run per lesson-page mount; `lesson`, `status`. Only messages from that exercise's same-origin iframe are accepted. |
| `lesson_complete` | A lesson passes for the first time according to browser-local progress; `lesson`. Repeated passes do not count again unless progress/storage was cleared. |

## Useful reports

- Acquisition: campaign/referrer → landing or content page → `playground_cta` → manual
  `run` with `status: ok`. Compare CTA placement, rather than only destination visits.
- Landing: `read` by part → `try_demo` or `playground_cta`; FAQ by page and question.
- Tools: tool-page visits → `tool_use` → `tool_result` → `tool_copy`, by tool/direction.
- Learning: lesson-page visits → `quiz_attempt` / `exercise_result` → `lesson_complete`.
  Completion lives in one browser; these are not cross-device student records.
- Sharing: `share_start` → `copy_share`, and `embed_start` → `copy_embed`; break down
  `action_failed` by action/reason. `content_open` measures recipients separately.
- Adoption: `project` by action and `file` by action; runtime, type mode, and bytecode use.
- Separate manual editor usage from automatic examples using `surface`, `parentPage`,
  `example`, and `trigger`; iframe page views are additional page views.
- Performance: LCP/INP/CLS by route and device. Configure reports in the dashboard;
  this repository does not provision Umami dashboards, retention, or server settings.

## Verify after deployment

Use a fresh browser profile without GPC/DNT, an ad blocker, or the operator flag.
Open `/?utm_source=test&utm_medium=check`, scroll, open a FAQ, and launch the playground.
In Umami Realtime, check the page, campaign, `read`, `faq`, and `playground_cta` events.
Run code, use both standalone tools, pass a lesson exercise, and copy a share link.
Inspect `/api/send` requests in browser developer tools: no source fragments, arbitrary
query fields, code, file/project names, gist IDs, or output should be present. Check that
copying a share link adds an event without an extra page view. On a compatible tracker,
check Performance after interacting and leaving the page. Finally visit `/?analytics=off`
and confirm that a subsequent page load sends no telemetry.

Local automated coverage: startup/provider queues, opt-outs, URL filtering, page/performance
deduplication, delegated interactions, lazy reading markers, tool outcomes, quiz attempts,
and same-origin lesson completion. A production build also verifies prerendering.
