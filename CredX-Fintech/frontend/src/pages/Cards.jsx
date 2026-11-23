// import { useEffect, useState } from "react";
// import API from "../services/api";
// import { motion } from "framer-motion";
// import { useNavigate } from "react-router-dom";

// export default function Cards() {
//   const navigate = useNavigate();

//   const [cards, setCards] = useState([]);
//   const [type, setType] = useState("debit");
//   const [cardNumber, setCardNumber] = useState("");
//   const [cvv, setCvv] = useState("");
//   const [expiry, setExpiry] = useState("");
//   const [name, setName] = useState("");
//   const [cardCompany, setCardCompany] = useState("");
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     fetchCards();
//   }, []);

//   const fetchCards = async () => {
//     const res = await API.get("/cards");
//     setCards(res.data);
//   };

//   const detectCardCompany = (number) => {
//     if (/^4/.test(number)) return "VISA";
//     if (/^5[1-5]/.test(number)) return "MASTERCARD";
//     if (/^3[47]/.test(number)) return "AMEX";
//     return "CARD";
//   };

//   const handleCardNumber = (e) => {
//     let value = e.target.value.replace(/\D/g, "");
//     if (value.length > 16) value = value.slice(0, 16);
//     setCardCompany(detectCardCompany(value));
//     setCardNumber(value.replace(/(.{4})/g, "$1 ").trim());
//   };

//   const handleExpiry = (e) => {
//     let value = e.target.value.replace(/\D/g, "");
//     if (value.length > 4) value = value.slice(0, 4);
//     if (value.length >= 3) {
//       value = value.slice(0, 2) + "/" + value.slice(2);
//     }
//     setExpiry(value);
//   };

//   const createCard = async () => {
//     if (!cardNumber || !cvv || !expiry || !name)
//       return alert("Fill all fields");

//     const cleanNumber = cardNumber.replace(/\s/g, "");

//     if (cleanNumber.length !== 16)
//       return alert("Card must be 16 digits");

//     if (cvv.length !== 3)
//       return alert("CVV must be 3 digits");

//     setLoading(true);

//     try {
//       await API.post("/cards/create", {
//         type,
//         cardNumber: cleanNumber,
//         cvv,
//         expiryDate: expiry,
//         name
//       });

//       setCardNumber("");
//       setCvv("");
//       setExpiry("");
//       setName("");
//       setCardCompany("");
//       fetchCards();
//     } catch (err) {
//       alert(err.response?.data?.message || "Error");
//     }

//     setLoading(false);
//   };

//   const deleteCard = async (id) => {
//     if (!window.confirm("Delete this card?")) return;
//     await API.delete(`/cards/${id}`);
//     fetchCards();
//   };

//   const getCardGradient = (brand) => {
//     switch (brand) {
//       case "VISA":
//         return "from-blue-900 via-blue-700 to-blue-500";
//       case "MASTERCARD":
//         return "from-red-700 via-orange-600 to-yellow-500";
//       case "AMEX":
//         return "from-sky-800 via-cyan-600 to-blue-400";
//       default:
//         return "from-gray-800 to-gray-600";
//     }
//   };

//   return (
//     <div className="px-16 py-14 min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white">

//       <h1 className="text-4xl font-semibold mb-12 bg-gradient-to-r from-[#d4af37] via-[#f5e6b2] to-[#bfa34a] bg-clip-text text-transparent">
//         Your Cards
//       </h1>

//       {/* CREATE CARD */}
//       <motion.div
//         initial={{ opacity: 0, y: -40 }}
//         animate={{ opacity: 1, y: 0 }}
//         className="bg-gradient-to-br from-gray-900 to-black rounded-3xl border border-gray-800 shadow-2xl p-10 mb-16"
//       >
//         <h2 className="text-lg font-medium mb-8">Add New Card</h2>

//         <div className="grid grid-cols-2 gap-6 mb-8">
//           <input
//             placeholder="Cardholder Name"
//             value={name}
//             onChange={(e) => setName(e.target.value)}
//             className="bg-black border border-gray-700 p-3 rounded-xl"
//           />

//           <select
//             value={type}
//             onChange={(e) => setType(e.target.value)}
//             className="bg-black border border-gray-700 p-3 rounded-xl"
//           >
//             <option value="debit">Debit</option>
//             <option value="credit">Credit</option>
//           </select>

//           <input
//             placeholder="Card Number"
//             value={cardNumber}
//             onChange={handleCardNumber}
//             className="bg-black border border-gray-700 p-3 rounded-xl col-span-2"
//           />

//           {cardCompany && (
//             <p className="col-span-2 text-lg font-semibold text-[#d4af37] tracking-widest">
//               {cardCompany}
//             </p>
//           )}

//           <input
//             placeholder="MM/YY"
//             value={expiry}
//             onChange={handleExpiry}
//             className="bg-black border border-gray-700 p-3 rounded-xl"
//           />

//           <input
//             placeholder="CVV"
//             type="password"
//             value={cvv}
//             onChange={(e) =>
//               setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))
//             }
//             className="bg-black border border-gray-700 p-3 rounded-xl"
//           />
//         </div>

//         <button
//           onClick={createCard}
//           disabled={loading}
//           className="bg-gradient-to-r from-[#c6a84f] to-[#f1e3a1] text-black px-6 py-3 rounded-xl transition hover:scale-[1.02]"
//         >
//           {loading ? "Creating..." : "Create Card"}
//         </button>
//       </motion.div>

//       {/* CARD LIST */}
//       <div className="grid md:grid-cols-2 gap-10">
//         {cards.map((card) => {
//           const brand =
//             card.cardCompany ||
//             detectCardCompany(card.maskedNumber?.replace(/\*/g, "") || "");

//           return (
//             <motion.div
//               key={card.id}
//               whileHover={{ scale: 1.03 }}
//               initial={{ opacity: 0, y: 40 }}
//               animate={{ opacity: 1, y: 0 }}
//               className={`relative rounded-3xl p-8 shadow-2xl bg-gradient-to-r ${getCardGradient(
//                 brand
//               )} text-white`}
//             >
//               <div className="flex justify-between items-start">

//                 <div>
//                   <p className="text-sm tracking-widest opacity-70 mb-4">
//                     {brand}
//                   </p>

//                   <h3 className="text-2xl tracking-widest font-semibold mb-6">
//                     {card.maskedNumber}
//                   </h3>

//                   <p className="text-sm opacity-70 uppercase">
//                     {card.cardType}
//                   </p>
//                 </div>

//                 {/* DELETE FIX */}
//                 <button
//                   onClick={() => deleteCard(card.id)}
//                   className="bg-black/30 px-3 py-1 rounded-lg hover:bg-black/50 transition"
//                 >
//                   Delete
//                 </button>

//               </div>

//               {/* VIEW DETAILS FIX */}
//               <div className="mt-8">
//                 <button
//                   onClick={() => navigate(`/cards/${card.id}`)}
//                   className="bg-white text-black px-5 py-2 rounded-xl font-semibold hover:scale-105 transition"
//                 >
//                   View Details
//                 </button>
//               </div>
//             </motion.div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }
import { useEffect, useState } from "react";
import API, { errorMessage } from "../services/api";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function Cards() {
  const navigate = useNavigate();

  const [cards, setCards] = useState([]);
  const [version, setVersion] = useState(0);
  const [type, setType] = useState("debit");
  const [cardNumber, setCardNumber] = useState("");
  const [cvv, setCvv] = useState("");
  const [expiry, setExpiry] = useState("");
  const [name, setName] = useState("");
  const [cardCompany, setCardCompany] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    API.get("/cards").then((res) => {
      if (active) setCards(res.data);
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, [version]);

  const fetchCards = () => setVersion((v) => v + 1);

  const detectCardCompany = (number) => {
    if (/^4/.test(number)) return "VISA";
    if (/^5[1-5]/.test(number)) return "MASTERCARD";
    if (/^3[47]/.test(number)) return "AMEX";
    return "CARD";
  };

  const handleCardNumber = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 16) value = value.slice(0, 16);
    setCardCompany(detectCardCompany(value));
    setCardNumber(value.replace(/(.{4})/g, "$1 ").trim());
  };

  const handleExpiry = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length >= 3) {
      value = value.slice(0, 2) + "/" + value.slice(2);
    }
    setExpiry(value);
  };

  const createCard = async () => {
    if (!cardNumber || !cvv || !expiry || !name)
      return alert("Fill all fields");

    const cleanNumber = cardNumber.replace(/\s/g, "");

    if (cleanNumber.length !== 16)
      return alert("Card must be 16 digits");

    if (cvv.length < 3)
      return alert("CVV must be 3 or 4 digits");

    setLoading(true);

    try {
      await API.post("/cards/create", {
        type,
        cardNumber: cleanNumber,
        cvv,
        expiryDate: expiry,
        name
      });

      setCardNumber("");
      setCvv("");
      setExpiry("");
      setName("");
      setCardCompany("");
      fetchCards();
    } catch (err) {
      alert(errorMessage(err, "Could not add the card"));
    }

    setLoading(false);
  };

  const deleteCard = async (id) => {
    if (!window.confirm("Delete this card?")) return;
    try {
      await API.delete(`/cards/${id}`);
    } catch (err) {
      alert(errorMessage(err, "Could not delete the card"));
    }
    fetchCards();
  };

  const getCardGradient = (brand) => {
    switch (brand) {
      case "VISA":
        return "from-blue-900 via-blue-700 to-blue-500";
      case "MASTERCARD":
        return "from-red-700 via-orange-600 to-yellow-500";
      case "AMEX":
        return "from-sky-800 via-cyan-600 to-blue-400";
      default:
        return "from-gray-800 to-gray-600";
    }
  };

  return (
    <div className="px-16 py-14 min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white">

      <h1 className="text-4xl font-semibold mb-12 bg-gradient-to-r from-[#d4af37] via-[#f5e6b2] to-[#bfa34a] bg-clip-text text-transparent">
        Your Cards
      </h1>

      {/* CREATE CARD (UNCHANGED) */}
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-gray-900 to-black rounded-3xl border border-gray-800 shadow-2xl p-10 mb-16"
      >
        <h2 className="text-lg font-medium mb-8">Add New Card</h2>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <input
            placeholder="Cardholder Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-black border border-gray-700 p-3 rounded-xl"
          />

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="bg-black border border-gray-700 p-3 rounded-xl"
          >
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>

          <input
            placeholder="Card Number"
            value={cardNumber}
            onChange={handleCardNumber}
            className="bg-black border border-gray-700 p-3 rounded-xl col-span-2"
          />

          {cardCompany && (
            <p className="col-span-2 text-lg font-semibold text-[#d4af37] tracking-widest">
              {cardCompany}
            </p>
          )}

          <input
            placeholder="MM/YY"
            value={expiry}
            onChange={handleExpiry}
            className="bg-black border border-gray-700 p-3 rounded-xl"
          />

          <input
            placeholder="CVV"
            type="password"
            value={cvv}
            onChange={(e) =>
              setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            className="bg-black border border-gray-700 p-3 rounded-xl"
          />
        </div>

        <button
          onClick={createCard}
          disabled={loading}
          className="bg-gradient-to-r from-[#c6a84f] to-[#f1e3a1] text-black px-6 py-3 rounded-xl transition hover:scale-[1.02]"
        >
          {loading ? "Creating..." : "Create Card"}
        </button>
      </motion.div>

      {/* CARD LIST — ACTUAL SIZE FIX */}
      <div className="grid md:grid-cols-2 gap-10 justify-items-center">
        {cards.map((card) => {
          const brand = card.brand || "CARD";

          return (
            <motion.div
              key={card.id}
              whileHover={{ scale: 1.04 }}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className={`relative rounded-2xl shadow-xl bg-gradient-to-r ${getCardGradient(
                brand
              )} text-white`}
              style={{
                width: "380px",
                height: "220px"
              }}
            >
              <div className="p-6 h-full flex flex-col justify-between">

                <div className="flex justify-between items-start">
                  <p className="text-xs tracking-widest opacity-70">
                    {brand}
                  </p>

                  <button
                    onClick={() => deleteCard(card.id)}
                    className="bg-black/30 px-3 py-1 text-xs rounded-lg hover:bg-black/50 transition"
                  >
                    Delete
                  </button>
                </div>

                <div>
                  <h3 className="text-xl tracking-widest font-semibold mb-2">
                    {card.maskedNumber}
                  </h3>

                  <p className="text-xs opacity-70 uppercase">
                    {card.cardType}
                  </p>
                </div>

                <button
                  onClick={() => navigate(`/cards/${card.id}`)}
                  className="bg-white text-black px-4 py-2 text-sm rounded-lg font-semibold w-fit"
                >
                  View Details
                </button>

              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}