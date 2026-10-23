import Link from "next/link";

import StoreLayout from "../components/StoreLayout";
import { Bullets, ContactBlock, PolicyPage, Section } from "../components/PolicyPage";
import { DELIVERY_PERCENT, SITE_NAME, STORE_CONTACT, formatKsh, deliveryFeeFor } from "../lib/site";

export const metadata = {
  title: `Help, delivery and returns · ${SITE_NAME}`,
  description:
    "How delivery is priced, how to pay with M-Pesa or cash on delivery, how to track an order, and how to reach Book Haven.",
  alternates: { canonical: "/help" },
};

// Every claim on this page is checkable in the code, which is the point.
// The delivery percentage is imported from the same constant that prices the
// checkout, so this page cannot drift from what the customer is charged.
// Where the shop has no policy yet (for example a fixed returns window), the
// page says "ask us" instead of inventing a promise nobody has agreed to.

export default function HelpPage() {
  const example = 1500;
  return (
    <StoreLayout>
      <PolicyPage
        eyebrow="Help"
        title="Delivery, payment and returns"
        intro="Short answers, in the same words we would use on the phone. If something here does not match what happened to your order, tell us — this page is meant to be true, not reassuring."
      >
        <Section id="delivery" title="Delivery">
          <p>
            Delivery is <strong>{DELIVERY_PERCENT}% of the book total</strong> on every order, added at checkout
            and shown before you pay. A {formatKsh(example)} order is {formatKsh(deliveryFeeFor(example))} to deliver.
          </p>
          <p>
            We deliver anywhere in Kenya. Orders are packed from Nairobi and handed to a rider or courier once
            payment is confirmed (or, for cash on delivery, once the order is placed).
          </p>
          <p className="text-muted">
            The exact day depends on where you are and on the courier — we do not publish a delivery window
            we cannot keep. Your order page shows its current stage, and the rider calls the number you gave
            before arriving.
          </p>
        </Section>

        <Section id="payment" title="Paying">
          <Bullets>
            <li>
              <strong>M-Pesa.</strong> At checkout we send a payment request to your phone; enter your PIN there
              and the order is saved once the payment is confirmed.
            </li>
            <li>
              <strong>Cash on delivery.</strong> Choose this and nothing is due until the books are in your hands.
            </li>
          </Bullets>
          <p>
            Prices are in Kenyan shillings and never change after you place an order: the record keeps the
            price you agreed to, even if the shop price changes later.
          </p>
        </Section>

        <Section id="tracking" title="Your order, and its status">
          <p>
            Every order has an order page — open it from{" "}
            <Link href="/account" className="font-medium text-sienna underline-offset-2 hover:underline">your account</Link>{" "}
            or from the confirmation you saw at checkout. It shows the current stage, what you paid, and what
            is still due.
          </p>
          <p>
            An order can be cancelled while it has not been dispatched. If you need to change an address after
            ordering, call us with the order reference rather than placing a second order.
          </p>
        </Section>

        <Section id="returns" title="Damaged or wrong books">
          <p>
            If a book arrives damaged, or is not the one you ordered, contact us with the order reference and a
            photo of what arrived. We will replace it or sort it out with you.
          </p>
          <p className="text-muted">
            We have not published a fixed “returns within N days” rule, because a number on a page is a promise
            the shop has to keep whether or not it makes sense for a particular case. Tell us what happened and
            we will be straight with you about what we can do.
          </p>
        </Section>

        <Section id="reviews" title="Reviews">
          <p>
            Only signed-in customers can post a review, one per book per account. Reviews are shown with your
            first name and initial, and a “Verified purchase” badge appears only when we can match the book to
            an order that was actually delivered.
          </p>
          <p>
            Your words are never edited. A moderator can hide a review that breaks the rules below, which takes
            it off the shop, and you can edit or delete your own review at any time from the book page.
          </p>
          <Bullets>
            <li>Write about the book — the writing, the edition, whether it was worth the money.</li>
            <li>No personal attacks, no contact details, no advertising, no spoilers in the headline.</li>
            <li>One review per book; edit rather than posting a second one.</li>
          </Bullets>
        </Section>

        <Section id="errors" title="If a price or detail looks wrong">
          <p>
            We would rather you told us than quietly paid. If a book is listed at a price that is clearly a
            mistake, contact us before ordering — we may cancel and refund an order priced in error rather than
            honour it, and we will always tell you which is happening.
          </p>
        </Section>

        <ContactBlock contact={STORE_CONTACT} />
      </PolicyPage>
    </StoreLayout>
  );
}
