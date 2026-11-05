import HomeClient from "./components/HomeClient";
import StoreLayout from "./components/StoreLayout";
import { getCatalogueStats, getStorefrontBooks } from "./lib/catalogue";
import { listTestimonials } from "./lib/testimonials";
import { mpesaAvailability } from "./lib/mpesa-availability";

// The homepage is rendered on the server so the shelf, the hero covers and
// the real catalogue counts are in the HTML a crawler (or a slow phone)
// receives. StoreLayout adds the header, basket and footer; HomeClient only
// renders the page itself.
export const revalidate = 60;

export default async function Home() {
  const [books, stats, mpesa, testimonials] = await Promise.all([
    getStorefrontBooks(60),
    getCatalogueStats(),
    mpesaAvailability(),
    // An unpublished table (migration not yet applied) returns an empty list:
    // the section then shows its invitation and invents nothing.
    listTestimonials(),
  ]);

  return (
    <StoreLayout>
      <HomeClient
        initialBooks={books}
        stats={stats}
        mpesaEnabled={mpesa.enabled}
        testimonials={testimonials}
      />
    </StoreLayout>
  );
}
