// import { Link, useNavigate } from "react-router-dom";
// import { motion } from "framer-motion";

// export default function Navbar() {
//   const navigate = useNavigate();

//   const logout = () => {
//     localStorage.removeItem("token");
//     navigate("/");
//   };

//   return (
//     <motion.nav
//       initial={{ y: -80 }}
//       animate={{ y: 0 }}
//       className="bg-gradient-to-r from-black via-gray-900 to-black text-white p-4 shadow-lg border-b border-gray-800"
//     >
//       <div className="max-w-7xl mx-auto flex justify-between items-center">

//         {/* Premium Gold Brand */}
//         <h1 className="text-xl font-bold premium-gold">
//           CredX Fintech
//         </h1>

//         <div className="flex gap-6 items-center">
//           <Link className="premium-gold nav-link" to="/dashboard">
//             Dashboard
//           </Link>
//           <Link className="premium-gold nav-link" to="/wallet">
//             Wallet
//           </Link>
//           <Link className="premium-gold nav-link" to="/cards">
//             Cards
//           </Link>
//           <Link className="premium-gold nav-link" to="/loans">
//             Loans
//           </Link>

//           <button
//             onClick={logout}
//             className="bg-gradient-to-r from-[#c6a23a] to-[#f5e6a1] text-black px-4 py-1 rounded-md hover:opacity-90 transition"
//           >
//             Logout
//           </button>
//         </div>
//       </div>
//     </motion.nav>
//   );
// }
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function Navbar() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <motion.nav
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      className="bg-gradient-to-r from-black via-gray-900 to-black p-4 shadow-lg border-b border-gray-800"
    >
      <div className="max-w-7xl mx-auto flex justify-between items-center">

        {/* Brand */}
        <h1 className="text-xl font-bold premium-gold">
          CredX Fintech
        </h1>

        <div className="flex gap-6 items-center">

          <Link className="premium-gold nav-link" to="/dashboard">
            Dashboard
          </Link>

          <Link className="premium-gold nav-link" to="/wallet">
            Wallet
          </Link>

          <Link className="premium-gold nav-link" to="/cards">
            Cards
          </Link>

          <Link className="premium-gold nav-link" to="/loans">
            Loans
          </Link>

          <button
            onClick={logout}
            className="bg-gradient-to-r from-[#bfa34a] to-[#f0e2a0] text-black px-4 py-1 rounded-md hover:opacity-90 transition"
          >
            Logout
          </button>

        </div>
      </div>
    </motion.nav>
  );
}