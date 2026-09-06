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

- **mascot-variants** — Generate new PNG poses/expressions of an app mascot from
  a single reference image (idle, loading, success, error, onboarding, etc.),
  using OpenAI's image-edit API with the reference image as a style anchor.
  Works with any app/platform (React Native, Flutter, iOS, Android, web).

## Adding a new skill

Each skill lives in its own folder under `skills/<skill-name>/` with a
`SKILL.md` file containing `name` and `description` frontmatter, plus any
supporting scripts/assets it needs.
