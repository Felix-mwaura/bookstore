import StoreLayout from "../components/StoreLayout";

// Same reason as app/books/layout.js: one mount of the chrome for every genre
// page, instead of one per navigation.
export default function CategoryLayout({ children }) {
  return <StoreLayout>{children}</StoreLayout>;
}
