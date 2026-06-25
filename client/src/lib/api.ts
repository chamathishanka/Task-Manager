import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

/**
 * The access token is kept in memory only (never localStorage) — matching the
 * backend's security model. It is lost on page reload and re-obtained via a
 * silent refresh on app startup (see AuthProvider).
 */
let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;

/** Called when a refresh fails mid-session, so the AuthProvider can log out. */
let onAuthFailure: (() => void) | null = null;
export const setOnAuthFailure = (cb: () => void) => {
  onAuthFailure = cb;
};

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // send the httpOnly refresh cookie
});

// Attach the access token to every outgoing request.
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// --- Single-flight refresh on 401 -------------------------------------------
// If several requests 401 at once, only ONE refresh runs; the rest wait in a
// queue and are replayed with the new token.
let isRefreshing = false;
let waiters: Array<(token: string | null) => void> = [];

function notifyWaiters(token: string | null) {
  waiters.forEach((resolve) => resolve(token));
  waiters = [];
}

/** Bare axios call (not `api`) so it bypasses these interceptors. */
async function requestRefresh(): Promise<string | null> {
  try {
    const res = await axios.post(
      `${API_URL}/auth/refresh`,
      {},
      { withCredentials: true }
    );
    const token = res.data.accessToken as string;
    setAccessToken(token);
    return token;
  } catch {
    setAccessToken(null);
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const status = error.response?.status;
    const url = original?.url ?? "";

    // A 401 from an auth endpoint means bad credentials / no session —
    // not an expired access token. Never try to refresh those.
    const isAuthRoute =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh");

    if (status !== 401 || !original || original._retry || isAuthRoute) {
      return Promise.reject(error);
    }

    original._retry = true;

    // A refresh is already happening — wait for it, then replay.
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waiters.push((token) => {
          if (token) {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          } else {
            reject(error);
          }
        });
      });
    }

    isRefreshing = true;
    const token = await requestRefresh();
    isRefreshing = false;
    notifyWaiters(token);

    if (token) {
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    }

    onAuthFailure?.();
    return Promise.reject(error);
  }
);

/** Pull a human-readable message out of an axios error. */
export function getErrorMessage(err: unknown, fallback = "Something went wrong") {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    return data?.message ?? fallback;
  }
  return fallback;
}
