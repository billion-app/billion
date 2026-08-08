"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";
import { Label } from "@acme/ui/label";

import type { AdminActionState } from "./actions";
import { refreshAdminReceipts, sendAdminAlert } from "./actions";

interface BillOption {
  id: string;
  billNumber: string;
  title: string;
}

const initialState: AdminActionState = { status: "idle" };

function SubmitButton({ recipients }: { recipients: number }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="destructive"
      className="w-full sm:w-auto"
      disabled={pending}
    >
      {pending
        ? "Sending…"
        : `Send now to ${recipients} device${recipients === 1 ? "" : "s"}`}
    </Button>
  );
}

function ReceiptButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? "Checking…" : "Check receipts"}
    </Button>
  );
}

function ActionMessage({ state }: { state: AdminActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={
        state.status === "error"
          ? "text-destructive text-sm"
          : "text-sm text-emerald-400"
      }
    >
      {state.message}
    </p>
  );
}

export function NotificationComposer({
  bills,
  recipients,
}: {
  bills: BillOption[];
  recipients: number;
}) {
  const [state, action] = useActionState(sendAdminAlert, initialState);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(bills[0]?.id ?? "");
  const [title, setTitle] = useState("BREAKING");
  const [body, setBody] = useState("");
  const filteredBills = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return bills;
    return bills.filter((bill) =>
      `${bill.billNumber} ${bill.title}`.toLowerCase().includes(normalized),
    );
  }, [bills, query]);
  const selectedBill = bills.find((bill) => bill.id === selectedId);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <form
        key={state.resetKey ?? "composer"}
        action={action}
        className="border-border bg-card/60 space-y-5 rounded-2xl border p-5 shadow-xl shadow-black/10 sm:p-7"
      >
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
            Compose
          </p>
          <h2 className="mt-2 text-2xl">Breaking bill alert</h2>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bill-search">Find a bill</Label>
          <Input
            id="bill-search"
            type="search"
            placeholder="Search by bill number or title"
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              const normalized = nextQuery.trim().toLowerCase();
              const firstMatch = bills.find((bill) =>
                `${bill.billNumber} ${bill.title}`
                  .toLowerCase()
                  .includes(normalized),
              );
              if (firstMatch) setSelectedId(firstMatch.id);
            }}
          />
          <select
            id="contentId"
            name="contentId"
            required
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            className="border-input bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 min-h-11 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
          >
            {filteredBills.length === 0 ? (
              <option value="">No matching bills</option>
            ) : null}
            {filteredBills.map((bill) => (
              <option key={bill.id} value={bill.id}>
                {bill.billNumber} — {bill.title}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">
            Opening the push routes directly to this bill in the app.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="title">Push title</Label>
            <span className="text-muted-foreground font-mono text-xs">
              {title.length}/100
            </span>
          </div>
          <Input
            id="title"
            name="title"
            required
            maxLength={100}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="body">Message</Label>
            <span className="text-muted-foreground font-mono text-xs">
              {body.length}/240
            </span>
          </div>
          <textarea
            id="body"
            name="body"
            required
            maxLength={240}
            rows={4}
            placeholder="What changed, and why does it matter?"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="border-input bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-y rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
          />
        </div>

        <label className="border-border bg-background/40 flex cursor-pointer gap-3 rounded-xl border p-4">
          <input
            type="checkbox"
            name="confirmation"
            value="confirmed"
            required
            className="mt-1 size-4 accent-red-500"
          />
          <span className="text-sm leading-6">
            I reviewed this alert and understand it will immediately notify{" "}
            <strong>
              {recipients} opted-in device{recipients === 1 ? "" : "s"}
            </strong>
            .
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton recipients={recipients} />
          <ActionMessage state={state} />
        </div>
      </form>

      <aside className="space-y-4">
        <div className="border-border bg-card rounded-[2rem] border p-4 shadow-2xl shadow-black/20">
          <div className="rounded-[1.5rem] bg-black p-4">
            <div className="mb-3 flex items-center justify-between text-[11px] text-white/55">
              <span>Billion</span>
              <span>now</span>
            </div>
            <p className="text-sm font-semibold text-white">
              {title || "Push title"}
            </p>
            <p className="mt-1 text-sm leading-5 text-white/75">
              {body || "Your alert copy will appear here."}
            </p>
          </div>
        </div>
        <div className="border-border bg-card/60 rounded-2xl border p-5">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
            Destination
          </p>
          <p className="mt-2 text-sm font-semibold">
            {selectedBill?.billNumber ?? "Choose a bill"}
          </p>
          <p className="text-muted-foreground mt-1 line-clamp-3 text-sm">
            {selectedBill?.title ?? "The selected bill title will appear here."}
          </p>
        </div>
      </aside>
    </div>
  );
}

export function ReceiptRefresh() {
  const [state, action] = useActionState(refreshAdminReceipts, initialState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <ReceiptButton />
      <ActionMessage state={state} />
    </form>
  );
}
