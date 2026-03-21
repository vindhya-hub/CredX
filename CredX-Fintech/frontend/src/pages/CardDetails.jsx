// import { useEffect, useState } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import API from "../services/api";
// import { motion } from "framer-motion";

// export default function CardDetails() {
//   const { id } = useParams();
//   const navigate = useNavigate();

//   const [transactions, setTransactions] = useState([]);
//   const [card, setCard] = useState(null);

//   useEffect(() => {
//     fetchTransactions();
//     fetchCardDetails();
//   }, []);

//   const fetchTransactions = async () => {
//     const res = await API.get(`/cards/${id}/transactions`);
//     setTransactions(res.data);
//   };

//   const fetchCardDetails = async () => {
//     const res = await API.get(`/cards/${id}`);
//     setCard(res.data);
//   };

//   return (
//     <div className="p-10 min-h-screen bg-gradient-to-br from-gray-100 to-gray-200">

//       <button
//         onClick={() => navigate("/cards")}
//         className="mb-8 bg-indigo-600 text-white px-4 py-2 rounded"
//       >
//         ← Back
//       </button>

//       {/* ===== CARD + ACCOUNT DETAILS SIDE BY SIDE ===== */}
//       {card && (
//         <div className="flex justify-center gap-12 mb-14 flex-wrap">

//           {/* ===== CARD ===== */}
//           <motion.div
//             initial={{ opacity: 0, y: -20 }}
//             animate={{ opacity: 1, y: 0 }}
//           >
//             <div
//               className="relative rounded-2xl shadow-2xl text-white p-8"
//               style={{
//                 width: "420px",
//                 height: "250px",
//                 background:
//                   card.cardCompany === "VISA"
//                     ? "linear-gradient(135deg,#1a1f71,#000)"
//                     : card.cardCompany === "MASTERCARD"
//                     ? "linear-gradient(135deg,#c00000,#ff9900)"
//                     : card.cardCompany === "AMEX"
//                     ? "linear-gradient(135deg,#004a9f,#0077c8)"
//                     : "linear-gradient(135deg,#2d2d2d,#000)"
//               }}
//             >
//               {/* Top Row */}
//               <div className="flex justify-between items-start">
//                 <div>
//                   <p className="text-sm tracking-widest opacity-70">
//                     {card.bankName || "CREDX BANK"}
//                   </p>
//                   <p className="text-lg font-semibold mt-1">
//                     {card.cardCompany || "CARD"}
//                   </p>
//                 </div>

//                 <p className="text-sm uppercase tracking-widest">
//                   {card.cardType}
//                 </p>
//               </div>

//               {/* Card Number */}
//               <div className="mt-12">
//                 <p className="text-2xl tracking-[5px] font-mono">
//                   {card.maskedNumber}
//                 </p>
//               </div>

//               {/* Holder + Expiry */}
//               <div className="flex justify-between mt-10">
//                 <div>
//                   <p className="text-xs opacity-70">Card Holder</p>
//                   <p className="text-sm font-semibold uppercase">
//                     {card.name}
//                   </p>
//                 </div>

//                 <div className="text-right">
//                   <p className="text-xs opacity-70">Expires</p>
//                   <p className="text-sm font-semibold">
//                     {card.expiryDate}
//                   </p>
//                 </div>
//               </div>
//             </div>
//           </motion.div>

//           {/* ===== ACCOUNT DETAILS ===== */}
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             className="bg-white rounded-2xl shadow-lg p-8 w-[420px]"
//           >
//             <h2 className="text-xl font-bold mb-6">
//               Account Details
//             </h2>

//             <div className="space-y-6 text-sm">

//               <div>
//                 <p className="text-gray-500">Bank Name</p>
//                 <p className="font-semibold">
//                   {card.bankName || "CREDX BANK"}
//                 </p>
//               </div>

//               <div>
//                 <p className="text-gray-500">Account Number</p>
//                 <p className="font-semibold">
//                   {card.accountNumber || "XXXX XXXX 1234"}
//                 </p>
//               </div>

//               <div>
//                 <p className="text-gray-500">Card Type</p>
//                 <p className="font-semibold uppercase">
//                   {card.cardType}
//                 </p>
//               </div>

//               <div>
//                 <p className="text-gray-500">Available Balance</p>
//                 <p className="font-semibold">
//                   ₹ {card.availableBalance || "0.00"}
//                 </p>
//               </div>

//             </div>
//           </motion.div>

//         </div>
//       )}

//       {/* ===== TRANSACTIONS (UNCHANGED) ===== */}
//       <motion.div
//         initial={{ opacity: 0, y: 40 }}
//         animate={{ opacity: 1, y: 0 }}
//         className="bg-white rounded-3xl shadow-2xl p-8"
//       >
//         <h1 className="text-2xl font-bold mb-6">
//           Card Transactions
//         </h1>

//         <button
//           onClick={async () => {
//             await API.post("/cards/simulate", {
//               cardId: id,
//               count: 10
//             });
//             fetchTransactions();
//           }}
//           className="bg-green-600 text-white px-4 py-2 rounded mb-6"
//         >
//           Simulate 10 Transactions
//         </button>

//         {transactions.length === 0 && <p>No transactions yet.</p>}

//         {transactions.map((tx) => (
//           <div key={tx.id} className="flex justify-between border-b py-4">
//             <div>
//               <p className="font-semibold">{tx.merchant}</p>
//               <p className="text-sm text-gray-500">
//                 {new Date(tx.createdAt).toLocaleString()}
//               </p>
//             </div>

//             <div className="text-right">
//               <p className="font-bold">₹ {tx.amount}</p>
//               {tx.isFraud && (
//                 <p className="text-red-600 text-sm">
//                   ⚠ Fraud Detected
//                 </p>
//               )}
//             </div>
//           </div>
//         ))}
//       </motion.div>
//     </div>
//   );
// }
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../services/api";
import { motion } from "framer-motion";

export default function CardDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [card, setCard] = useState(null);

  useEffect(() => {
    fetchTransactions();
    fetchCardDetails();
  }, []);

  const fetchTransactions = async () => {
    const res = await API.get(`/cards/${id}/transactions`);
    setTransactions(res.data);
  };

  const fetchCardDetails = async () => {
    const res = await API.get(`/cards/${id}`);
    setCard(res.data);
  };

  return (
    <div className="px-12 py-10 min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white">

      {/* Back Button */}
      <button
        onClick={() => navigate("/cards")}
        className="mb-10 bg-gradient-to-r from-[#bfa34a] to-[#f0e2a0] text-black px-5 py-2 rounded-md font-semibold shadow-md hover:opacity-90 transition"
      >
        ← Back
      </button>

      {/* ===== CARD + ACCOUNT DETAILS ===== */}
      {card && (
        <div className="flex justify-center gap-16 mb-16 flex-wrap">

          {/* ===== PREMIUM CARD ===== */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.03 }}
          >
            <div
              className="relative rounded-2xl shadow-2xl p-8 overflow-hidden"
              style={{
                width: "420px",
                height: "250px",
                background:
                  card.cardCompany === "VISA"
                    ? "linear-gradient(135deg,#0f2027,#203a43,#2c5364)"
                    : card.cardCompany === "MASTERCARD"
                    ? "linear-gradient(135deg,#c31432,#240b36)"
                    : card.cardCompany === "AMEX"
                    ? "linear-gradient(135deg,#1e3c72,#2a5298)"
                    : "linear-gradient(135deg,#1c1c1c,#000000)"
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent"></div>

              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm tracking-widest text-gray-300">
                    {card.bankName || "CREDX BANK"}
                  </p>
                  <p className="text-lg font-semibold mt-1 text-[#f0e2a0]">
                    {card.cardCompany || "CARD"}
                  </p>
                </div>

                <p className="text-sm uppercase text-gray-300">
                  {card.cardType}
                </p>
              </div>

              <div className="mt-12">
                <p className="text-2xl tracking-[5px] font-mono text-white">
                  {card.maskedNumber}
                </p>
              </div>

              <div className="flex justify-between mt-12">
                <div>
                  <p className="text-xs text-gray-400">Card Holder</p>
                  <p className="text-sm font-semibold uppercase">
                    {card.name}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-gray-400">Expires</p>
                  <p className="text-sm font-semibold">
                    {card.expiryDate}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ===== ACCOUNT DETAILS PANEL ===== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-gray-900 to-black border border-gray-700 rounded-2xl shadow-xl p-8 w-[420px]"
          >
            <h2 className="text-xl font-bold mb-8 text-[#f0e2a0]">
              Account Details
            </h2>

            <div className="space-y-8 text-sm">

              <div>
                <p className="text-gray-400">Bank Name</p>
                <p className="font-semibold">
                  {card.bankName || "CREDX BANK"}
                </p>
              </div>

              <div>
                <p className="text-gray-400">Account Number</p>
                <p className="font-semibold">
                  {card.accountNumber || "XXXX XXXX 1234"}
                </p>
              </div>

              <div>
                <p className="text-gray-400">Card Type</p>
                <p className="font-semibold uppercase">
                  {card.cardType}
                </p>
              </div>

              <div>
                <p className="text-gray-400">Available Balance</p>
                <p className="font-semibold text-lg text-[#f0e2a0]">
                  ₹ {card.availableBalance || "0.00"}
                </p>
              </div>

            </div>
          </motion.div>

        </div>
      )}

      {/* ===== TRANSACTIONS ===== */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-gray-900 to-black border border-gray-700 rounded-3xl shadow-2xl p-10"
      >
        <h1 className="text-2xl font-bold mb-8 text-[#f0e2a0]">
          Card Transactions
        </h1>

        <button
          onClick={async () => {
            await API.post("/cards/simulate", {
              cardId: id,
              count: 10
            });
            fetchTransactions();
          }}
          className="mb-8 bg-gradient-to-r from-[#bfa34a] to-[#f0e2a0] text-black px-6 py-2 rounded-md font-semibold shadow-md hover:opacity-90 transition"
        >
          Simulate 10 Transactions
        </button>

        {transactions.length === 0 && (
          <p className="text-gray-400">No transactions yet.</p>
        )}

        {transactions.map((tx) => (
          <div key={tx.id} className="flex justify-between border-b border-gray-700 py-5">
            <div>
              <p className="font-semibold">{tx.merchant}</p>
              <p className="text-sm text-gray-400">
                {new Date(tx.createdAt).toLocaleString()}
              </p>
            </div>

            <div className="text-right">
              <p className="font-bold text-white">₹ {tx.amount}</p>
              {tx.isFraud && (
                <p className="text-red-500 text-sm">
                  ⚠ Fraud Detected
                </p>
              )}
            </div>
          </div>
        ))}
      </motion.div>

    </div>
  );
}