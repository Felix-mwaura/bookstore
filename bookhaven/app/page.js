import HomeClient from "./components/HomeClient";
import { getStorefrontBooks } from "./lib/catalogue";

// The homepage is rendered on the server so the shelf, the hero covers and
// the real catalogue counts are in the HTML a crawler (or a slow phone)
// receives. The client component takes over for the cart, filters and
// realtime updates.
export const revalidate = 60;

export default async function Home() {
  const books = await getStorefrontBooks(60);
  return <HomeClient initialBooks={books} />;
}
