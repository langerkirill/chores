const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request, env) });
    }

    try {
      if (url.pathname === "/api/health" && request.method === "GET") {
        return json({ ok: true }, request, env);
      }

      if (url.pathname === "/api/chores" && request.method === "GET") {
        const { results } = await env.DB.prepare(`
          SELECT id, person, chore, chore_date AS date, created_at AS createdAt
          FROM chores
          ORDER BY chore_date DESC, created_at DESC
        `).all();
        return json({ chores: results || [] }, request, env);
      }

      if (url.pathname === "/api/chores" && request.method === "POST") {
        const payload = await request.json();
        const chore = validateChore(payload);

        await env.DB.prepare(`
          INSERT INTO chores (id, person, chore, chore_date, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).bind(chore.id, chore.person, chore.chore, chore.date, chore.createdAt).run();

        return json({ chore }, request, env, 201);
      }

      if (url.pathname.startsWith("/api/chores/") && request.method === "DELETE") {
        const id = decodeURIComponent(url.pathname.replace("/api/chores/", ""));
        if (!id) {
          return json({ error: "Missing chore id." }, request, env, 400);
        }

        await env.DB.prepare("DELETE FROM chores WHERE id = ?").bind(id).run();
        return json({ ok: true }, request, env);
      }

      return json({ error: "Not found." }, request, env, 404);
    } catch (error) {
      const status = error.status || 500;
      const message = status === 500 ? "Unexpected server error." : error.message;
      return json({ error: message }, request, env, status);
    }
  }
};

function validateChore(payload) {
  const id = typeof payload.id === "string" && payload.id ? payload.id : crypto.randomUUID();
  const person = typeof payload.person === "string" ? payload.person.trim() : "";
  const chore = typeof payload.chore === "string" ? payload.chore.trim() : "";
  const date = typeof payload.date === "string" ? payload.date.trim() : "";
  const createdAt = typeof payload.createdAt === "string" ? payload.createdAt : new Date().toISOString();

  if (!["Asuka", "Kirill"].includes(person)) {
    throw httpError("Person must be Asuka or Kirill.", 400);
  }
  if (!chore || chore.length > 80) {
    throw httpError("Chore must be between 1 and 80 characters.", 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw httpError("Date must use YYYY-MM-DD format.", 400);
  }

  return { id, person, chore, date, createdAt };
}

function json(body, request, env, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...jsonHeaders,
      ...corsHeaders(request, env)
    }
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const configured = (env.ALLOWED_ORIGINS || "*")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const allowOrigin = configured.includes("*") || !origin ? "*" : configured.includes(origin) ? origin : configured[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
