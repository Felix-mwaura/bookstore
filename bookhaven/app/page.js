import HomeClient from "./components/HomeClient";
import StoreLayout from "./components/StoreLayout";
import { getCatalogueStats, getStorefrontBooks } from "./lib/catalogue";
import { mpesaConfig } from "./lib/mpesa";

// The homepage is rendered on the server so the shelf, the hero covers and
// the real catalogue counts are in the HTML a crawler (or a slow phone)
// receives. StoreLayout adds the header, basket and footer; HomeClient only
// renders the page itself.
export const revalidate = 60;

export default async function Home() {
  const [books, stats] = await Promise.all([getStorefrontBooks(60), getCatalogueStats()]);

  return (
    <StoreLayout>
      <HomeClient initialBooks={books} stats={stats} mpesaEnabled={!mpesaConfig().error} />
    </StoreLayout>
  );
}
