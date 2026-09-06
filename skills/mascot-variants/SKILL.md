---
name: mascot-variants
description: Generate new PNG poses/expressions of an app mascot from a single reference image, for built-in app states (idle, loading, success, error, onboarding, achievement, ...) or any free-form situation you describe, using OpenAI's gpt-image-2 image-edit API with the reference image as a style anchor. Works for any app/platform (React Native, Flutter, iOS, Android, web). Use when asked to "generate a mascot for X", "make an onboarding/success/error pose for this character", or "create a new mascot state PNG".
---

# Mascot Variant Generator

Generates new mascot PNGs by sending an **existing mascot image as a
reference** to OpenAI's image-edit endpoint, along with a prompt
describing a new pose/situation. A fixed style-lock instruction keeps
the character's design, palette, and proportions consistent across
variants — only pose/expression/props change.

Works on any project/platform — it just needs a path to one reference
image; it doesn't assume any particular repo layout.

## Setup (one-time, per machine)

```
node ~/.claude/skills/mascot-variants/driver.mjs set-key sk-...
```

Stores the key at `~/.claude/skills/mascot-variants/.openai-key`
(chmod 600), shared across all projects on this machine — never
written into any project repo. Alternatively export `OPENAI_API_KEY`
in your shell for a single session; the driver checks the env var
first.

## Run (agent path)

Run from inside whichever app repo you're generating assets for, and
point `--ref` at that project's existing mascot image.

**1. Generate all built-in states for a mascot:**

```
node ~/.claude/skills/mascot-variants/driver.mjs states --ref assets/mascot/fox.png
```

Writes one PNG per state next to the reference, in a sibling `states/`
folder (e.g. `assets/mascot/states/fox-success.png`). Defaults to
`quality=low`, `size=1024x1024`, transparent background.

Generate only specific states:

```
node ~/.claude/skills/mascot-variants/driver.mjs states --ref assets/mascot/fox.png --states success,error,onboarding
```

See the built-in state vocabulary (idle, loading, success, error,
empty-state, onboarding, achievement, notification, settings-help,
sleeping):

```
node ~/.claude/skills/mascot-variants/driver.mjs list-states
```

This library is intentionally generic — pass `--states` with your own
comma-separated keys, or use `custom` below, for anything app-specific
that isn't in the list.

**2. Generate a mascot for a one-off situation not in the library:**

```
node ~/.claude/skills/mascot-variants/driver.mjs custom --ref assets/mascot/fox.png --situation "fox wearing a party hat celebrating a 7-day streak" --name streak-7
```

Writes to a sibling `custom/` folder next to the reference
(`assets/mascot/custom/fox-streak-7.png`). `--name` is optional — a
slug is derived from the situation text if omitted.

**3. Preview a prompt without spending an API call:**

Add `--dry-run` to either `states` or `custom` — prints the exact
prompt and output path without calling the API.

**4. Wire the new PNG into the app:**

The driver prints the generated file path plus a quick per-platform
reminder (React Native `require()`, Flutter `Image.asset` + pubspec
entry, iOS `Assets.xcassets`, Android `res/drawable`). Actually wiring
it into UI code is app-specific and left to you — this skill only
produces the asset.

Flags common to `states` and `custom`:
- `--ref <path>` — required, path to the reference mascot image (png/jpg), resolved relative to your current directory
- `--out-dir <path>` — override the default sibling output folder
- `--quality low|medium|high` (default `low`, cheapest tier)
- `--size 1024x1024` (default; must be a size gpt-image-2 supports)
- `--dry-run` — skip the network call

## How it works

- Calls `POST https://api.openai.com/v1/images/edits` with
  `model=gpt-image-2`, the reference image as `image[]`,
  `background=transparent`, and a prompt built from a fixed
  **style-lock** preamble (same design/palette/line-weight/style,
  transparent bg, no text/watermark) plus the state or custom
  situation description.
- Response is `b64_json`, decoded and written straight to a PNG — no
  separate download step.
- Output naming: `<mascot-name>-<state-or-slug>.png`, where
  `<mascot-name>` is derived from the reference file's basename (e.g.
  `fox.png` → `fox`).

## Gotchas

- **No `openai` npm dependency required.** Uses Node's native
  `fetch`/`FormData`/`Blob` (Node 18+) to hit the REST API directly —
  no per-project install needed. Run with a recent Node.
- **Quality defaults to `low` on purpose** — cheapest tier by default;
  pass `--quality medium`/`high` only when you need sharper output and
  are OK with the extra cost.
- **The API key lives on the machine, not the project.** It's stored
  once under `~/.claude/skills/mascot-variants/`, reused across every
  project you run this skill in — nothing to configure per-repo.
- **GIF/animated references aren't supported** — point `--ref` at a
  static PNG/JPG frame of the character.
- **This skill has not been exercised against a live API call** (no
  `OPENAI_API_KEY` was available when it was authored). Argument
  parsing, output-path resolution, and `--dry-run` for both `states`
  and `custom` were verified directly. Run one real call and open the
  resulting PNG before relying on it for production assets.

## Troubleshooting

- **"No OpenAI API key found"** — run `set-key` (see Setup) or export
  `OPENAI_API_KEY`.
- **"Reference image not found"** — check the `--ref` path is correct
  relative to your current directory.
- **"Unknown state ..."** — run `list-states` for exact spellings, or
  use `custom` for anything else.
- **OpenAI API error 4xx** — the error body is printed verbatim
  (invalid key, unsupported size/quality combo, content-policy
  rejection, etc.) — read it, it's the actual server response.
