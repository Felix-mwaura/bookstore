// Deprecated alias, kept so a tab loaded before the rename still works.
//
// The folder was misspelled (`adresses`), so the route is now
// /api/addresses. Every client in this repo calls the new path. This
// re-export exists only because a browser holding an older bundle would
// otherwise get a 404 in the middle of saving an address — a silent data
// loss, not a cosmetic 404. It can be deleted once no cached bundle from a
// previous deployment is expected.
export { GET, POST, PATCH, DELETE } from "../addresses/route";
