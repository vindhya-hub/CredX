import axios from "axios";

// Same-origin "/api" by default: proxied by Vite in development and by nginx
// in the Docker image. Set VITE_API_URL to call an API on another origin.
export const API_URL = import.meta.env.VITE_API_URL || "/api";

const ACCESS_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  save({ accessToken, refreshToken }) {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem("token"); // key used by older builds
  },
};

const API = axios.create({ baseURL: API_URL, timeout: 30000 });

API.interceptors.request.use((config) => {
  const token = tokens.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// One refresh at a time: concurrent 401s wait for the same rotation, because
// refresh tokens are single use on the server.
let refreshInFlight = null;

async function refreshAccessToken() {
  const refreshToken = tokens.refresh;
  if (!refreshToken) throw new Error("No refresh token");
  const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
  tokens.save(res.data);
  return res.data.accessToken;
}

function goToLogin() {
  tokens.clear();
  if (window.location.pathname !== "/login") window.location.assign("/login");
}

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const isAuthCall = original?.url?.startsWith("/auth/");

    if (status === 401 && code === "TOKEN_EXPIRED" && original && !original._retried) {
      original._retried = true;
      try {
        refreshInFlight = refreshInFlight || refreshAccessToken().finally(() => { refreshInFlight = null; });
        const accessToken = await refreshInFlight;
        original.headers.Authorization = `Bearer ${accessToken}`;
        return API(original);
      } catch {
        goToLogin();
      }
    } else if (status === 401 && !isAuthCall && ["INVALID_TOKEN", "NO_TOKEN"].includes(code)) {
      goToLogin();
    }
    return Promise.reject(error);
  },
);

/** Best human-readable message from an API error. */
export function errorMessage(error, fallback = "Something went wrong") {
  const data = error?.response?.data;
  return data?.details?.[0]?.message || data?.message || fallback;
}

/** Revokes the refresh token on the server and forgets both tokens. */
export async function logout() {
  const refreshToken = tokens.refresh;
  tokens.clear();
  if (!refreshToken) return;
  try {
    await axios.post(`${API_URL}/auth/logout`, { refreshToken });
  } catch {
    // Already invalid or the server is unreachable; local tokens are gone anyway.
  }
}

export default API;
