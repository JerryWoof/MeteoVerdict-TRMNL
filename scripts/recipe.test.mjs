// The checks TRMNL's recipe linter ("Chef") runs on a submission, as far as they can be
// run here: https://gist.github.com/ryanckulp/fbe5f68c51db1ae214a97da24be4d62b
// Its inline-style count is printed, not asserted: see recipe/README.md.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { LAYOUTS } from "./build.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const markup = LAYOUTS.map((l) => readFileSync(join(root, "dist", `${l}.liquid`), "utf-8")).join("");
const settings = readFileSync(join(root, "src", "settings.yml"), "utf-8");
const POLLING_URL = "https://meteoverdict.cz/api/v1/{{ forecast_model }}/{{ okres_code }}.json";

test("no view wrapper: TRMNL adds view--full etc. itself", () => {
  assert.doesNotMatch(markup, /\b( view(--|__)full)\b("|')>/);
});

test("no opacity, async functions, window load handlers or <img> tags", () => {
  assert.doesNotMatch(markup, /opacity:\s*[\d.]+/);
  assert.ok(!markup.toLowerCase().includes("async function"));
  assert.ok(!markup.toLowerCase().includes("window.onload"));
  assert.ok(!markup.toLowerCase().includes("window.addeventlistener(\"load\")"));
  assert.ok(!/<img\b/i.test(markup));
});

test("the form has an author_bio with a category and a contact", () => {
  const bio = settings.split(/\n(?=- keyname:)/).find((f) => /field_type: author_bio/.test(f));
  assert.ok(bio, "author_bio field");
  const categories = bio.match(/\n  category: (.+)/)?.[1].split(",") ?? [];
  assert.ok(categories.length >= 1 && categories.length <= 2, "one or two categories");
  for (const c of categories) assert.match(c, /^(environment|life|nature|travel|personal|productivity)$/);
  assert.match(bio, /\n  github_url: https:\/\//);
  const words = bio.split(/\n  description: >-\n/)[1].split(/\n  [a-z_]+:/)[0].replace(/<[^>]+>/g, " ").split(/\s+/);
  assert.ok(words.filter(Boolean).length >= 100, "100+ words, or search engines skip the recipe");
});

test("every form field is used in the polling URL or the markup", () => {
  const fields = [...settings.matchAll(/^- keyname: (\w+)\n  field_type: (\w+)/gm)].filter(([, , t]) => t !== "author_bio");
  for (const [, key] of fields) assert.ok(POLLING_URL.includes(key) || markup.includes(key), key);
});

test("links in field descriptions are HTML links; no optional: false", () => {
  for (const line of settings.split("\n").filter((l) => /https?:\/\//.test(l) && !/^\s+(github_url|learn_more_url):/.test(l))) {
    assert.match(line, /<a href="https?:\/\//, line);
  }
  assert.doesNotMatch(settings, /optional: false/);
});

test("Chef's inline-style count (advisory here, limit 6)", (t) => {
  const props = ["justify-content", "padding", "margin", "background-color", "border-radius", "text-align", "object-fit", "font-size"];
  const n = props.reduce((sum, p) => sum + markup.split(p).length - 1, 0);
  t.diagnostic(`Chef counts ${n} of ${props.join(", ")} in the layout (it allows 6)`);
});
