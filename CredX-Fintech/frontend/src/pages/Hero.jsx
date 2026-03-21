// import { motion } from "framer-motion";
// import { useNavigate } from "react-router-dom";

// export default function Hero() {
//   const navigate = useNavigate();

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-black via-[#0b1b3a] to-black text-white flex items-center justify-center px-12 relative overflow-hidden">

//       {/* Soft Background Accent */}
//       <div className="absolute inset-0 pointer-events-none">
//         <div
//           className="absolute w-[600px] h-[600px] rounded-full blur-[120px]"
//           style={{
//             background: "radial-gradient(circle, rgba(255,215,130,0.15), transparent 70%)",
//             top: "20%",
//             right: "-200px"
//           }}
//         />
//       </div>

//       <div className="grid md:grid-cols-2 gap-20 items-center z-10 max-w-6xl">

//         {/* LEFT CONTENT */}
//         <motion.div
//           initial={{ opacity: 0, y: 40 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.8 }}
//         >
//           <h1 className="text-5xl font-bold leading-tight">
//             The Future of <span className="text-[#d4c17c]">Digital Banking</span>
//           </h1>

//           <p className="mt-6 text-gray-300 text-lg leading-relaxed">
//             Manage cards, loans, wallet and analytics in one seamless fintech platform.
//             Built for modern financial intelligence.
//           </p>

//           <div className="mt-8 flex gap-6">
//             <button
//               onClick={() => navigate("/login")}
//               className="px-8 py-4 bg-gradient-to-r from-[#c8b06e] to-[#e6d394] text-black rounded-xl font-semibold shadow-lg hover:scale-105 transition"
//             >
//               Get Started
//             </button>

//             <button
//               onClick={() => navigate("/login")}
//               className="px-8 py-4 border border-gray-600 rounded-xl hover:bg-white hover:text-black transition"
//             >
//               Login
//             </button>
//           </div>
//         </motion.div>

//         {/* RIGHT VISUAL */}
//         <motion.div
//           initial={{ opacity: 0, x: 80 }}
//           animate={{ opacity: 1, x: 0 }}
//           transition={{ duration: 1 }}
//           className="relative"
//         >
//           <div className="w-[420px] h-[420px] rounded-3xl bg-gradient-to-br from-[#1b2c52] to-black shadow-2xl border border-gray-700 flex items-center justify-center">

//             <div className="text-center">
//               <div className="text-4xl font-bold text-[#d4c17c]">CredX</div>
//               <div className="mt-3 text-gray-400">Fintech Platform</div>
//             </div>

//           </div>
//         </motion.div>

//       </div>
//     </div>
//   );
// }
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function Hero() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black text-white overflow-hidden">

      {/* Background subtle glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,215,0,0.08),transparent_60%)]" />

      <div className="relative z-10 max-w-7xl w-full px-10 grid md:grid-cols-2 gap-16 items-center">

        {/* LEFT CONTENT */}
        <motion.div
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            The Future of{" "}
            <span className="text-yellow-400">
              Digital Banking
            </span>
          </h1>

          <p className="mt-6 text-gray-300 text-lg leading-relaxed max-w-lg">
            Manage cards, loans, wallet and analytics in one seamless fintech
            platform. Built for modern financial intelligence.
          </p>

          <div className="mt-10 flex gap-6">

            {/* GET STARTED → REGISTER */}
            <button
              onClick={() => navigate("/register")}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-semibold hover:scale-105 transition-transform duration-300"
            >
              Get Started
            </button>

            {/* LOGIN */}
            <button
              onClick={() => navigate("/login")}
              className="px-8 py-4 rounded-xl border border-gray-500 text-white hover:bg-gray-800 transition duration-300"
            >
              Login
            </button>

          </div>
        </motion.div>

        {/* RIGHT SIDE CARD */}
        <motion.div
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="hidden md:block"
        >
          <div className="w-[420px] h-[480px] rounded-3xl bg-gradient-to-br from-gray-900 to-black border border-gray-700 shadow-2xl flex flex-col items-center justify-center">

            <h2 className="text-4xl font-bold text-yellow-400">
              CredX
            </h2>

            <p className="mt-3 text-gray-400 text-lg">
              Fintech Platform
            </p>

          </div>
        </motion.div>

      </div>
    </div>
  );
}