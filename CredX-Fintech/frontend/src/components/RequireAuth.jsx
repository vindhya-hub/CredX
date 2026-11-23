import { Navigate, useLocation } from "react-router-dom";
import { tokens } from "../services/api";

/** Redirects to /login when there is no session. The API still checks every request. */
export default function RequireAuth({ children }) {
  const location = useLocation();
  if (!tokens.access && !tokens.refresh) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
