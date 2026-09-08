import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let result;

      if (isSignUp) {
        result = await supabase.auth.signUp({
          email,
          password,
        });
      } else {
        result = await supabase.auth.signInWithPassword({
          email,
          password,
        });
      }

      if (result.error) {
        setError(result.error.message);
      } else if (result.data.session) {
        onLogin(result.data.session);
      } else if (isSignUp) {
        setError("Account created! Check your email to confirm your account.");
      }
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0B1826",
        color: "#EAE3D2",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 350,
          padding: 30,
          background: "#12253A",
          border: "1px solid #22384f",
          borderRadius: 16,
        }}
      >
        <h1 style={{ textAlign: "center" }}>
          {isSignUp ? "Create Account" : "Welcome Back"}
        </h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: "100%",
            marginBottom: 10,
            padding: 10,
            boxSizing: "border-box",
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: "100%",
            marginBottom: 10,
            padding: 10,
            boxSizing: "border-box",
          }}
        />

        {error && (
          <p style={{ color: "#C1543B", fontSize: 13 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 10,
            background: "#C9A24B",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {loading
            ? "Loading..."
            : isSignUp
            ? "Create Account"
            : "Log In"}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError("");
          }}
          style={{
            width: "100%",
            marginTop: 10,
            padding: 8,
            background: "none",
            border: "none",
            color: "#8FA3B5",
            cursor: "pointer",
          }}
        >
          {isSignUp
            ? "Already have an account? Log in"
            : "Don't have an account? Sign up"}
        </button>
      </form>
    </div>
  );
}