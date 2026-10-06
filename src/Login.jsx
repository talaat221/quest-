import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { playLoginError, playLoginSuccess, playLoginTap } from "./loginSfx";
import "./Login.css";
import "./LoginRecovery.css";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const recoveryRedirectUrl = () => `${window.location.origin}/reset-password`;

const isEmailRateLimitError = (error) =>
  /email rate limit exceeded|rate limit.*email|email.*rate limit/i.test(error?.message || "");

const friendlyAuthError = (error) => {
  const message = error?.message || "Something went wrong. Please try again.";
  if (/invalid login credentials/i.test(message)) return "Email or password is incorrect.";
  if (isEmailRateLimitError(error)) {
    return "Quest’s email service is temporarily at its sending limit. Please wait a little and try again. Your account is safe.";
  }
  return message;
};

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetRequest, setIsResetRequest] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState("error");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [farmArt, setFarmArt] = useState("");

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    const loadFarmArt = async () => {
      try {
        const response = await fetch("/quest-farm-hero.b64.txt", { cache: "force-cache" });
        if (!response.ok) throw new Error("Farm artwork could not be loaded.");

        const encoded = (await response.text()).replace(/\s/g, "");
        const binary = atob(encoded);
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: "image/webp" });
        objectUrl = URL.createObjectURL(blob);

        if (!cancelled) setFarmArt(objectUrl);
      } catch (error) {
        console.warn("Quest farm art failed to load:", error);
      }
    };

    void loadFarmArt();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  useEffect(() => {
    if (resetCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setResetCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resetCooldown]);

  const showError = async (text) => {
    setMessageKind("error");
    setMessage(text);
    setFeedback("error");
    playLoginError();
    await wait(360);
    setFeedback("");
  };

  async function handleResetRequest() {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      await showError("Enter your email address first.");
      return;
    }

    if (resetCooldown > 0) {
      setMessageKind("info");
      setMessage(`Please wait ${resetCooldown}s before requesting another recovery email.`);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: recoveryRedirectUrl(),
    });

    if (error) {
      if (isEmailRateLimitError(error)) setResetCooldown(60);
      await showError(friendlyAuthError(error));
      return;
    }

    setResetCooldown(60);
    setMessageKind("info");
    setMessage("If that email belongs to a Quest account, a recovery link is on its way. Check your inbox and spam folder.");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    playLoginTap();
    setMessage("");
    setFeedback("");
    setLoading(true);

    try {
      if (isResetRequest) {
        await handleResetRequest();
        return;
      }

      const result = isSignUp
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (result.error) {
        await showError(friendlyAuthError(result.error));
      } else if (result.data.session) {
        setFeedback("success");
        playLoginSuccess();
        await wait(560);
        onLogin(result.data.session);
      } else if (isSignUp) {
        setMessageKind("info");
        setMessage("Your little farm is ready. Check your email to confirm your account.");
      }
    } catch (err) {
      await showError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  function toggleMode() {
    playLoginTap();
    setIsSignUp((value) => !value);
    setIsResetRequest(false);
    setPassword("");
    setMessage("");
    setFeedback("");
  }

  function openResetRequest() {
    playLoginTap();
    setIsResetRequest(true);
    setIsSignUp(false);
    setPassword("");
    setMessage("");
    setFeedback("");
  }

  function closeResetRequest() {
    playLoginTap();
    setIsResetRequest(false);
    setMessage("");
    setFeedback("");
  }

  const title = isResetRequest ? "RESET PASSWORD" : isSignUp ? "START YOUR FARM" : "WELCOME BACK";
  const subtitle = isResetRequest
    ? "We’ll send a recovery key to your email."
    : isSignUp
      ? "Plant the first seed. Your little world starts here."
      : "Small steps, a brighter tomorrow.";

  const resetButtonLabel = resetCooldown > 0
    ? `TRY AGAIN IN ${resetCooldown}s`
    : "SEND RESET LINK";

  return (
    <main className={`pixel-login ${feedback === "success" ? "is-leaving" : ""}`}>
      <div className="pixel-sky" aria-hidden="true">
        <div className="pixel-stars" />
        <div className="pixel-moon" />
        <div className="pixel-cloud pixel-cloud--one" />
        <div className="pixel-cloud pixel-cloud--two" />
      </div>

      <section className="login-shell" aria-label="Quest login">
        <header className="login-brand">
          <div className="login-brand__mark">QUEST</div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </header>

        <div className={`farm-art ${farmArt ? "is-ready" : ""}`} aria-hidden="true">
          {farmArt && <img src={farmArt} alt="" />}
          <span className="farm-art__glow farm-art__glow--one" />
          <span className="farm-art__glow farm-art__glow--two" />
          <span className="farm-art__firefly farm-art__firefly--one" />
          <span className="farm-art__firefly farm-art__firefly--two" />
          <span className="farm-art__firefly farm-art__firefly--three" />
        </div>

        <form
          className={`login-form ${feedback === "error" ? "is-error" : ""}`}
          onSubmit={handleSubmit}
        >
          <label className="login-field">
            <span>Email</span>
            <div className="login-input-shell">
              <span className="login-input-icon" aria-hidden="true">✉</span>
              <input
                type="email"
                autoComplete="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </label>

          {!isResetRequest && (
            <label className="login-field">
              <span className="login-field-heading">
                <span>Password</span>
                {!isSignUp && (
                  <button className="login-forgot" type="button" onClick={openResetRequest}>
                    Forgot password?
                  </button>
                )}
              </span>
              <div className="login-input-shell">
                <span className="login-input-icon" aria-hidden="true">▣</span>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  className="login-password-toggle"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "◉" : "◎"}
                </button>
              </div>
            </label>
          )}

          {message && (
            <p
              className={`login-message login-message--${messageKind}`}
              role={messageKind === "error" ? "alert" : "status"}
            >
              {message}
            </p>
          )}

          <button
            className="login-primary"
            type="submit"
            disabled={loading || (isResetRequest && resetCooldown > 0)}
          >
            <span>
              {loading
                ? "LOADING..."
                : isResetRequest
                  ? resetButtonLabel
                  : isSignUp
                    ? "CREATE FARM"
                    : "LOG IN"}
            </span>
            {!loading && !(isResetRequest && resetCooldown > 0) && <b aria-hidden="true">›</b>}
          </button>

          {isResetRequest ? (
            <button className="login-secondary" type="button" onClick={closeResetRequest}>
              Back to login
            </button>
          ) : (
            <button className="login-secondary" type="button" onClick={toggleMode}>
              {isSignUp ? "Already have a farm? Log in" : "New here? Start your farm"}
            </button>
          )}
        </form>

        <div className="login-sign" aria-hidden="true">
          A BRIGHTER<br />TOMORROW GROWS HERE
          <span>♥</span>
        </div>
      </section>
    </main>
  );
}
