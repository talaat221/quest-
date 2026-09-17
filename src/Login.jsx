import { useState } from "react";
import { supabase } from "./supabaseClient";
import { playLoginError, playLoginSuccess, playLoginTap } from "./loginSfx";
import "./Login.css";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState("error");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const showError = async (text) => {
    setMessageKind("error");
    setMessage(text);
    setFeedback("error");
    playLoginError();
    await wait(360);
    setFeedback("");
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    playLoginTap();
    setMessage("");
    setFeedback("");
    setLoading(true);

    try {
      const result = isSignUp
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (result.error) {
        await showError(result.error.message);
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
      await showError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggleMode() {
    playLoginTap();
    setIsSignUp((value) => !value);
    setMessage("");
    setFeedback("");
  }

  return (
    <main className="pixel-login">
      <div className="pixel-login__stars" aria-hidden="true" />
      <div className="pixel-login__cloud pixel-login__cloud--one" aria-hidden="true" />
      <div className="pixel-login__cloud pixel-login__cloud--two" aria-hidden="true" />

      <div className="pixel-login__world" aria-hidden="true">
        <div className="pixel-login__hill" />
        <div className="pixel-tree">
          <div className="pixel-tree__trunk" />
          <div className="pixel-tree__crown" />
        </div>

        <div className="pixel-house">
          <div className="pixel-house__roof" />
          <div className="pixel-house__chimney" />
          <div className="pixel-smoke" />
          <div className="pixel-house__window pixel-house__window--left" />
          <div className="pixel-house__window pixel-house__window--right" />
          <div className="pixel-house__door" />
        </div>

        <div className="pixel-farm">
          {[0, 1, 2, 3].map((plot) => (
            <div className="pixel-plot" key={plot}>
              <div className="pixel-sprout" />
            </div>
          ))}
        </div>
        <div className="pixel-login__ground" />
      </div>

      <section className="login-shell" aria-label="Quest login">
        <header className="login-brand">
          <div className="login-brand__eyebrow">YOUR LITTLE WORLD</div>
          <h1 className="login-brand__title">QUEST</h1>
          <p className="login-brand__subtitle">
            Small steps grow into something beautiful.
          </p>
        </header>

        <form
          className={`login-card ${feedback === "error" ? "is-error" : ""} ${
            feedback === "success" ? "is-success" : ""
          }`}
          onSubmit={handleSubmit}
        >
          <div className="login-sparkles" aria-hidden="true" />

          <h2 className="login-card__heading">
            {isSignUp ? "PLANT YOUR FIRST SEED" : "WELCOME BACK"}
          </h2>
          <p className="login-card__copy">
            {isSignUp
              ? "Create your account and start growing your days."
              : "Your farm has been waiting for you."}
          </p>

          <label className="login-field">
            <span className="login-field__label">Email</span>
            <input
              className="login-field__input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="login-field">
            <span className="login-field__label">Password</span>
            <input
              className="login-field__input"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {message && (
            <p
              className="login-error"
              role={messageKind === "error" ? "alert" : "status"}
            >
              {message}
            </p>
          )}

          <button className="login-primary" type="submit" disabled={loading}>
            {loading
              ? "LOADING..."
              : isSignUp
              ? "CREATE FARM"
              : "ENTER QUEST"}
          </button>

          <button className="login-secondary" type="button" onClick={toggleMode}>
            {isSignUp
              ? "Already have a farm? Log in"
              : "New here? Start your farm"}
          </button>

          <div className="login-footer-note">
            GROW FOCUS · GROW YOUR WORLD
          </div>
        </form>
      </section>
    </main>
  );
}
