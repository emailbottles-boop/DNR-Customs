"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ConfirmButton({ reference }: { reference: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    // Confirming charges the Wallet and starts printing; make it deliberate.
    if (!window.confirm(`Confirm ${reference} for production? This charges Printful billing and prints the garment.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Could not confirm.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button
        type="button"
        onClick={confirm}
        disabled={busy}
        className="btn btn-primary px-4 py-2 text-xs"
      >
        {busy ? "Confirming…" : "Confirm"}
      </button>
      {error ? <span className="label ml-3 text-alert">{error}</span> : null}
    </span>
  );
}
