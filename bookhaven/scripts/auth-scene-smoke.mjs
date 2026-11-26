#!/usr/bin/env node
// Guard the replacement scene and the existing safety properties of the
// former kitten scene. Interaction/geometry must also be checked in a browser.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const login = read("app/login/AuthClient.js");
const scene = read("app/components/FloatingPages.js");
const css = read("app/components/floating-pages.module.css");
const background = read("app/login/auth-background.module.css");
let failures = 0;
function check(label, ok) {
  console[ok ? "log" : "error"](`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failures++;
}

check("login has one card within the decorative scene", /<FloatingPages>[\s\S]*<SignInForm[\s\S]*<\/FloatingPages>/.test(login));
check("the background uses a local bookshelf image with a solid fallback", /background-color:\s*var\(--color-cream\)/.test(background) && /url\(["']\/images\/login-bookshelves\.jpg["']\)/.test(background) && readFileSync(join(root, "public/images/login-bookshelves.jpg")).length > 0);
check("header, form and privacy notice retain opaque readable surfaces", /<header className="bg-cream">/.test(login) && /border-line\/70 bg-white p-5/.test(login) && /rounded-xl bg-cream px-3 py-3/.test(login));
check("the old room panel is not mounted beside the form", !/<Room\s*\/>/.test(scene) && !/\bheroTitle\b/.test(login) && !/<KittenScene/.test(login));
check("the scene includes pages and bookmarks at both ends", (scene.match(/<Page className=/g) || []).length === 2 && (scene.match(/<Bookmark className=/g) || []).length === 2 && /s\.topLeft/.test(scene) && /s\.topRight/.test(scene) && /s\.bottomLeft/.test(scene) && /s\.bottomRight/.test(scene));
check("decorations are hidden from assistive technology and do not receive focus", /className=\{s\.decoration\} aria-hidden="true"/.test(scene) && (scene.match(/focusable="false"/g) || []).length >= 2);
check("scene does not intercept form controls", /\.decoration\s*\{[^}]*pointer-events:\s*none/.test(css) && /\.cardSlot\s*\{[^}]*z-index:\s*1/.test(css));
check("scene reserves normal-flow space above and below the card", /\.scene\s*\{[^}]*position:\s*relative[^}]*padding:\s*48px 0/.test(css));
check("decorations stay within the scene width", /\.decoration\s*\{[^}]*overflow:\s*hidden/.test(css));
check("reduced motion stops each decorative animation", /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.item\s*\{[^}]*animation:\s*none/.test(css));
check("the page turn only runs between sign-in and registration", /previous\.isRegister === isRegister/.test(login) && /previous\.mode === "reset"/.test(login) && /mode === "reset"/.test(login));
check("the page turn lasts about one second", /duration:\s*1000\b/.test(login));
check("page turn has a reduced motion and unsupported-browser fallback", /prefers-reduced-motion: reduce/.test(login) && /typeof page\.animate !== "function"/.test(login) && /catch \{\s*return;/.test(login));
check("turning a page never delays or replaces navigation", /<Link href=\{nextPath \? `\/login\?tab=register/.test(login) && !/await page\.animate/.test(login));
check("turn animation and motion listener are cleaned up", /removeEventListener\?\.\("change", stopForReducedMotion\)/.test(login) && /animation\.cancel\(\)/.test(login));

if (failures) process.exitCode = 1;
