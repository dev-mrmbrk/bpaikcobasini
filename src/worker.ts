interface PreparedStatement {
  first<T = Record<string, unknown>>(
    columnName?: string
  ): Promise<T | null>;

  all<T = Record<string, unknown>>(): Promise<{
    results: T[];
  }>;
}

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };

  DB: {
    prepare(query: string): PreparedStatement;
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/health" && request.method === "GET") {
      try {
        await env.DB.prepare("SELECT 1 AS ok").first();

        return json({
          status: "ok",
          runtime: "cloudflare-workers",
          d1Connected: true,
          database: "pbaik-absensi-data"
        });
      } catch {
        return json({
          status: "error",
          d1Connected: false,
          error: "Database binding belum dapat diakses"
        }, 503);
      }
    }

    if (path === "/api/d1/status" && request.method === "GET") {
      try {
        const result = await env.DB.prepare(
          "SELECT name FROM sqlite_master " +
          "WHERE type = 'table' " +
          "AND name NOT LIKE 'sqlite_%' " +
          "ORDER BY name"
        ).all<{ name: string }>();

        return json({
          connected: true,
          databaseName: "pbaik-absensi-data",
          binding: "DB",
          tables: result.results.map(row => row.name),
          dataMigrationComplete: false
        });
      } catch {
        return json({
          connected: false,
          error: "Tidak dapat membaca metadata D1"
        }, 503);
      }
    }

    // Jangan mengembalikan sukses palsu untuk API yang
    // implementasi dan pengamanannya belum dipindahkan.
    if (path.startsWith("/api/")) {
      return json({
        success: false,
        error: "API ini belum dimigrasikan ke Cloudflare Worker"
      }, 501);
    }

    return env.ASSETS.fetch(request);
  }
};
