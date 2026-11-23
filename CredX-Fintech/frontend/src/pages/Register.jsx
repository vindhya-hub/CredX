import { useState } from "react";
import API, { errorMessage } from "../services/api";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });

  const register = async () => {
    try {
      await API.post("/auth/register", form);
      alert("Registered successfully");
      navigate("/login");
    } catch (err) {
      alert(errorMessage(err, "Registration failed"));
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">

      <div className="bg-gray-900 p-10 rounded-2xl w-[400px] border border-gray-800">

        <h2 className="text-2xl text-white mb-6">Register</h2>

        <input
          placeholder="Name"
          className="w-full mb-4 p-3 bg-black border border-gray-700 rounded text-white"
          onChange={(e) => setForm({...form, name: e.target.value})}
        />

        <input
          placeholder="Email"
          className="w-full mb-4 p-3 bg-black border border-gray-700 rounded text-white"
          onChange={(e) => setForm({...form, email: e.target.value})}
        />

        <input
          type="password"
          placeholder="Password (8+ chars, letters and numbers)"
          className="w-full mb-6 p-3 bg-black border border-gray-700 rounded text-white"
          onChange={(e) => setForm({...form, password: e.target.value})}
        />

        <button
          onClick={register}
          className="w-full bg-gradient-to-r from-[#c6a84f] to-[#f1e3a1] text-black py-3 rounded-lg"
        >
          Create Account
        </button>

      </div>
    </div>
  );
}