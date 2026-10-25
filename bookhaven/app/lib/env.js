// Public configuration, and what happens when it is missing.
//
// WHY THIS FILE EXISTS
//   The app works without NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY / _SITE_URL
//   because app/lib/supabase-config.js and app/lib/site.js fall back to the
//   project this site was built for. That keeps a working deployment running,
//   but it also means a *new* build with the variables missing silently points
//   at somebody else's project: forms write to a stranger's database, and
//   password-reset emails link to a stranger's domain. The fallbacks are
//   convenient and quietly wrong.
//
//   So: a production build refuses to run without them (next.config.ts calls
//   assertProductionBuildEnv()). A dev server or an already-deployed build
//   keeps working — a failed build is caught before it can replace the live
//   deployment, while a runtime throw would take the shop down.

/** Variables a production build must have. Order is the order they are reported. */
export const REQUIRED_PUBLIC_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SITE_URL",
];

const PLACEHOLDER_PATTERN = /^(https?:\/\/)?(your[-.]|YOUR-|example\.|changeme|xxx)/i;

/**
 * Which required variables are missing or still hold the example value from
 * .env.example? Pure, so it can be tested without touching process.env.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string[]}
 */
export function missingPublicEnv(env) {
  return REQUIRED_PUBLIC_ENV.filter((name) => {
    const value = (env?.[name] || "").trim();
    return !value || PLACEHOLDER_PATTERN.test(value);
  });
}

/** The message a failed build prints. One line per variable, with what to do. */
export function envErrorMessage(missing) {
  return [
    `Missing production configuration: ${missing.join(", ")}.`,
    "",
    "Set these in Vercel → Settings → Environment Variables (Production), then redeploy:",
    "  NEXT_PUBLIC_SUPABASE_URL       https://<project-ref>.supabase.co",
    "  NEXT_PUBLIC_SUPABASE_ANON_KEY  Project Settings → API → anon public",
    "  NEXT_PUBLIC_SITE_URL           the public https address of this site",
    "",
    "The build stops here on purpose. Without them the app would fall back to",
    "the project it was originally built for — writing orders into a database",
    "you do not own. The currently deployed version keeps serving until a",
    "build succeeds.",
  ].join("\n");
}

/**
 * Is this process a production build?
 *
 * Next 16 no longer exports NEXT_PHASE to next.config.ts (verified: it is
 * undefined for both `next build` and `next start`, and both set
 * NODE_ENV=production), so the command line is the signal that separates the
 * two. NEXT_PHASE is still honoured first for older versions.
 *
 * `next start` must NOT be a build: throwing there would stop a deployment
 * that is already serving traffic, which is the opposite of helpful.
 *
 * @param {Record<string, string | undefined>} env
 * @param {string[]} argv
 */
export function isProductionBuild(env = process.env, argv = process.argv) {
  if (env.NEXT_PHASE) return env.NEXT_PHASE === "phase-production-build";
  return (argv || []).includes("build");
}

/**
 * Called from next.config.ts. Throws during `next build` only, so a missing
 * variable can never take down a site that is already running.
 *
 * @param {Record<string, string | undefined>} [env]
 * @param {string[]} [argv]
 */
export function assertProductionBuildEnv(env = process.env, argv = process.argv) {
  if (!isProductionBuild(env, argv)) return;

  const missing = missingPublicEnv(env);
  if (missing.length === 0) return;

  // Jest/Playwright/npm test runs must not need production credentials; they
  // never serve real traffic.
  if (env.NEXT_PUBLIC_ALLOW_ENV_FALLBACK === "1") {
    console.warn(`[env] build proceeding without ${missing.join(", ")} (NEXT_PUBLIC_ALLOW_ENV_FALLBACK=1)`);
    return;
  }

  throw new Error(envErrorMessage(missing));
}
