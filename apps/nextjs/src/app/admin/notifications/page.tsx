import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { desc, inArray, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Bill,
  NotificationAlert,
  NotificationDelivery,
  PushDevice,
} from "@acme/db/schema";
import { Button } from "@acme/ui/button";

import { getNotificationAdminAccess } from "~/auth/admin";
import { auth } from "~/auth/server";
import { NotificationComposer, ReceiptRefresh } from "./notification-console";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  const [bills, alerts, recipientRows] = await Promise.all([
    db
      .select({
        id: Bill.id,
        billNumber: Bill.billNumber,
        title: Bill.title,
      })
      .from(Bill)
      .orderBy(desc(Bill.sourceUpdatedAt), desc(Bill.createdAt))
      .limit(100),
    db
      .select()
      .from(NotificationAlert)
      .orderBy(desc(NotificationAlert.createdAt))
      .limit(20),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(PushDevice)
      .where(
        sql`${PushDevice.enabled} = true and ${PushDevice.breakingNews} = true`,
      ),
  ]);

  const alertIds = alerts.map((alert) => alert.id);
  const deliveries =
    alertIds.length === 0
      ? []
      : await db
          .select({
            alertId: NotificationDelivery.alertId,
            status: NotificationDelivery.status,
          })
          .from(NotificationDelivery)
          .where(inArray(NotificationDelivery.alertId, alertIds));

  return {
    bills,
    alerts: alerts.map((alert) => {
      const statuses = deliveries.filter(
        (delivery) => delivery.alertId === alert.id,
      );
      const count = (status: string) =>
        statuses.filter((delivery) => delivery.status === status).length;
      return {
        ...alert,
        queued: count("queued"),
        ticketed: count("ticketed"),
        delivered: count("delivered"),
        failed: count("failed"),
        total: statuses.length,
      };
    }),
    recipients: recipientRows[0]?.count ?? 0,
  };
}

function formatDate(date: Date | null) {
  if (!date) return "Not sent";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function NotificationAdminPage() {
  const access = await getNotificationAdminAccess();

  if (!access.session) {
    const signInAction = async () => {
      "use server";
      const result = await auth.api.signInSocial({
        body: {
          provider: "discord",
          callbackURL: "/admin/notifications",
        },
      });
      if (!result.url) throw new Error("Could not start Discord sign-in.");
      redirect(result.url);
    };

    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
        <div className="border-border bg-card w-full rounded-2xl border p-8 text-center">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
            Internal
          </p>
          <h1 className="mt-3 text-3xl">Notification console</h1>
          <p className="text-muted-foreground mt-3">
            Sign in with an authorized Billion account to continue.
          </p>
          <form action={signInAction} className="mt-6">
            <Button type="submit">Sign in with Discord</Button>
          </form>
        </div>
      </main>
    );
  }

  if (!access.configured || !access.authorized) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
        <div className="border-border bg-card w-full rounded-2xl border p-8">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
            Access denied
          </p>
          <h1 className="mt-3 text-3xl">Notification console</h1>
          <p className="text-muted-foreground mt-3">
            {access.configured
              ? `${access.session.user.email} is not on the notification admin allowlist.`
              : "Set BILLION_ADMIN_EMAILS to a comma-separated list of authorized account emails."}
          </p>
        </div>
      </main>
    );
  }

  const data = await getDashboardData();
  const signOutAction = async () => {
    "use server";
    await auth.api.signOut({ headers: await headers() });
    redirect("/admin/notifications");
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.14),transparent_32rem)]">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-red-400 uppercase">
              Billion newsroom
            </p>
            <h1 className="mt-2 text-4xl sm:text-5xl">Notification console</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl">
              Review and send breaking bill alerts to readers who explicitly
              opted in.
            </p>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out {access.session.user.name}
            </Button>
          </form>
        </header>

        <section aria-labelledby="compose-heading">
          <h2 id="compose-heading" className="sr-only">
            Compose an alert
          </h2>
          <NotificationComposer
            bills={data.bills}
            recipients={data.recipients}
          />
        </section>

        <section className="mt-12" aria-labelledby="history-heading">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
                Audit trail
              </p>
              <h2 id="history-heading" className="mt-2 text-3xl">
                Recent alerts
              </h2>
            </div>
            <ReceiptRefresh />
          </div>

          <div className="border-border overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Alert</th>
                  <th className="px-4 py-3 font-medium">Operator</th>
                  <th className="px-4 py-3 font-medium">Sent</th>
                  <th className="px-4 py-3 font-medium">Delivery</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.alerts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-muted-foreground px-4 py-10 text-center"
                    >
                      No alerts have been sent yet.
                    </td>
                  </tr>
                ) : (
                  data.alerts.map((alert) => (
                    <tr key={alert.id} className="bg-card/40 align-top">
                      <td className="max-w-md px-4 py-4">
                        <p className="font-semibold">{alert.title}</p>
                        <p className="text-muted-foreground mt-1 line-clamp-2">
                          {alert.body}
                        </p>
                      </td>
                      <td className="text-muted-foreground px-4 py-4">
                        {alert.operatorEmail ?? "API operator"}
                      </td>
                      <td className="text-muted-foreground px-4 py-4 whitespace-nowrap">
                        {formatDate(alert.sentAt)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p>{alert.delivered} delivered</p>
                        <p className="text-muted-foreground">
                          {alert.ticketed + alert.queued} pending ·{" "}
                          {alert.failed} failed · {alert.total} total
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <span className="bg-muted rounded-full px-2.5 py-1 text-xs font-semibold uppercase">
                          {alert.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
