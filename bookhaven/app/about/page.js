import Link from "next/link";

import { ContactBlock, PolicyPage, Section } from "../components/PolicyPage";
import StoreLayout from "../components/StoreLayout";
import { DELIVERY_PERCENT, SITE_NAME, STORE_CONTACT } from "../lib/site";

export const metadata = {
  title: `About ${SITE_NAME}`,
  description:
    "Book Haven is an online bookshop in Kenya: paperbacks and hardcovers delivered across the country, with delivery shown before you pay.",
  alternates: { canonical: "/about" },
};

// No founding date, no team size, no "thousands of happy readers". Every
// sentence here is either checkable against the shop or a statement of how it
// operates.

export default function AboutPage() {
  return (
    <StoreLayout>
      <PolicyPage
        eyebrow="About"
        title="A bookshop, online"
        intro="Book Haven sells paperbacks and hardcovers in Kenya, delivered to your door. The shop is small enough that you can reach a person, and it is built to be honest about prices, stock and reviews."
        updated={false}
      >
        <Section title="What we sell">
          <p>
            Fiction, finance, self-help, biography and history — the shelf you can see in{" "}
            <Link href="/books" className="font-medium text-sienna underline-offset-2 hover:underline">
              the catalogue
            </Link>
            . Every title shown is in stock or clearly marked otherwise; the number on the shelf is the number
            we actually have.
          </p>
        </Section>

        <Section title="How delivery works">
          <p>
            Delivery is {DELIVERY_PERCENT}% of the book total, calculated on the same page where you pay, so the
            amount owed is on screen before you confirm. No minimum order, no card details to hand over, and
            cash on delivery if M-Pesa is not convenient.
          </p>
        </Section>

        <Section title="Why the ratings look the way they do">
          <p>
            Ratings on this site come from real reviews written by signed-in customers. If a book shows no
            rating, it means nobody has reviewed it yet — not that the number was hidden. The shop previously
            displayed invented star ratings and review counts; they were removed, and the old figures are no
            longer used anywhere.
          </p>
        </Section>

        <Section title="Questions">
          <p>
            The{" "}
            <Link href="/help" className="font-medium text-sienna underline-offset-2 hover:underline">help page</Link>{" "}
            covers delivery, payment, tracking and reviews. For anything else, contact us directly.
          </p>
        </Section>

        <ContactBlock contact={STORE_CONTACT} />
      </PolicyPage>
    </StoreLayout>
  );
}
