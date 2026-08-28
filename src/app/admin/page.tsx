import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  ADMIN_COOKIE,
  adminEnabled,
  verifySessionToken,
} from "@/lib/admin/auth";
import { listAdminOrders } from "@/lib/admin/orders";
import { config } from "@/lib/config";
import { isDemoCatalog } from "@/lib/printful/store";
import { ConfirmButton } from "./confirm-button";
import { LogoutButton } from "./logout-button";

export const metadata: Metadata = {
  title: "Back of house",
  robots: { index: false, follow: false },
};

// Reads cookies and live order state; never prerendered.
export const dynamic = "force-dynamic";

function formatDate(seconds: number | null): string {
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminPage() {
  if (!adminEnabled()) notFound();

  const jar = await cookies();
  if (!verifySessionToken(jar.get(ADMIN_COOKIE)?.value)) redirect("/login");

  const orders = await listAdminOrders();
  const actionable = orders.filter(
    (order) => order.status === "draft" && order.payment?.paid,
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-hairline py-6">
        <h1 className="display text-4xl">Back of house</h1>
        <LogoutButton />
      </div>

      <div className="mt-10 flex flex-wrap gap-x-12 gap-y-4 border-b border-hairline pb-8">
        <div>
          <p className="label">Mode</p>
          <p className="mt-1 text-sm text-bone">
            {config.preorderMode ? "Pre-order — drafts held for manual confirm" : "Instant — webhook confirms on payment"}
          </p>
        </div>
        <div>
          <p className="label">Awaiting confirm</p>
          <p className="mt-1 text-sm text-bone">{actionable}</p>
        </div>
        <div>
          <p className="label">Orders shown</p>
          <p className="mt-1 text-sm text-bone">{orders.length}</p>
        </div>
      </div>

      {isDemoCatalog() ? (
        <p className="label mt-10 text-bone-faint">
          Demo mode — no Printful key, so there are no live orders to show.
        </p>
      ) : orders.length === 0 ? (
        <p className="label mt-10 text-bone-faint">No orders yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline">
                <th className="label py-3 pr-6 font-normal">Reference</th>
                <th className="label py-3 pr-6 font-normal">Placed</th>
                <th className="label py-3 pr-6 font-normal">Ship to</th>
                <th className="label py-3 pr-6 font-normal">Units</th>
                <th className="label py-3 pr-6 font-normal">Payment</th>
                <th className="label py-3 pr-6 font-normal">Printful</th>
                <th className="label py-3 font-normal">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const paid = order.payment?.paid ?? false;
                return (
                  <tr key={order.printfulId} className="border-b border-hairline">
                    <td className="py-4 pr-6 font-mono text-xs text-bone">
                      {order.reference ?? `#${order.printfulId}`}
                    </td>
                    <td className="py-4 pr-6 text-bone-soft">
                      {formatDate(order.created)}
                    </td>
                    <td className="py-4 pr-6 text-bone-soft">
                      {order.recipientName ?? "—"}
                      {order.recipientPlace ? (
                        <span className="text-bone-faint"> · {order.recipientPlace}</span>
                      ) : null}
                    </td>
                    <td className="py-4 pr-6 text-bone-soft">{order.units}</td>
                    <td className="py-4 pr-6">
                      {order.payment === null ? (
                        <span className="label text-bone-faint">No payment found</span>
                      ) : paid ? (
                        <span className="label text-bone">Paid</span>
                      ) : (
                        <span className="label text-alert">Unpaid</span>
                      )}
                    </td>
                    <td className="py-4 pr-6">
                      <span className={`label ${order.status === "draft" ? "text-bone-faint" : "text-bone"}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-4">
                      {order.status === "draft" && paid ? (
                        <ConfirmButton reference={order.reference ?? ""} />
                      ) : order.status === "draft" ? (
                        <span className="label text-bone-faint">Hold</span>
                      ) : (
                        <span className="label text-bone-faint">Done</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="label mt-10 text-bone-faint">
        Confirm charges Printful billing and starts production. Unpaid drafts
        are abandoned checkouts — they cost nothing and can be ignored.
      </p>
    </div>
  );
}
