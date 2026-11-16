/** Thin fetch wrapper: same-origin cookies, CSRF header on writes, readable errors. */
export class ApiError extends Error {
  constructor(public status: number, message: string, public fields?: { field: string; message: string }[]) {
    super(message);
  }
}

let csrf: string | null = null;
export const setCsrf = (t: string | null) => { csrf = t; };

type Opts = { params?: Record<string, string | number | boolean | undefined | null>; signal?: AbortSignal };

function qs(params?: Opts["params"]) {
  if (!params) return "";
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") u.set(k, String(v)); });
  const s = u.toString();
  return s ? `?${s}` : "";
}

async function request<T>(method: string, url: string, body?: unknown, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  if (method !== "GET" && csrf) headers["X-CSRF-Token"] = csrf;
  let res: Response;
  try {
    res = await fetch(url + qs(opts.params), { method, headers, body: payload, credentials: "same-origin", signal: opts.signal });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // A dev proxy or gateway answers 5xx with no JSON body when the API process is not running.
    const unreachable = data === null && [500, 502, 503, 504].includes(res.status);
    const detail = typeof data?.detail === "string" ? data.detail
      : unreachable ? "Cannot reach the LEND & LOOP server. If you are running it locally, start the backend (uvicorn app.main:app --port 8000) and Postgres, then try again."
      : "Something went wrong. Please try again.";
    if (res.status === 401 && !url.includes("/auth/login") && !url.includes("/auth/me")) window.dispatchEvent(new Event("pra:session-expired"));
    throw new ApiError(res.status, detail, data?.errors);
  }
  return data as T;
}

export const api = {
  get: <T,>(url: string, params?: Opts["params"], signal?: AbortSignal) => request<T>("GET", url, undefined, { params, signal }),
  post: <T,>(url: string, body?: unknown) => request<T>("POST", url, body ?? {}),
  postForm: <T,>(url: string, form: FormData) => request<T>("POST", url, form),
  patch: <T,>(url: string, body: unknown) => request<T>("PATCH", url, body),
  put: <T,>(url: string, body: unknown) => request<T>("PUT", url, body),
  del: <T,>(url: string) => request<T>("DELETE", url),
};
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");
