import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import "./account-delete.css";

const REASONS = [
  ["no_longer_need", "I no longer need Quest"],
  ["not_useful", "Quest wasn't useful enough for me"],
  ["hard_to_use", "Quest was too hard or confusing to use"],
  ["missing_features", "A feature I need is missing"],
  ["bugs_performance", "Bugs or performance problems"],
  ["privacy_concerns", "Privacy concerns"],
  ["other", "Something else"],
  ["prefer_not_to_say", "Prefer not to say"],
];

function clearDeletedAccountLocalData() {
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      if (
        key.startsWith("quest-offline-v") ||
        key === "sb-nagxpuqdurdcogzudblo-auth-token"
      ) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Browser storage cleanup is best-effort after the server confirms deletion.
  }
}

export default function AccountDeleteCard({ disabled = false, onBusyChange }) {
  const dialogRef = useRef(null);
  const running = useRef(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const resetForm = () => {
    setReason("");
    setDetails("");
    setPassword("");
    setConfirmation("");
    setError("");
  };

  const close = () => {
    if (running.current) return;
    setOpen(false);
  };

  const openDialog = () => {
    resetForm();
    setOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (running.current) return;

    if (!reason) {
      setError("Choose a reason, or select “Prefer not to say.”");
      return;
    }
    if (!password) {
      setError("Enter your current password to verify it is really you.");
      return;
    }
    if (confirmation.trim() !== "DELETE") {
      setError("Type DELETE exactly to confirm.");
      return;
    }

    running.current = true;
    setBusy(true);
    setError("");
    onBusyChange?.(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData?.user;
      if (userError || !user?.email) {
        throw new Error("Your session could not be verified. Please sign in again.");
      }

      const { error: passwordError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (passwordError) {
        throw new Error("Your current password is incorrect.");
      }

      const { data, error: invokeError } = await supabase.functions.invoke("delete-account", {
        body: {
          confirmation: "DELETE",
          reason_code: reason,
          reason_text: details.trim().slice(0, 500),
        },
      });

      if (invokeError || !data?.deleted) {
        throw new Error(data?.error || "Quest could not delete your account. Please try again.");
      }

      clearDeletedAccountLocalData();
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // The server account is already gone; local cleanup above is enough.
      }

      window.location.replace("/");
    } catch (failure) {
      setError(failure?.message || "Quest could not delete your account. Please try again.");
      running.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  };

  return (
    <section className="qd-home-settings-card qd-account-delete-card" aria-labelledby="qd-account-delete-title">
      <h2 id="qd-account-delete-title">Delete account</h2>
      <p>
        Permanently delete your Quest login and personal data instead of just resetting your progress.
      </p>
      <button
        type="button"
        className="qd-account-delete-danger"
        disabled={disabled || busy}
        onClick={openDialog}
      >
        Delete my account
      </button>

      <dialog
        ref={dialogRef}
        className="qd-account-delete-dialog"
        aria-labelledby="qd-account-delete-dialog-title"
        onCancel={(event) => {
          if (running.current) event.preventDefault();
          else setOpen(false);
        }}
        onClose={close}
      >
        <form onSubmit={submit} aria-busy={busy}>
          <p className="qd-account-delete-eyebrow">Before you go</p>
          <h2 id="qd-account-delete-dialog-title">Delete your Quest account?</h2>

          <p>
            This permanently deletes your login, quests, tasks, anchors, timing history, progress,
            farm, profile, friendships, notification subscriptions and your participation in Quest
            competitions. Competitions you created may also be removed.
          </p>
          <p>This cannot be undone. If you only want a fresh start, use Restart account instead.</p>

          <fieldset disabled={busy}>
            <legend>What made you decide to leave?</legend>
            <p className="qd-account-delete-helper">
              This feedback is stored without your user ID or email after deletion.
            </p>
            <div className="qd-account-delete-reasons">
              {REASONS.map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="delete-reason"
                    value={value}
                    checked={reason === value}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label htmlFor="qd-account-delete-details">
            Anything else you want us to know? <span>(optional)</span>
          </label>
          <textarea
            id="qd-account-delete-details"
            value={details}
            onChange={(event) => setDetails(event.target.value.slice(0, 500))}
            maxLength={500}
            rows={4}
            disabled={busy}
            placeholder="Your feedback can help make Quest better."
          />
          <small>{details.length}/500</small>

          <label htmlFor="qd-account-delete-password">Current password</label>
          <input
            id="qd-account-delete-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
            autoComplete="current-password"
          />

          <label htmlFor="qd-account-delete-confirmation">
            Type <strong>DELETE</strong> to confirm permanent deletion
          </label>
          <input
            id="qd-account-delete-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={busy}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />

          {error && <p className="qd-account-delete-error" role="alert">{error}</p>}
          {busy && <p role="status">Deleting your Quest account… Keep this page open.</p>}

          <div className="qd-account-delete-actions">
            <button type="button" disabled={busy} onClick={close} autoFocus>
              Keep my account
            </button>
            <button
              type="submit"
              className="qd-account-delete-danger"
              disabled={busy || !reason || !password || confirmation.trim() !== "DELETE"}
            >
              {busy ? "Deleting…" : "Permanently delete account"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
