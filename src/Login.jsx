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
          <h1>{isSignUp ? "START YOUR FARM" : "WELCOME BACK"}</h1>
          <p>
            {isSignUp
              ? "Plant the first seed. Your little world starts here."
              : "Small steps, a brighter tomorrow."}
          </p>
        </header>

        <div className="pixel-world" aria-hidden="true">
          <div className="pixel-world__back-hill" />
          <div className="pixel-world__far-trees" />
          <div className="pixel-fence" />

          <div className="pixel-tree">
            <span className="pixel-tree__trunk" />
            <span className="pixel-tree__leaf pixel-tree__leaf--a" />
            <span className="pixel-tree__leaf pixel-tree__leaf--b" />
            <span className="pixel-tree__leaf pixel-tree__leaf--c" />
          </div>

          <div className="pixel-house">
            <span className="pixel-house__chimney" />
            <span className="pixel-smoke pixel-smoke--one" />
            <span className="pixel-smoke pixel-smoke--two" />
            <span className="pixel-house__roof" />
            <span className="pixel-house__body" />
            <span className="pixel-house__window pixel-house__window--left" />
            <span className="pixel-house__window pixel-house__window--right" />
            <span className="pixel-house__door" />
          </div>

          <div className="pixel-garden">
            {[0, 1, 2, 3].map((plot) => (
              <div className={`pixel-plot pixel-plot--${plot + 1}`} key={plot}>
                <span className="pixel-crop" />
              </div>
            ))}
          </div>

          <div className="pixel-campfire">
            <span className="pixel-campfire__log pixel-campfire__log--a" />
            <span className="pixel-campfire__log pixel-campfire__log--b" />
            <span className="pixel-campfire__flame" />
          </div>

          <div className="pixel-world__grass" />
        </div>

        <form
          className={`login-form ${feedback === "error" ? "is-error" : ""}`}
          onSubmit={handleSubmit}
        >
          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {message && (
            <p className={`login-message login-message--${messageKind}`} role={messageKind === "error" ? "alert" : "status"}>
              {message}
            </p>
          )}

          <button className="login-primary" type="submit" disabled={loading}>
            <span>{loading ? "LOADING..." : isSignUp ? "CREATE FARM" : "LOG IN"}</span>
            {!loading && <b aria-hidden="true">›</b>}
          </button>

          <button className="login-secondary" type="button" onClick={toggleMode}>
            {isSignUp ? "Already have a farm? Log in" : "New here? Start your farm"}
          </button>
        </form>
      </section>
    </main>
  );
}
