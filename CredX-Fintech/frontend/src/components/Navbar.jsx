import { NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { logout } from "../services/api";

const LINKS = [
  ["/dashboard", "Dashboard"],
  ["/wallet", "Wallet"],
  ["/cards", "Cards"],
  ["/loans", "Loans"],
  ["/assistant", "Assistant"],
];

export default function Navbar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <motion.nav
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      className="bg-gradient-to-r from-black via-gray-900 to-black p-4 shadow-lg border-b border-gray-800"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap gap-4 justify-between items-center">

        {/* Brand */}
        <h1 className="text-xl font-bold premium-gold">
          CredX Fintech
        </h1>

        <div className="flex flex-wrap gap-6 items-center">
          {LINKS.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `premium-gold nav-link ${isActive ? "underline underline-offset-8 decoration-[#bfa34a]" : ""}`}
            >
              {label}
            </NavLink>
          ))}

          <button
            onClick={handleLogout}
            className="bg-gradient-to-r from-[#bfa34a] to-[#f0e2a0] text-black px-4 py-1 rounded-md hover:opacity-90 transition"
          >
            Logout
          </button>
        </div>
      </div>
    </motion.nav>
  );
}
