import { useState } from "react";
import API from "../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const reset = async () => {
    await API.post("/auth/forgot-password", {
      email,
      newPassword
    });
    alert("Password Reset Successful");
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">

      <div className="bg-gray-900 p-10 rounded-2xl w-[400px] border border-gray-800">

        <h2 className="text-2xl text-white mb-6">
          Reset Password
        </h2>

        <input
          placeholder="Email"
          className="w-full mb-4 p-3 bg-black border border-gray-700 rounded text-white"
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="New Password"
          className="w-full mb-6 p-3 bg-black border border-gray-700 rounded text-white"
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <button
          onClick={reset}
          className="w-full bg-gradient-to-r from-[#c6a84f] to-[#f1e3a1] text-black py-3 rounded-lg"
        >
          Reset Password
        </button>

      </div>
    </div>
  );
}