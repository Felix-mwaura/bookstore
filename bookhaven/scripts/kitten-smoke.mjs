#!/usr/bin/env node
// Guard the decorative login scene without replacing the motion tests.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const login = read("app/login/AuthClient.js");
const scene = read("app/components/KittenScene.js");
const css = read("app/components/kitten-scene.module.css");
let failures = 0;
function check(label, ok) {
  console[ok ? "log" : "error"](`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failures++;
}

check("login has one card with scenes above and below the form", /<KittenScene placement="top"\s*\/>/.test(login) && /<SignInForm[\s\S]*?<KittenScene\s*\/>/.test(login));
check("the old room panel is not mounted beside the form", !/<Room\s*\/>/.test(scene) && !/\bheroTitle\b/.test(login));
check("sleeping, sitting and walking kittens remain", /<SleepingKitten/.test(scene) && /<SittingKitten/.test(scene) && /<WalkingKitten/.test(scene));
check("both scenes are hidden from assistive technology", (scene.match(/aria-hidden="true"/g) || []).length >= 2);
check("scene does not intercept form controls", /\.scene\s*\{[^}]*pointer-events:\s*none/.test(css));
check("the lower scene reserves normal-flow space", /\.scene\s*\{[^}]*position:\s*relative/.test(css) && /\.scene\s*\{[^}]*height:\s*clamp/.test(css));
check("the walking kitten stays in its own bounded lane", /\.track\s*\{[^}]*width:\s*36%/.test(css) && /\.walker\s*\{[^}]*width:\s*min\(70%,\s*96px\)/.test(css) && /translateX\(20%\)/.test(css));
check("reduced motion stops each decorative animation", /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.walker,\s*\.bob,\s*\.tail,\s*\.breathe,\s*\.playful\s*\{[^}]*animation:\s*none/.test(css));

if (failures) process.exitCode = 1;
