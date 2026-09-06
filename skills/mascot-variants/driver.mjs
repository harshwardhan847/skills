#!/usr/bin/env node
/**
 * Mascot variant generator — drives OpenAI's image-edit API to produce
 * new PNG poses/situations of an existing mascot while keeping its
 * design consistent, for any app (mobile or otherwise).
 *
 * Usage:
 *   node driver.mjs states  --ref path/to/mascot.png [--out-dir dir] [--states key1,key2] [--quality low|medium|high] [--dry-run]
 *   node driver.mjs custom  --ref path/to/mascot.png --situation "..." [--out-dir dir] [--name slug] [--quality low] [--dry-run]
 *   node driver.mjs list-states
 *   node driver.mjs set-key <OPENAI_API_KEY>
 *
 * All paths (--ref, --out-dir) are resolved relative to the current
 * working directory — run this from inside whichever app repo you're
 * generating assets for.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_FILE = path.join(__dirname, ".openai-key");
const MODEL = "gpt-image-2";

// Generic app-state vocabulary that applies across most apps (mobile or
// otherwise). Override or extend per-project with --states, or skip the
// library entirely and use `custom` for anything app-specific.
const STATE_LIBRARY = {
  idle: "standing neutral, calm relaxed pose, gentle idle expression, waiting for the user to do something",
  loading: "mid-motion/spinning or looking at a loading indicator, patient anticipating expression",
  success: "triumphant celebration pose, joyful excited expression, arms raised, a task just completed successfully",
  error: "confused or apologetic expression, slightly slumped, holding up a hand as if to say sorry, something went wrong",
  "empty-state": "curiously looking around an empty space, inviting expression, nothing here yet",
  onboarding: "warm welcoming wave, friendly open inviting expression, greeting a new user for the first time",
  achievement: "proud and beaming, wearing or holding a small trophy/medal/badge, celebrating a milestone",
  notification: "alert and attentive, pointing or looking toward something, got the user's attention",
  "settings-help": "thoughtful, holding a small tool or magnifying glass, helpful explaining pose",
  sleeping: "curled up asleep, eyes closed, peaceful sleeping pose with a little zzz, long inactivity",
};

const STYLE_LOCK = [
  "Keep the exact same character design, 3D-render/toy art style, proportions, materials, color palette, and lighting as the reference image.",
  "Do not redesign the character, change its species/shape/colors, or change its render style — only change its pose, expression, and any small props needed for the new situation.",
  "The background MUST be fully transparent (alpha channel), exactly like the reference image — no scene, no vignette, no glow, no gradient, no floor, no shadow blob behind the subject.",
  "Single centered subject cut out on transparent background, no text, no watermark, padding around the subject consistent with the reference image.",
].join(" ");

function loadApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  if (fs.existsSync(KEY_FILE)) return fs.readFileSync(KEY_FILE, "utf8").trim();
  console.error(
    "No OpenAI API key found.\n" +
    "Set it once with:\n" +
    `  node ${__filename} set-key sk-...\n` +
    "or export OPENAI_API_KEY in your shell.\n" +
    "The key is stored only in this skill's folder (~/.claude/skills/mascot-variants/.openai-key, chmod 600) — never per-project, never committed."
  );
  process.exit(1);
}

function resolveReference(refArg) {
  if (!refArg) {
    console.error("Missing --ref <path-to-reference-mascot-image> (png/jpg).");
    process.exit(1);
  }
  const p = path.resolve(process.cwd(), refArg);
  if (!fs.existsSync(p)) {
    console.error(`Reference image not found: ${p}`);
    process.exit(1);
  }
  return p;
}

async function callImageEdit({ referencePath, prompt, quality, size }) {
  const apiKey = loadApiKey();
  const imageBytes = fs.readFileSync(referencePath);
  const ext = path.extname(referencePath).toLowerCase();
  const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";

  const form = new FormData();
  form.append("model", MODEL);
  form.append("prompt", prompt);
  form.append("quality", quality);
  form.append("size", size);
  form.append("background", "transparent");
  form.append("output_format", "png");
  form.append("n", "1");
  form.append("image[]", new Blob([imageBytes], { type: mime }), path.basename(referencePath));

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`No image returned: ${JSON.stringify(json)}`);
  return Buffer.from(b64, "base64");
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function mascotNameFromRef(refPath) {
  return path.basename(refPath, path.extname(refPath));
}

function printWiringTip(files) {
  console.log("\nGenerated file(s):");
  for (const f of files) console.log(`  ${path.relative(process.cwd(), f)}`);
  console.log(
    "\nWire it in like any other bundled image for your platform, e.g.\n" +
    '  React Native / Expo : require("./path/to/file.png")\n' +
    "  Flutter             : Image.asset('assets/path/to/file.png') (+ pubspec.yaml assets entry)\n" +
    "  iOS (SwiftUI)        : add to Assets.xcassets, then Image(\"name\")\n" +
    "  Android (Compose)    : drop in res/drawable, then painterResource(R.drawable.name)\n"
  );
}

async function cmdStates(args) {
  const referencePath = resolveReference(args.ref);
  const mascot = mascotNameFromRef(referencePath);
  const states = args.states ? String(args.states).split(",").map((s) => s.trim()) : Object.keys(STATE_LIBRARY);
  const quality = args.quality || "low";
  const size = args.size || "1024x1024";
  const dryRun = !!args["dry-run"];
  const outDir = path.resolve(process.cwd(), args["out-dir"] || path.join(path.dirname(referencePath), "states"));

  if (!dryRun) fs.mkdirSync(outDir, { recursive: true });
  const written = [];

  for (const state of states) {
    const situation = STATE_LIBRARY[state];
    if (!situation) {
      console.error(`Unknown state "${state}". Run list-states to see built-ins, or use the custom command.`);
      continue;
    }
    const prompt = `${STYLE_LOCK} New situation for this mascot: ${situation}.`;
    const outFile = path.join(outDir, `${mascot}-${state}.png`);
    console.log(`[${mascot}/${state}] quality=${quality} size=${size} -> ${path.relative(process.cwd(), outFile)}`);
    if (dryRun) {
      console.log(`  prompt: ${prompt}`);
      continue;
    }
    const png = await callImageEdit({ referencePath, prompt, quality, size });
    fs.writeFileSync(outFile, png);
    written.push(outFile);
    console.log(`  wrote ${(png.length / 1024).toFixed(0)}KB`);
  }

  if (!dryRun && written.length) printWiringTip(written);
}

async function cmdCustom(args) {
  const referencePath = resolveReference(args.ref);
  const mascot = mascotNameFromRef(referencePath);
  const situation = args.situation;
  if (!situation) {
    console.error('Missing --situation "<free text description of the new pose/scene>".');
    process.exit(1);
  }
  const quality = args.quality || "low";
  const size = args.size || "1024x1024";
  const dryRun = !!args["dry-run"];
  const outDir = path.resolve(process.cwd(), args["out-dir"] || path.join(path.dirname(referencePath), "custom"));

  // an explicit --name is used verbatim (case preserved, e.g. to match a code
  // identifier like "shortRest"); an auto-derived slug from free text is lowercased.
  const slug = args.name
    ? String(args.name).replace(/[^a-zA-Z0-9-]+/g, "-").replace(/(^-|-$)/g, "")
    : (situation.replace(new RegExp(mascot, "ig"), "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 30) || "custom");

  if (!dryRun) fs.mkdirSync(outDir, { recursive: true });
  const prompt = `${STYLE_LOCK} New situation for this mascot: ${situation}.`;
  const outFile = path.join(outDir, `${mascot}-${slug}.png`);
  console.log(`[${mascot}/${slug}] quality=${quality} size=${size} -> ${path.relative(process.cwd(), outFile)}`);
  if (dryRun) {
    console.log(`  prompt: ${prompt}`);
    return;
  }
  const png = await callImageEdit({ referencePath, prompt, quality, size });
  fs.writeFileSync(outFile, png);
  console.log(`  wrote ${(png.length / 1024).toFixed(0)}KB`);
  printWiringTip([outFile]);
}

function cmdListStates() {
  console.log("Built-in states (override with --states, or use `custom` for anything else):\n");
  for (const [k, v] of Object.entries(STATE_LIBRARY)) console.log(`  ${k}: ${v}`);
}

function cmdSetKey(args) {
  const key = args._[0];
  if (!key) {
    console.error("Usage: set-key <OPENAI_API_KEY>");
    process.exit(1);
  }
  fs.writeFileSync(KEY_FILE, key.trim() + "\n", { mode: 0o600 });
  console.log(`Saved key to ${KEY_FILE} (local to this machine, used across all projects).`);
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  const args = parseArgs(rest);
  switch (cmd) {
    case "states":
      return cmdStates(args);
    case "custom":
      return cmdCustom(args);
    case "list-states":
      return cmdListStates();
    case "set-key":
      return cmdSetKey(args);
    default:
      console.error("Unknown command. Use: states | custom | list-states | set-key");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
