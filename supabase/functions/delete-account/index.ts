import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = (value: string) =>
  value === "https://myquests.me" ||
  value === "https://www.myquests.me" ||
  value === "https://quest-alpha-fawn.vercel.app" ||
  /^https:\/\/quest(?:-[a-z0-9-]+)?-quest18\.vercel\.app$/.test(value) ||
  value === "http://localhost:5173";

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": allowedOrigin(origin) ? origin : "https://myquests.me",
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const allowedReasons = new Set([
  "no_longer_need",
  "not_useful",
  "hard_to_use",
  "missing_features",
  "bugs_performance",
  "privacy_concerns",
  "other",
  "prefer_not_to_say",
]);

const json = (origin: string, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json(origin, { error: "Method not allowed." }, 405);
  if (!allowedOrigin(origin)) return json(origin, { error: "Open this from Quest." }, 403);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json(origin, { error: "Sign in again before deleting your account." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Quest delete-account function is missing required Supabase environment variables.");
      return json(origin, { error: "Account deletion is temporarily unavailable." }, 503);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
      return json(origin, { error: "Your session could not be verified. Please sign in again." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const confirmation = String(body?.confirmation || "").trim();
    const reasonCode = String(body?.reason_code || "").trim();
    const reasonText = String(body?.reason_text || "").trim().slice(0, 500);

    if (confirmation !== "DELETE") {
      return json(origin, { error: "Type DELETE exactly to confirm permanent account deletion." }, 400);
    }
    if (!allowedReasons.has(reasonCode)) {
      return json(origin, { error: "Choose a deletion reason before continuing." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("Quest account deletion failed:", deleteError.message);
      return json(origin, { error: "Quest could not delete your account. Please try again." }, 500);
    }

    const { error: feedbackError } = await admin
      .from("quest_account_deletion_feedback")
      .insert({
        reason_code: reasonCode,
        reason_text: reasonText || null,
        privacy_notice_version: "2026-10-06",
      });

    if (feedbackError) {
      console.error("Quest deletion feedback could not be recorded:", feedbackError.message);
    }

    return json(origin, { deleted: true, feedback_recorded: !feedbackError });
  } catch (error) {
    console.error(
      "Quest delete-account unexpected error:",
      error instanceof Error ? error.message : String(error)
    );
    return json(origin, { error: "Quest could not delete your account. Please try again." }, 500);
  }
});
