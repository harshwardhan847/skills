# skills

A collection of [Agent Skills](https://agentskills.io) — reusable, model-agnostic
skill packages that work with Claude Code, Cursor, and other coding agents that
support the SKILL.md standard.

## Install a skill

Using [`npx skills`](https://www.npmjs.com/package/skills):

```
npx skills add harshwardhan/skills --skill mascot-variants
```

## Available skills

### mascot-variants

Generates new mascot PNGs by sending an **existing mascot image as a
reference** to OpenAI's `gpt-image-2` image-edit endpoint, along with a
prompt describing a new pose/situation. A fixed style-lock instruction keeps
the character's design, palette, and proportions consistent across
variants — only pose, expression, or props change.

Works on any project/platform (React Native, Flutter, iOS, Android, web) — it
just needs a path to one reference image; it doesn't assume any particular
repo layout. No `openai` npm dependency is required — it uses Node's native
`fetch`/`FormData`/`Blob` (Node 18+) to call the REST API directly.

#### Install

```
npx skills add harshwardhan/skills --skill mascot-variants
```

This drops the skill (`SKILL.md` + `driver.mjs`) into your agent's skills
folder — e.g. `.claude/skills/mascot-variants/` for Claude Code.

#### Setup: add your OpenAI API key (one-time, per machine)

The skill needs an OpenAI API key to call the image-edit endpoint. Set it up
once with:

```
node .claude/skills/mascot-variants/driver.mjs set-key sk-...
```

This stores the key in a `.openai-key` file next to `driver.mjs` (chmod
`600`), shared across every project you use this skill in on that machine —
**it is never written into any project repo** and is git-ignored.

Alternatively, export `OPENAI_API_KEY` in your shell for a single session —
the driver checks the environment variable first, before falling back to the
stored key file.

> Adjust the path above to wherever `npx skills add` actually installed the
> skill on your machine/agent if it differs from `.claude/skills/mascot-variants/`.

#### Usage

Run the driver from inside whichever app repo you're generating assets for,
pointing `--ref` at that project's existing mascot image.

**1. Generate all built-in states for a mascot:**

```
node .claude/skills/mascot-variants/driver.mjs states --ref assets/mascot/fox.png
```

Writes one PNG per state next to the reference, in a sibling `states/`
folder (e.g. `assets/mascot/states/fox-success.png`). Defaults to
`quality=low`, `size=1024x1024`, transparent background.

Generate only specific states:

```
node .claude/skills/mascot-variants/driver.mjs states --ref assets/mascot/fox.png --states success,error,onboarding
```

List the built-in state vocabulary (`idle`, `loading`, `success`, `error`,
`empty-state`, `onboarding`, `achievement`, `notification`,
`settings-help`, `sleeping`):

```
node .claude/skills/mascot-variants/driver.mjs list-states
```

The library is intentionally generic — pass your own comma-separated
`--states` keys, or use `custom` below, for anything app-specific that isn't
in the list.

**2. Generate a mascot for a one-off situation not in the library:**

```
node .claude/skills/mascot-variants/driver.mjs custom --ref assets/mascot/fox.png --situation "fox wearing a party hat celebrating a 7-day streak" --name streak-7
```

Writes to a sibling `custom/` folder next to the reference
(`assets/mascot/custom/fox-streak-7.png`). `--name` is optional — a slug is
derived from the situation text if omitted.

**3. Preview a prompt without spending an API call:**

Add `--dry-run` to either `states` or `custom` — prints the exact prompt and
output path without calling the API.

**4. Wire the new PNG into the app:**

The driver prints the generated file path plus a quick per-platform
reminder (React Native `require()`, Flutter `Image.asset` + pubspec entry,
iOS `Assets.xcassets`, Android `res/drawable`). Actually wiring it into UI
code is app-specific and left to you — this skill only produces the asset.

**Flags common to `states` and `custom`:**

| Flag | Description |
| --- | --- |
| `--ref <path>` | Required. Path to the reference mascot image (png/jpg), resolved relative to your current directory. |
| `--out-dir <path>` | Override the default sibling output folder. |
| `--quality low\|medium\|high` | Default `low` (cheapest tier). |
| `--size 1024x1024` | Default; must be a size `gpt-image-2` supports. |
| `--dry-run` | Skip the network call. |

#### How it works

- Calls `POST https://api.openai.com/v1/images/edits` with
  `model=gpt-image-2`, the reference image as `image[]`,
  `background=transparent`, and a prompt built from a fixed **style-lock**
  preamble (same design/palette/line-weight/style, transparent background,
  no text/watermark) plus the state or custom situation description.
- The response is `b64_json`, decoded and written straight to a PNG — no
  separate download step.
- Output naming: `<mascot-name>-<state-or-slug>.png`, where `<mascot-name>`
  is derived from the reference file's basename (e.g. `fox.png` → `fox`).

#### Gotchas

- **Quality defaults to `low` on purpose** — cheapest tier by default; pass
  `--quality medium`/`high` only when you need sharper output and are okay
  with the extra cost.
- **The API key lives on the machine, not the project** — stored once next
  to the skill, reused across every project — nothing to configure
  per-repo.
- **GIF/animated references aren't supported** — point `--ref` at a static
  PNG/JPG frame of the character.

#### Troubleshooting

- **"No OpenAI API key found"** — run `set-key` (see Setup) or export
  `OPENAI_API_KEY`.
- **"Reference image not found"** — check the `--ref` path is correct
  relative to your current directory.
- **"Unknown state ..."** — run `list-states` for exact spellings, or use
  `custom` for anything else.
- **OpenAI API error 4xx** — the error body is printed verbatim (invalid
  key, unsupported size/quality combo, content-policy rejection, etc.) —
  read it, it's the actual server response.

## Adding a new skill

Each skill lives in its own folder under `skills/<skill-name>/` with a
`SKILL.md` file containing `name` and `description` frontmatter, plus any
supporting scripts/assets it needs.
