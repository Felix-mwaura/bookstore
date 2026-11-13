import StoreLayout from "../components/StoreLayout";

// The header, basket drawer and footer live here, not in each page.
//
// They used to be rendered by page.js and books/[slug]/page.js, which meant a
// navigation unmounted the whole chrome and mounted it again for the next
// screen. As a layout it survives the change: only the body below it swaps,
// so the header never flashes and never re-renders.
//
// It also gives loading.js somewhere to sit — a skeleton rendered inside the
// same chrome, rather than a bare page.
export default function BooksLayout({ children }) {
  return <StoreLayout>{children}</StoreLayout>;
}
