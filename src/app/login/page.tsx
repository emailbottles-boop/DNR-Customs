"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        router.push("/admin");
        router.refresh();
        return;
      }
      setError(
        response.status === 404
          ? "Admin is not enabled on this deployment."
          : "Wrong password.",
      );
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60svh] max-w-6xl items-center px-5 sm:px-8">
      <form onSubmit={submit} className="w-full max-w-sm">
        <h1 className="display text-4xl">Back of house</h1>
        <label className="label mt-10 block" htmlFor="admin-password">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="field-input mt-3 w-full"
        />
        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="btn btn-primary mt-6 w-full"
        >
          {busy ? "Checking…" : "Enter"}
        </button>
        <p role="alert" className="label mt-4 h-5 text-alert">
          {error ?? ""}
        </p>
      </form>
    </div>
  );
}
