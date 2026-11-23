import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API, { errorMessage, tokens } from "../services/api";
import CredRollingCards from "../components/CredRollingCards";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async (e) => {
    if (e) e.preventDefault();

    if (!email || !password) {
      return alert("Please enter email and password");
    }

    try {
      setLoading(true);

      const res = await API.post("/auth/login", {
        email,
        password,
      });

      tokens.save(res.data);
      navigate(location.state?.from || "/dashboard");

    } catch (err) {
      alert(errorMessage(err, "Invalid credentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-black via-gray-900 to-black overflow-hidden">

      {/* Animated Background */}
      <CredRollingCards />

      {/* Login Card */}
      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 shadow-2xl p-10 rounded-3xl w-[420px] text-white backdrop-blur-xl">

          <h2 className="text-3xl font-semibold mb-8 text-center bg-gradient-to-r from-[#d4af37] via-[#f5e6b2] to-[#bfa34a] bg-clip-text text-transparent">
            CredX Login
          </h2>

          <form onSubmit={login}>

            <input
              type="email"
              placeholder="Email"
              className="w-full mb-4 p-3 bg-black border border-gray-700 rounded-xl focus:outline-none focus:border-[#d4af37] transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              className="w-full mb-6 p-3 bg-black border border-gray-700 rounded-xl focus:outline-none focus:border-[#d4af37] transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#c6a84f] to-[#f1e3a1] text-black py-3 rounded-xl hover:scale-105 transition disabled:opacity-60"
            >
              {loading ? "Logging in..." : "Login"}
            </button>

          </form>

          <div className="flex justify-between mt-6 text-sm">
            <button
              onClick={() => navigate("/register")}
              className="text-gray-400 hover:text-white transition"
            >
              Create Account
            </button>

            <button
              onClick={() => navigate("/forgot-password")}
              className="text-gray-400 hover:text-white transition"
            >
              Forgot Password?
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}