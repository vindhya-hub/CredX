// import { useEffect, useState } from "react";
// import API from "../services/api";
// import { motion } from "framer-motion";

// export default function Wallet() {
//   const [wallet, setWallet] = useState(null);
//   const [email, setEmail] = useState("");
//   const [amount, setAmount] = useState("");
//   const [addAmount, setAddAmount] = useState("");
//   const [cards, setCards] = useState([]);
//   const [selectedCardId, setSelectedCardId] = useState("");

//   useEffect(() => {
//     fetchWallet();
//     fetchCards();
//   }, []);

//   const fetchWallet = async () => {
//     const res = await API.get("/wallet");
//     setWallet(res.data);
//   };

//   const fetchCards = async () => {
//     const res = await API.get("/cards");
//     setCards(res.data);
//     if (res.data.length > 0) {
//       setSelectedCardId(res.data[0].id);
//     }
//   };

//   const transfer = async () => {
//     await API.post("/wallet/transfer", {
//       email,
//       amount: Number(amount)
//     });
//     setEmail("");
//     setAmount("");
//     fetchWallet();
//   };

//   const addMoney = async () => {
//     await API.post("/wallet/add-money", {
//       amount: Number(addAmount),
//       cardId: selectedCardId
//     });
//     setAddAmount("");
//     fetchWallet();
//   };

//   if (!wallet)
//     return (
//       <div className="flex items-center justify-center h-screen bg-black text-white">
//         Loading...
//       </div>
//     );

//   return (
//     <motion.div
//       initial={{ opacity: 0 }}
//       animate={{ opacity: 1 }}
//       className="px-12 py-10 min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white"
//     >
//       <h1 className="text-3xl font-bold mb-8 executive-gold">
//         Wallet
//       </h1>

//       {/* Balance Card */}
//       <motion.div
//         whileHover={{ scale: 1.03 }}
//         className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl shadow-xl border border-gray-700 mb-10"
//       >
//         <p className="text-lg text-gray-400">Balance</p>
//         <p className="text-3xl font-bold text-white">
//           ₹ {wallet.balance}
//         </p>
//       </motion.div>

//       {/* Add Money Section */}
//       <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl shadow-xl border border-gray-700 mb-8">
//         <h2 className="text-xl font-semibold mb-4 text-white">
//           Add Money
//         </h2>

//         {/* Card Dropdown */}
//         <select
//           value={selectedCardId}
//           onChange={(e) => setSelectedCardId(e.target.value)}
//           className="bg-black border border-gray-600 p-3 w-full mb-4 rounded text-white"
//         >
//           {cards.map(card => (
//             <option key={card.id} value={card.id}>
//               {card.maskedNumber} ({card.cardType})
//             </option>
//           ))}
//         </select>

//         <input
//           type="number"
//           placeholder="Enter Amount"
//           value={addAmount}
//           onChange={(e) => setAddAmount(e.target.value)}
//           className="bg-black border border-gray-600 p-3 w-full mb-4 rounded text-white"
//         />

//         <button
//           onClick={addMoney}
//           className="bg-gradient-to-r from-[#bfa34a] to-[#f0e2a0] text-black px-4 py-2 rounded-md hover:opacity-90 transition"
//         >
//           Add Money
//         </button>
//       </div>

//       {/* Transfer Section */}
//       <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl shadow-xl border border-gray-700">
//         <h2 className="text-xl font-semibold mb-4 text-white">
//           Transfer Money
//         </h2>

//         <input
//           type="email"
//           placeholder="Receiver Email"
//           value={email}
//           onChange={(e) => setEmail(e.target.value)}
//           className="bg-black border border-gray-600 p-3 w-full mb-4 rounded text-white"
//         />

//         <input
//           type="number"
//           placeholder="Amount"
//           value={amount}
//           onChange={(e) => setAmount(e.target.value)}
//           className="bg-black border border-gray-600 p-3 w-full mb-4 rounded text-white"
//         />

//         <button
//           onClick={transfer}
//           className="bg-gradient-to-r from-[#bfa34a] to-[#f0e2a0] text-black px-4 py-2 rounded-md hover:opacity-90 transition"
//         >
//           Transfer
//         </button>
//       </div>
//     </motion.div>
//   );
// }

import { useEffect, useState } from "react";
import API from "../services/api";
import { motion } from "framer-motion";

export default function Wallet() {
  const [wallet, setWallet] = useState(null);
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [cards, setCards] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState("");

  useEffect(() => {
    fetchWallet();
    fetchCards();
  }, []);

  const fetchWallet = async () => {
    const res = await API.get("/wallet");
    setWallet(res.data);
  };

  const fetchCards = async () => {
    const res = await API.get("/cards");
    setCards(res.data);
    if (res.data.length > 0) {
      setSelectedCardId(res.data[0].id);
    }
  };

  const transfer = async () => {
    await API.post("/wallet/transfer", {
      email,
      amount: Number(amount)
    });
    setEmail("");
    setAmount("");
    fetchWallet();
  };

  const addMoney = async () => {
    await API.post("/wallet/add-money", {
      amount: Number(addAmount),
      cardId: selectedCardId
    });
    setAddAmount("");
    fetchWallet();
  };

  if (!wallet)
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        Loading...
      </div>
    );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-16 py-12 min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white"
    >
      {/* Header */}
      <h1 className="text-4xl font-semibold tracking-wide mb-12 bg-gradient-to-r from-[#d4af37] via-[#f5e6b2] to-[#bfa34a] bg-clip-text text-transparent">
        Wallet
      </h1>

      {/* Balance Card */}
      <motion.div
        whileHover={{ scale: 1.015 }}
        transition={{ duration: 0.3 }}
        className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-3xl shadow-2xl border border-gray-800 mb-12"
      >
        <p className="text-sm uppercase tracking-widest text-gray-500 mb-2">
          Current Balance
        </p>
        <p className="text-4xl font-light text-white tracking-wide">
          ₹ {wallet.balance}
        </p>
      </motion.div>

      {/* Add Money */}
      <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-3xl shadow-xl border border-gray-800 mb-10">
        <h2 className="text-lg font-medium mb-6 tracking-wide text-gray-200">
          Add Funds
        </h2>

        <div className="space-y-5">
          <select
            value={selectedCardId}
            onChange={(e) => setSelectedCardId(e.target.value)}
            className="bg-black border border-gray-700 p-3 w-full rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#d4af37]"
          >
            {cards.map(card => (
              <option key={card.id} value={card.id}>
                {card.maskedNumber} ({card.cardType})
              </option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Enter Amount"
            value={addAmount}
            onChange={(e) => setAddAmount(e.target.value)}
            className="bg-black border border-gray-700 p-3 w-full rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#d4af37]"
          />

          <button
            onClick={addMoney}
            className="bg-gradient-to-r from-[#c6a84f] to-[#f1e3a1] text-black font-medium px-6 py-3 rounded-lg shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300"
          >
            Add Money
          </button>
        </div>
      </div>

      {/* Transfer Money */}
      <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-3xl shadow-xl border border-gray-800">
        <h2 className="text-lg font-medium mb-6 tracking-wide text-gray-200">
          Transfer Funds
        </h2>

        <div className="space-y-5">
          <input
            type="email"
            placeholder="Receiver Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-black border border-gray-700 p-3 w-full rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#d4af37]"
          />

          <input
            type="number"
            placeholder="Enter Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-black border border-gray-700 p-3 w-full rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#d4af37]"
          />

          <button
            onClick={transfer}
            className="bg-gradient-to-r from-[#c6a84f] to-[#f1e3a1] text-black font-medium px-6 py-3 rounded-lg shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300"
          >
            Transfer
          </button>
        </div>
      </div>
    </motion.div>
  );
}