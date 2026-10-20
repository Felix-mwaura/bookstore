import { notFound, redirect } from "next/navigation";
import StoreLayout from "../../components/StoreLayout";
import OrderView from "../../components/OrderView";
import { supabaseServer, getServerUser } from "../../lib/supabase-server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Order details · Book Haven",
  // A customer's order is private; it must never be indexed or previewed.
  robots: { index: false, follow: false },
};

export default async function OrderPage({ params }) {
  const { id } = await params;

  const { user } = await getServerUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/orders/${id}`)}`);
  }

  // This query runs as the customer, not as the service role. RLS only
  // returns their own order, so another customer's id is indistinguishable
  // from a missing one — no confirmation that an order exists.
  const supabase = await supabaseServer();
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !order) notFound();

  return (
    <StoreLayout>
      <OrderView order={order} />
    </StoreLayout>
  );
}
