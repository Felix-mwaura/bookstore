import Link from "next/link";
import { BookCover } from "./BookCover";
import { BuyAgainButton, ReviewPrompt } from "./OrderActions";
import {
  FULFILMENT_STEPS,
  FULFILMENT_META,
  PAYMENT_META,
  fulfilmentStepIndex,
  orderReference,
  paymentDue,
  toneClass,
} from "../lib/orders";
import { formatKsh } from "../lib/site";

// Pure presentation for one order. Kept apart from the page so the layout can
// be rendered and checked without a live session, and so the money/timeline
// logic has exactly one implementation.
function formatDate(value, withTime = false) {
  if (!value) return null;
  return new Date(value).toLocaleString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function Timeline({ status }) {
  const current = fulfilmentStepIndex(status);
  return (
    <ol className="relative">
      {FULFILMENT_STEPS.map((step, index) => {
        const done = index <= current;
        const active = index === current;
        return (
          <li key={step.key} className="flex gap-4 pb-6 last:pb-0">
            <div className="flex flex-col items-center">
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0 ${
                  done ? "bg-sienna border-sienna text-white" : "bg-white border-line-strong text-muted"
                }`}
                aria-hidden="true"
              >
                {done ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              {index < FULFILMENT_STEPS.length - 1 && (
                <span className={`w-0.5 flex-1 mt-1 ${index < current ? "bg-sienna" : "bg-line"}`} aria-hidden="true" />
              )}
            </div>
            <div className="pt-1 pb-1">
              <p className={`text-sm font-bold ${active ? "text-sienna" : done ? "text-navy" : "text-muted"}`}>
                {step.label}
                {active && <span className="ml-2 text-micro font-semibold uppercase text-sienna">Current</span>}
              </p>
              <p className="text-xs text-muted mt-0.5">{step.hint}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function OrderView({ order }) {
  const items = Array.isArray(order.items) ? order.items : [];
  const status = FULFILMENT_META[order.status] || { label: order.status, tone: "stone" };
  const payment = PAYMENT_META[order.payment_status] || { label: order.payment_status, tone: "stone" };
  const details = order.delivery_details || {};
  const cancelled = order.status === "Cancelled";

  return (
    <>
      <div className="shell max-w-[62rem] py-8 sm:py-12">
        <Link href="/account" className="text-sm text-muted hover:text-sienna">← Back to my account</Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-playfair text-title font-bold text-navy">Order {orderReference(order.id)}</h1>
            <p className="mt-1 text-small text-muted">Placed {formatDate(order.created_at, true)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BuyAgainButton items={items} className="w-full sm:w-auto" />
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${toneClass(status.tone)}`}>{status.label}</span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${toneClass(payment.tone)}`}>{payment.label}</span>
          </div>
        </div>

        {cancelled && (
          <div className="mt-6 border border-error/30 bg-error/5 rounded-card p-5">
            <p className="font-bold text-error">This order was cancelled</p>
            <p className="text-sm text-error mt-1">
              {formatDate(order.cancelled_at, true) ? `Cancelled ${formatDate(order.cancelled_at, true)}. ` : ""}
              Any stock reserved for it has been returned to the shelf. If you were charged, the refund is tracked on this order.
            </p>
          </div>
        )}

        {paymentDue(order) && !cancelled && (
          <div className="mt-6 border border-warning/40 bg-warning/10 rounded-card p-5">
            <p className="font-bold text-warning-strong">
              {order.payment_method === "cod" ? "Payment on delivery" : "Payment not confirmed yet"}
            </p>
            <p className="text-sm text-warning-strong mt-1">
              {order.payment_method === "cod"
                ? "You will pay the rider in cash when your books arrive. Nothing is due before then."
                : "We have not received confirmation of this payment. If you were charged, contact us with the reference below before paying again."}
            </p>
          </div>
        )}

        <div className="mt-8 grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-6">
            <section className="bg-white border border-line rounded-card p-5 sm:p-6">
              <h2 className="font-bold text-navy mb-4">Items</h2>
              <ul className="space-y-3">
                {items.map((item, index) => (
                  <li key={`${item.id ?? "item"}-${index}`} className="flex gap-3 items-center">
                    <div className="w-12 rounded-r-sm overflow-hidden shrink-0" style={{ aspectRatio: "2/3" }}>
                      <BookCover book={item} className="w-full h-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy truncate">{item.title}</p>
                      <p className="text-xs text-muted">
                        {item.author} · Qty {item.quantity || 1} × {formatKsh(item.price)}
                      </p>
                      {order.status === "Delivered" && (
                        <p className="mt-1"><ReviewPrompt item={item} /></p>
                      )}
                    </div>
                    <p className="text-sm font-bold shrink-0">{formatKsh((item.price || 0) * (item.quantity || 1))}</p>
                  </li>
                ))}
              </ul>

              <dl className="mt-5 pt-4 border-t border-line space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="font-semibold">{formatKsh(order.subtotal)}</dd></div>
                <div className="flex justify-between">
                  <dt className="text-muted">Delivery</dt>
                  <dd className="font-semibold">{Number(order.delivery_fee) > 0 ? formatKsh(order.delivery_fee) : <span className="text-success">Free</span>}</dd>
                </div>
                <div className="flex justify-between pt-2 border-t border-line text-base">
                  <dt className="font-bold">Total</dt>
                  <dd className="font-black">{formatKsh(order.total)}</dd>
                </div>
              </dl>

              <div className="mt-4 pt-4 border-t border-line text-sm">
                <p className="text-muted">
                  Payment method: <span className="text-ink font-semibold">{{
                    cod: "Cash on delivery",
                    mpesa: "M-Pesa",
                  }[order.payment_method] || order.payment_method}</span>
                </p>
                {order.payment_ref && (
                  <p className="text-muted mt-1">
                    Transaction reference: <span className="font-mono font-semibold text-ink">{order.payment_ref}</span>
                  </p>
                )}
              </div>
            </section>

            <section className="bg-white border border-line rounded-card p-5 sm:p-6">
              <h2 className="font-bold text-navy mb-4">Delivery</h2>
              <p className="text-sm font-semibold text-navy">{details.firstName} {details.lastName}</p>
              <p className="mt-1 text-small text-muted">{details.address}</p>
              <p className="text-small text-muted">{details.city}</p>
              <p className="mt-1 text-small text-muted">{details.phone}</p>
              {details.email && <p className="text-sm text-muted">{details.email}</p>}
              {(details.instructions || details.notes) && (
                <p className="text-sm text-muted mt-2 italic">“{details.instructions || details.notes}”</p>
              )}

              {(order.courier || order.tracking_ref) && (
                <div className="mt-4 pt-4 border-t border-line text-sm">
                  {order.courier && <p className="text-muted">Courier: <span className="font-semibold text-ink">{order.courier}</span></p>}
                  {order.tracking_ref && (
                    <p className="text-muted mt-1">Tracking: <span className="font-mono font-semibold text-ink">{order.tracking_ref}</span></p>
                  )}
                </div>
              )}
            </section>
          </div>

          <aside className="bg-white border border-line rounded-card p-5 sm:p-6 h-fit">
            <h2 className="font-bold text-navy mb-4">Progress</h2>
            {cancelled ? (
              <p className="text-sm text-muted">This order was cancelled and will not progress further.</p>
            ) : (
              <Timeline status={order.status} />
            )}

            <div className="mt-5 pt-4 border-t border-line text-xs text-muted space-y-1">
              {order.dispatched_at && <p>Dispatched {formatDate(order.dispatched_at)}</p>}
              {order.delivered_at && <p>Delivered {formatDate(order.delivered_at)}</p>}
              <p>Last updated {formatDate(order.updated_at, true)}</p>
            </div>

            <p className="mt-4 text-xs text-muted">
              Quote <span className="font-mono font-bold text-ink">{orderReference(order.id)}</span> when contacting support.
            </p>
          </aside>
        </div>
      </div>
    </>
  );
}
