import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import "./PasswordRecovery.css";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readRecoveryError() {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return (
    search.get("error_description") ||
    hash.get("error_description") ||
    search.get("error") ||
    hash.get("error") ||
    ""
  );
}

export default function PasswordRecovery({ onComplete, onCancel }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState(() => readRecoveryError());

  const passwordIssue = useMemo(() => {
    if (!password) return "";
    if (password.length < 8) return "Use at least 8 characters.";
    if (confirmPassword && password !== confirmPassword) return "Passwords do not match.";
    return "";
  }, [password, confirmPassword]);

  useEffect(() => {
    let mounted = true;
    let settled = false;
    const initialUrlError = readRecoveryError();

    const markReady = (session) => {
      if (!mounted || !session) return;
      settled = true;
      setReady(true);
      setMessage("");
    };

    const establishRecoverySession = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!mounted) return;

      if (sessionData?.session) {
        markReady(sessionData.session);
        return;
      }

      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!mounted) return;
        if (error) {
          settled = true;
          setMessage(error.message || "This recovery link is invalid or expired.");
          return;
        }
        markReady(data.session);
        return;
      }

      if (sessionError) {
        settled = true;
        setMessage(sessionError.message);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) markReady(session);
    });

    void establishRecoverySession();

    const timeout = window.setTimeout(() => {
      if (!mounted || settled || initialUrlError) return;
      setMessage("This recovery link may be expired or invalid. Request a fresh link from the login screen.");
    }, 5500);

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []); // Supabase establishes the temporary recovery session from the callback URL.

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading || success) return;

    if (!ready) {
      setMessage("Quest is still verifying your recovery link.");
      return;
    }

    if (password.length < 8) {
      setMessage("Use at least 8 characters for your new password.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // Remove recovery tokens/codes from the visible URL as soon as they are no longer needed.
      window.history.replaceState({}, "", "/reset-password");
      setSuccess(true);
      await wait(350);
    } catch (error) {
      setMessage(error?.message || "Quest could not update your password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function cancelRecovery() {
    try {
      await supabase.auth.signOut();
    } finally {
      onCancel?.();
    }
  }

  return (
    <main className="recovery-page">
      <div className="recovery-sky" aria-hidden="true" />
      <section className="recovery-card" aria-labelledby="recovery-title">
        <div className="recovery-mark">QUEST</div>
        <div className="recovery-icon" aria-hidden="true">🔑</div>
        <p className="recovery-kicker">ACCOUNT RECOVERY</p>
        <h1 id="recovery-title">{success ? "PASSWORD RESTORED" : "CHOOSE A NEW PASSWORD"}</h1>
        <p className="recovery-copy">
          {success
            ? "Your key works again. You can return to your farm now."
            : "Create a new password for your Quest account. Your quests, XP, and farm stay exactly where you left them."}
        </p>

        {!success ? (
          <form className="recovery-form" onSubmit={handleSubmit}>
            <label className="recovery-field">
              <span>New password</span>
              <div className="recovery-input-shell">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  required
                />
                <button
                  type="button"
                  className="recovery-eye"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? "◉" : "◎"}
                </button>
              </div>
            </label>

            <label className="recovery-field">
              <span>Confirm password</span>
              <div className="recovery-input-shell">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Type it again"
                  required
                />
              </div>
            </label>

            {(message || passwordIssue) && (
              <p className="recovery-message" role="alert">{message || passwordIssue}</p>
            )}

            <button className="recovery-primary" type="submit" disabled={loading || !ready}>
              {loading ? "UPDATING..." : ready ? "SET NEW PASSWORD" : "VERIFYING LINK..."}
            </button>
            <button className="recovery-secondary" type="button" onClick={cancelRecovery}>
              Back to login
            </button>
          </form>
        ) : (
          <div className="recovery-success">
            <span aria-hidden="true">✓</span>
            <button className="recovery-primary" type="button" onClick={onComplete}>
              CONTINUE TO QUEST
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
