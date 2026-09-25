import { useEffect, useRef, useState } from "react";
import "./account-reset.css";

export default function AccountResetCard({ onReset, disabled = false, onBusyChange }) {
  const dialogRef = useRef(null);
  const running = useRef(false);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => { if (!running.current) setOpen(false); };
  const submit = async (event) => {
    event.preventDefault();
    if (running.current || confirmation.trim() !== "RESET") return;
    running.current = true;
    setBusy(true); setError(""); onBusyChange?.(true);
    try {
      await onReset();
      setOpen(false);
      setConfirmation("");
      setMessage("A fresh start: level 1, 0 XP. Add your first quest or daily anchor when you’re ready.");
    } catch (failure) {
      setError(failure?.message || "Your restart could not be confirmed. Please try again.");
    } finally {
      running.current = false;
      setBusy(false); onBusyChange?.(false);
    }
  };

  return (
    <section className="qd-home-settings-card qd-account-reset-card" aria-labelledby="qd-account-reset-title">
      <h2 id="qd-account-reset-title">Start from zero</h2>
      <p>Clear your quests, tasks, daily anchors, and progress to begin again.</p>
      <button type="button" className="qd-account-reset-danger" disabled={disabled || busy} onClick={() => {
        setConfirmation(""); setError(""); setMessage(""); setOpen(true);
      }}>Restart account</button>
      {message && <p className="qd-account-reset-success" role="status">{message}</p>}

      <dialog ref={dialogRef} className="qd-account-reset-dialog" aria-labelledby="qd-account-reset-dialog-title" aria-describedby="qd-account-reset-description" onCancel={(event) => {
        if (running.current) event.preventDefault(); else setOpen(false);
      }} onClose={close}>
        <form onSubmit={submit} aria-busy={busy}>
          <p className="qd-account-reset-eyebrow">A new beginning</p>
          <h2 id="qd-account-reset-dialog-title">Restart your account?</h2>
          <div id="qd-account-reset-description">
            <p>This permanently deletes all your quests, tasks, daily anchors, completion history, rewards, and Stop Day history. XP and streaks return to zero, your level returns to 1, and settings return to their defaults.</p>
            <p>Your login stays the same. This clears your saved progress across devices and cannot be undone.</p>
          </div>
          <label htmlFor="qd-account-reset-confirmation">Type <strong>RESET</strong> to confirm</label>
          <input id="qd-account-reset-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
          {error && <p className="qd-account-reset-error" role="alert">{error}</p>}
          {busy && <p role="status">Restarting your account… Keep Quest open.</p>}
          <div className="qd-account-reset-actions">
            <button type="button" disabled={busy} onClick={close} autoFocus>Keep my progress</button>
            <button type="submit" className="qd-account-reset-danger" disabled={busy || confirmation.trim() !== "RESET"}>{busy ? "Restarting…" : "Delete everything & restart"}</button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
