import type { ArticleHub, ArticlePage, Exercise } from "./articleTypes";
import { examplePages } from "./examplePages";
import { guidePages } from "./guidePages";
import { lessonPages } from "./lessonPages";
import type { ArticleSection } from "./routes";
import type { PlaygroundExample } from "./types";

export type * from "./articleTypes";
export { CONTENT_UPDATED } from "./articleTypes";
export { guidePages };

export const articleHubs: Record<ArticleSection, ArticleHub> = {
  examples: {
    title: "Lua and Luau examples you can run",
    metaTitle: "Lua and Luau Examples You Can Run Online | Weblua",
    description:
      "Runnable Lua and Luau code examples: split strings, string.format, interpolation, metatables, Luau OOP, and Luau types, with real output on Lua 5.1, 5.4, and Luau.",
    intro: [
      "Each page answers one question people search for, with code you can read, run, and change. Under every example is what Lua 5.1, Lua 5.4, and Luau really print, so you can see where the three agree and where they don't. Press Run it here on any example to edit it on the page.",
      "The outputs aren't typed by hand. A test runs every example on each runtime and fails the build if a page shows anything else, so the output on these pages is the output you get."
    ],
    blocks: [
      {
        heading: "Which Lua do these examples use?",
        text: [
          "Lua 5.1 is the version LuaJIT, LÖVE, Neovim, and World of Warcraft add-ons build on. Lua 5.4 is the current release line of the reference interpreter. Luau is the language Roblox scripts are written in: it grew out of Lua 5.1 and adds types and some syntax. Most code runs on all three, and the examples point out where it doesn't.",
          "New to Luau? The [Learn Luau course](/learn-luau) teaches it step by step, with animated walkthroughs and exercises. Comparing versions? See [Lua vs Luau](/lua-vs-luau) and [Lua 5.1 vs 5.4](/lua-5-1-vs-5-4)."
        ]
      }
    ],
    faq: [
      [
        "Can I run these Lua examples online?",
        "Yes. Every example has a Run it here button that loads an editor on the page, and an Open in playground link that opens it in the full Weblua playground. Both run the real Lua and Luau interpreters in your browser through WebAssembly, with no install and no account."
      ],
      [
        "Do Lua examples work in Roblox?",
        "Mostly. Roblox runs Luau, which accepts nearly all Lua 5.1 code. The exceptions are shown on each page: Luau has extras such as `string.split` and backtick strings that Lua lacks, and it leaves out a few things from newer Lua versions, such as `goto`, `load`, and `_ENV`."
      ],
      [
        "Why does Lua 5.4 print 5.0 where Lua 5.1 prints 5?",
        "Lua 5.3 added an integer type. A float that happens to be whole, such as the result of math.sqrt(25), prints with .0 so you can tell it apart from the integer 5. Lua 5.1 and Luau have one number type and print 5."
      ]
    ],
    pages: examplePages
  },
  "learn-luau": {
    title: "Learn Luau: a free interactive course",
    metaTitle: "Learn Luau Free: Interactive Lessons and Exercises | Weblua",
    description:
      "Learn Luau, the language of Roblox scripting, for free in your browser: 8 short lessons with animated code walkthroughs, quizzes, and exercises checked as you run them.",
    intro: [
      "Eight short lessons take you from your first variable to classes, types, and coroutines in Luau, the language Roblox scripts are written in. Every lesson animates its code line by line, so you see each variable change, then asks you to predict an output, then gives you an exercise in a real editor that checks your answer when you press Run.",
      "It runs in any browser, Chromebooks included, with nothing to install and no account. Your progress is saved in this browser."
    ],
    blocks: [
      {
        heading: "How the lessons work",
        list: [
          "**Watch it run.** Code walkthroughs play one line at a time and show the variables and output change as they go. Pause, step back, or drag the slider to any step.",
          "**Predict, then check.** Short quizzes ask what a snippet prints before you see it. Wrong guesses explain themselves.",
          "**Write real code.** Each lesson ends with an exercise in an embedded Luau editor with the type checker on. Checks run when you press Run, and passing them all marks the lesson done.",
          "**Try anything.** Every example has Run it here, which turns it into an editor so you can change it and see what happens."
        ]
      },
      {
        heading: "Is this a Roblox scripting tutorial?",
        text: [
          "It teaches the language Roblox scripts are written in, which is most of what scripting is: variables, conditions, loops, functions, tables, classes, and types all work exactly as they do in Roblox Studio. What it doesn't cover is the Roblox engine itself, such as Instances, `game:GetService`, events, and RemoteEvents, because those only run inside Roblox. Once the language makes sense, Roblox's own documentation for those APIs is far easier to follow.",
          "Weblua runs Luau, not Roblox, so it can't open places or run games. It is a good fit for learning on a Chromebook or a school computer where Studio won't install."
        ]
      }
    ],
    faq: [
      [
        "Is Luau the same as Lua?",
        "No, but close. Luau started from Lua 5.1 and keeps its syntax, so Lua code mostly works. It adds optional type annotations, continue, compound assignment such as +=, backtick string interpolation, and a faster interpreter, and it removes some library functions for safety. The Lua vs Luau page compares them side by side."
      ],
      [
        "How long does it take to learn Luau?",
        "The eight lessons here take about an hour and a half together. That covers the core language. Getting comfortable takes longer and comes from writing small programs, so each lesson ends with one."
      ],
      [
        "Do I need Roblox Studio to learn Luau?",
        "No. These lessons run Luau in your browser, including the type checker Studio uses. You need Studio only for the Roblox-specific parts: building places and using engine APIs."
      ],
      [
        "Is this Luau course free?",
        "Yes. There is no account, no paywall, and no install. Weblua is open source."
      ]
    ],
    pages: lessonPages
  }
};

/** What exerciseSource prints when every check passes; the lesson page listens for it. */
export const ALL_PASSED = "All checks passed";

/** `id` for the playground's `#example=` link to a code block. */
export function codeBlockId(prefix: string, slug: string, index: number): string {
  return `${prefix}/${slug}/${index}`;
}

/** `id` for the playground's `#example=` link to a lesson's exercise. */
export function exerciseId(slug: string): string {
  return `learn-luau/${slug}/exercise`;
}

/** The exercise file: the starter (or solution) and the checks that grade it. */
export function exerciseSource(exercise: Exercise, code = exercise.starter): string {
  const checks = exercise.checks
    .map(([label, body]) => `check(${JSON.stringify(label)}, function()\n  ${body}\nend)`)
    .join("\n");
  return `${code}

-- Press Run to check your answer. The checks below don't need changes.
local passed = 0
local function check(label: string, test: () -> boolean)
  local ok, result = pcall(test)
  if ok and result then
    passed += 1
    print(\`✓ {label}\`)
  else
    print(\`✗ {label}\` .. (if ok then "" else \`: {result}\`))
  end
end

${checks}
print(if passed == ${exercise.checks.length} then "${ALL_PASSED}. Nice work!" else \`{passed} of ${exercise.checks.length} checks passed. Keep going!\`)
`;
}

/** Every page with runnable code, with the prefix its blocks' ids use. */
export function pagesWithCode(): Array<{ prefix: string; page: ArticlePage }> {
  return [
    ...(Object.keys(articleHubs) as ArticleSection[]).flatMap((section) => articleHubs[section].pages.map((page) => ({ prefix: section, page }))),
    ...Object.values(guidePages).map((page) => ({ prefix: "guide", page }))
  ];
}

/** Every code block and exercise as an example the playground can open by id. */
export function articleExamples(): PlaygroundExample[] {
  return pagesWithCode().flatMap(({ prefix, page }) => [
    ...page.blocks.flatMap((block, index): PlaygroundExample[] =>
      block.code ? [{ id: codeBlockId(prefix, page.slug, index), title: page.title, flavor: block.code.flavor, code: block.code.code }] : []
    ),
    ...(page.exercise ? [{ id: exerciseId(page.slug), title: `${page.title} exercise`, flavor: "luau" as const, code: exerciseSource(page.exercise) }] : [])
  ]);
}
