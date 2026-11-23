import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API, { errorMessage } from "../services/api";

const inputClass = "w-full mb-4 p-3 bg-black border border-gray-700 rounded text-white";
const buttonClass = "w-full bg-gradient-to-r from-[#c6a84f] to-[#f1e3a1] text-black py-3 rounded-lg disabled:opacity-60";

/**
 * Two steps: request a single-use reset token for the email, then set a new
 * password with it. In production the token would arrive by e-mail; local
 * demos can enable AUTH_EXPOSE_RESET_TOKEN so the API returns it directly.
 */
export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [requested, setRequested] = useState(false);
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const requestReset = async () => {
    setBusy(true);
    try {
      const res = await API.post("/auth/forgot-password", { email });
      setInfo(res.data.message);
      if (res.data.resetToken) setToken(res.data.resetToken);
      setRequested(true);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await API.post("/auth/reset-password", { token, newPassword });
      alert("Password reset successful. Please log in.");
      navigate("/login");
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="bg-gray-900 p-10 rounded-2xl w-[400px] border border-gray-800">
        <h2 className="text-2xl text-white mb-6">Reset Password</h2>

        {!requested ? (
          <>
            <input placeholder="Email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
            <button onClick={requestReset} disabled={busy || !email} className={buttonClass}>Send reset instructions</button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-4">{info}</p>
            <input placeholder="Reset token" className={inputClass} value={token} onChange={(e) => setToken(e.target.value)} />
            <input type="password" placeholder="New password (8+ chars, letters and numbers)" className={inputClass}
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <button onClick={reset} disabled={busy || !token || !newPassword} className={buttonClass}>Reset Password</button>
          </>
        )}
      </div>
    </div>
  );
}
