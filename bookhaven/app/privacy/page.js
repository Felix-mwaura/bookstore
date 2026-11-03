import { Bullets, ContactBlock, PolicyPage, Section } from "../components/PolicyPage";
import StoreLayout from "../components/StoreLayout";
import { SITE_NAME, STORE_CONTACT } from "../lib/site";

export const metadata = {
  title: `Privacy · ${SITE_NAME}`,
  description:
    "What Book Haven collects when you order a book, why it is collected, who can see it, and how to have it removed.",
  alternates: { canonical: "/privacy" },
};

// Written from what the application actually does — the columns that exist,
// the emails that are sent, the roles that can read them. It is deliberately
// specific: "we value your privacy" is not a privacy policy.

export default function PrivacyPage() {
  return (
    <StoreLayout>
      <PolicyPage
        title="What we keep, and why"
        intro="This page describes the data this shop actually stores. It is short because the shop does not do very much with it."
      >
        <Section id="account" title="If you create an account">
          <p>We store:</p>
          <Bullets>
            <li>your email address and a securely hashed password (we never see the password itself);</li>
            <li>the first name, last name and phone number you enter on your account page;</li>
            <li>addresses you choose to save in your address book;</li>
            <li>books on your saved list, and the reviews you write.</li>
          </Bullets>
          <p>
            Signing in is handled by Supabase, which stores the account record. Passwords are hashed by that
            service before storage.
          </p>
        </Section>

        <Section id="orders" title="When you order">
          <p>An order stores the books, quantities and prices at the time you bought, plus:</p>
          <Bullets>
            <li>the delivery name, phone number, email, address and town you entered;</li>
            <li>any note you added for the rider;</li>
            <li>the payment method and its status, and — for M-Pesa — the M-Pesa receipt reference.</li>
          </Bullets>
          <p>
            We do not ask for, receive or store card numbers. M-Pesa payments are requested through Safaricom’s
            Daraja API; your PIN is entered on your own phone and never reaches this site.
          </p>
        </Section>

        <Section id="who" title="Who can see it">
          <Bullets>
            <li>
              <strong>You</strong> — your orders, addresses, saved books and reviews are readable only by the
              account that owns them. The database enforces this, not just the screens.
            </li>
            <li>
              <strong>The shop’s administrators</strong> — they can see orders (they have to, to pack and
              deliver them), customer accounts, and reviews. Customer reviews are shown publicly under your
              first name and initial; your email and phone number are not published anywhere.
            </li>
            <li>
              <strong>Nobody else</strong> — the site does not sell, rent or share customer data with
              advertisers, and it does not run advertising trackers.
            </li>
          </Bullets>
        </Section>

        <Section id="email" title="Email">
          <p>
            If the shop&apos;s mail service is configured, you get an email when an order is placed and when its
            status changes, plus a password-reset link if you ask for one. Those messages go only to the address
            on the order or the account.
          </p>
          <p className="text-muted">
            The announcement list is not open yet. The form that collects addresses stays closed until the shop
            has a published way to contact it, because being able to leave a list is part of being on it. When it
            opens, every message will say how to stop receiving them, and your address will never be shared or
            sold.
          </p>
        </Section>

        <Section id="cookies" title="Cookies and local storage">
          <p>
            There are no advertising or analytics cookies. The browser stores your basket and saved books in
            local storage so they survive a refresh, and holds a session token while you are signed in. Signing
            out clears the session; clearing site data removes the rest.
          </p>
        </Section>

        <Section id="removal" title="Removing your data">
          <p>
            Ask us and we will delete your account. Deleting the account removes your profile, your delivery
            addresses, your saved books, your reviews (including from the ratings on those books), and your
            order history.
          </p>
          <p className="text-muted">
            Two things survive, and you should know about them before asking. M-Pesa payment records are kept
            for accounting, but they are detached from your account when it is deleted — the amount, receipt
            number and phone number the payment was made from remain, as they must for a shop to account for
            money received. Order emails already sent are in your inbox, outside our control. If you want a
            copy of your order history, ask for it before the account is removed.
          </p>
        </Section>

        <ContactBlock contact={STORE_CONTACT} />
      </PolicyPage>
    </StoreLayout>
  );
}
