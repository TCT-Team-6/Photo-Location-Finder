import { useState, type FormEvent } from "react";
import { useSignIn, useUser } from "@clerk/react";
import { Link } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Receives a one-use Clerk ticket, never the agent's long-lived access key. */
export default function TesterLoginPage() {
  const { signIn } = useSignIn();
  const { isLoaded, isSignedIn } = useUser();
  const [ticket, setTicket] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function redeem(event: FormEvent) {
    event.preventDefault();
    if (busy || !isLoaded || isSignedIn || !ticket.trim()) return;
    setBusy(true);
    setError("");
    const value = ticket.trim();
    setTicket("");
    try {
      const result = await signIn.ticket({ ticket: value });
      if (result.error || signIn.status !== "complete") {
        setError("Ticket was not accepted or another authentication step is required. Request a new ticket.");
        return;
      }
      const final = await signIn.finalize({
        navigate: ({ session }) => {
          if (session?.currentTask) {
            setError("Clerk requires an additional account step. Complete it through normal sign-in.");
            return;
          }
          window.location.assign(`${basePath}/investigate`);
        },
      });
      if (final?.error) setError("Could not activate the session. Request a new ticket.");
    } catch {
      setError("Tester sign-in failed. Request a new ticket and try again.");
    } finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-xl px-6 py-12">
    <Link href="/sign-in" className="underline">Back to regular sign-in</Link>
    <h1 className="mt-8 text-3xl font-semibold">Tester sign-in</h1>
    <p className="mt-4 text-lg">For authorized automation agents. Use a fresh browser context and a one-use sign-in ticket.</p>
    {isSignedIn ? <p className="mt-6" role="alert">This browser is already signed in. Open a fresh browser context to avoid testing with the wrong account.</p> :
      <form className="mt-6 space-y-4" onSubmit={redeem}>
        <label className="block" htmlFor="tester-ticket">One-use sign-in ticket</label>
        <input id="tester-ticket" data-testid="input-tester-ticket" type="password" autoComplete="off" spellCheck={false} value={ticket} maxLength={16384}
          onChange={(e) => setTicket(e.target.value)} className="w-full border border-current px-4 py-3" required />
        <p className="text-[13px]">Do not enter your development or production access key here. Tickets expire after 60 seconds.</p>
        <button type="submit" data-testid="button-tester-sign-in" disabled={!isLoaded || busy || !ticket.trim()}
          className="border border-current px-5 py-3 font-semibold disabled:opacity-50">{busy ? "Signing in…" : "Sign in as tester"}</button>
      </form>}
    {error && <p role="alert" data-testid="tester-login-error" className="mt-5">{error}</p>}
  </main>;
}
