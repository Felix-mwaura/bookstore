import Link from "next/link";

import { Bullets, ContactBlock, PolicyPage, Section } from "../components/PolicyPage";
import StoreLayout from "../components/StoreLayout";
import { DELIVERY_PERCENT, SITE_NAME, STORE_CONTACT } from "../lib/site";

export const metadata = {
  title: `Terms of sale · ${SITE_NAME}`,
  description:
    "The terms that apply when you buy a book from Book Haven: prices, availability, payment, delivery and accounts.",
  alternates: { canonical: "/terms" },
};

// Plain-language terms, matched to the implementation. Anything the code does
// not decide — a dispute process, a jurisdiction clause — is deliberately not
// invented here; it points at the contact route instead.

export default function TermsPage() {
  return (
    <StoreLayout>
      <PolicyPage
        eyebrow="Terms"
        title="Terms of sale"
        intro="What you are agreeing to when you buy a book here. Plain language, and short enough to actually read."
      >
        <Section id="orders" title="Placing an order">
          <p>
            An order is an offer to buy. It is accepted when we confirm it, which happens as soon as the order
            is saved — you will see an order reference at checkout and receive it by email.
          </p>
          <p>
            Prices, stock and availability can change. The price you pay is the one shown at the moment you
            confirm, and it is what gets recorded on the order; later price changes do not alter it.
          </p>
        </Section>

        <Section id="pricing" title="Prices and delivery">
          <p>
            All prices are in Kenyan shillings. Delivery is {DELIVERY_PERCENT}% of the book total, calculated
            and shown on the checkout page before payment. There are no other fees.
          </p>
          <p>
            If a title is listed at a price that is obviously wrong, we may cancel the order and refund any
            payment rather than fulfil it — and we will tell you that is what happened. You will never be
            charged an amount different from the one the checkout displayed.
          </p>
        </Section>

        <Section id="payment" title="Payment">
          <Bullets>
            <li><strong>M-Pesa:</strong> your order is saved once the payment is confirmed by Safaricom.</li>
            <li><strong>Cash on delivery:</strong> you pay the rider when the books arrive.</li>
          </Bullets>
          <p>
            If M-Pesa takes money but the order does not appear, contact us with the M-Pesa receipt number and
            do not pay again — the payment is recorded independently of the order and can be matched to it.
          </p>
        </Section>

        <Section id="cancellation" title="Cancelling">
          <p>
            Ask us to cancel and we will, as long as the order has not been dispatched. Once it is with the
            courier it can no longer be cancelled, but you can refuse the delivery — for cash on delivery,
            nothing is due.
          </p>
          <p>
            We may cancel an order if the book turns out to be unavailable, if the delivery details cannot be
            confirmed, or if a pricing error makes it impossible to honour. Any payment made is refunded.
          </p>
        </Section>

        <Section id="accounts" title="Accounts">
          <p>
            You are responsible for keeping your password to yourself. One account per person; do not share a
            login. Tell us immediately if you think someone else has used your account.
          </p>
          <p>
            We may suspend an account that is used to place fraudulent orders, to scrape the catalogue, or to
            post reviews that break the rules below.
          </p>
        </Section>

        <Section id="reviews" title="Reviews you write">
          <p>
            You keep the copyright in your review and give us permission to display it on the shop. We will not
            edit your words. We may hide or remove a review that contains abuse, personal information,
            advertising, or content unrelated to the book, and the book’s rating recalculates when we do.
          </p>
          <p>
            Do not post a review of a book you have not read, and do not post the same review more than once.
            Only one review per book per account is possible, by design.
          </p>
        </Section>

        <Section id="liability" title="Limits">
          <p>
            We are responsible for getting your order to the address you gave us, and for the condition it
            arrives in. We are not responsible for delays caused by the courier, by a wrong address, or by
            events outside our control — but we will always try to sort out what we can.
          </p>
          <p>
            Nothing here removes rights you have under Kenyan consumer law.
          </p>
        </Section>

        <Section id="changes" title="Changes to these terms">
          <p>
            If these terms change, the date at the top changes with them. The terms that applied to an order
            are the ones in force when it was placed. If you want to know more about something on this page,
            ask — see{" "}
            <Link href="/help" className="font-medium text-sienna underline-offset-2 hover:underline">the help page</Link>.
          </p>
        </Section>

        <ContactBlock contact={STORE_CONTACT} />
      </PolicyPage>
    </StoreLayout>
  );
}
