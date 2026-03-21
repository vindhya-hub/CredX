// import { useEffect, useState } from "react";
// import API from "../services/api";
// import { motion } from "framer-motion";
// import {
//   LineChart,
//   Line,
//   BarChart,
//   Bar,
//   PieChart,
//   Pie,
//   Cell,
//   XAxis,
//   YAxis,
//   Tooltip,
//   ResponsiveContainer,
//   CartesianGrid,
//   Legend
// } from "recharts";

// export default function Dashboard() {
//   const [user, setUser] = useState(null);
//   const [transactions, setTransactions] = useState([]);
//   const [analytics, setAnalytics] = useState([]);
//   const [monthlyMerchantData, setMonthlyMerchantData] = useState([]);
//   const [categoryData, setCategoryData] = useState([]);
//   const [merchantKeys, setMerchantKeys] = useState([]);
//   const [cards, setCards] = useState([]);
//   const [selectedCardId, setSelectedCardId] = useState(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     fetchDashboard();
//   }, []);

//   const fetchDashboard = async () => {
//     try {
//       const profile = await API.get("/auth/profile");
//       setUser(profile.data);

//       const cardsRes = await API.get("/cards");
//       setCards(cardsRes.data);

//       if (cardsRes.data.length === 0) return;

//       const primaryCard =
//         cardsRes.data.find(c => c.isPrimary) || cardsRes.data[0];

//       setSelectedCardId(primaryCard.id);
//       await loadCardTransactions(primaryCard.id);
//     } catch (err) {
//       console.error("Dashboard error:", err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const loadCardTransactions = async (cardId) => {
//     const txRes = await API.get(`/cards/${cardId}/transactions`);
//     const txData = txRes.data;

//     setTransactions(txData);

//     const latestTx = [...txData]
//       .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
//       .slice(-10);

//     setAnalytics(
//       latestTx.map(tx => ({
//         date: new Date(tx.createdAt).toLocaleDateString("en-IN", {
//           day: "2-digit",
//           month: "short"
//         }),
//         amount: Number(tx.amount)
//       }))
//     );

//     const monthlyMap = {};
//     const merchantsSet = new Set();
//     const merchantTotals = {};

//     txData.forEach(tx => {
//       const month = new Date(tx.createdAt).toLocaleString("default", {
//         month: "short"
//       });

//       merchantsSet.add(tx.merchant);

//       if (!monthlyMap[month]) monthlyMap[month] = { month };
//       if (!monthlyMap[month][tx.merchant]) monthlyMap[month][tx.merchant] = 0;

//       monthlyMap[month][tx.merchant] += Number(tx.amount);

//       if (!merchantTotals[tx.merchant]) merchantTotals[tx.merchant] = 0;
//       merchantTotals[tx.merchant] += Number(tx.amount);
//     });

//     setMerchantKeys(Array.from(merchantsSet));
//     setMonthlyMerchantData(Object.values(monthlyMap));

//     setCategoryData(
//       Object.keys(merchantTotals).map(key => ({
//         name: key,
//         value: merchantTotals[key]
//       }))
//     );
//   };

//   if (loading)
//     return (
//       <div className="flex items-center justify-center h-screen bg-black text-white">
//         Loading dashboard...
//       </div>
//     );

//   const totalSpent = transactions.reduce(
//     (sum, tx) => sum + Number(tx.amount),
//     0
//   );

//   const totalTransactions = transactions.length;
//   const fraudCount = transactions.filter(tx => tx.isFraud).length;

//   const PIE_COLORS = [
//     "#00C49F",
//     "#FF8042",
//     "#FFBB28",
//     "#8884D8",
//     "#FF4560",
//     "#0088FE"
//   ];

//   return (
//     <div className="px-12 py-10 min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white">

//       <motion.h1
//         initial={{ opacity: 0, y: -40 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.8 }}
//         className="text-4xl font-bold mb-12 premium-gold tracking-wide"
//       >
//         CredX Dashboard
//       </motion.h1>

//       <div className="grid md:grid-cols-4 gap-8 mb-12">
//         <StatCard title="Wallet Balance" value={`₹ ${user.wallet?.balance || 0}`} />
//         <StatCard title="Total Spent" value={`₹ ${totalSpent}`} />
//         <StatCard title="Transactions" value={totalTransactions} />
//         <StatCard title="Fraud Alerts" value={fraudCount} />
//       </div>

//       <div className="mb-12">
//         <label className="mr-3 text-white font-semibold">Select Card:</label>
//         <select
//           value={selectedCardId || ""}
//           onChange={async (e) => {
//             const cardId = e.target.value;
//             setSelectedCardId(cardId);
//             await loadCardTransactions(cardId);
//           }}
//           className="bg-black border border-gray-600 text-white px-4 py-2 rounded-lg"
//         >
//           {cards.map(card => (
//             <option key={card.id} value={card.id}>
//               {card.maskedNumber} ({card.cardType})
//             </option>
//           ))}
//         </select>
//       </div>

//       <div className="grid lg:grid-cols-3 gap-10">

//         {/* Spending Trend (ONLY CHANGE: thinner line) */}
//         <AnimatedCard>
//           <h2 className="text-lg font-semibold mb-4 text-white">
//             Spending Trend
//           </h2>
//           <ResponsiveContainer width="100%" height={260}>
//             <LineChart data={analytics}>
//               <CartesianGrid strokeDasharray="3 3" stroke="#333" />
//               <XAxis dataKey="date" stroke="#ccc" />
//               <YAxis stroke="#ccc" />
//               <Tooltip />
//               <Line
//                 type="monotone"
//                 dataKey="amount"
//                 stroke="#ffffff"
//                 strokeWidth={1.2}  
//                 dot={{ r: 2 }}
//               />
//             </LineChart>
//           </ResponsiveContainer>
//         </AnimatedCard>

//         {/* Monthly Merchant */}
//         <AnimatedCard>
//           <h2 className="text-lg font-semibold mb-4 text-white">
//             Monthly Merchant Spendings
//           </h2>
//           <ResponsiveContainer width="100%" height={260}>
//             <BarChart data={monthlyMerchantData}>
//               <CartesianGrid strokeDasharray="3 3" stroke="#333" />
//               <XAxis dataKey="month" stroke="#ccc" />
//               <YAxis stroke="#ccc" />
//               <Tooltip />
//               <Legend />
//               {merchantKeys.map((merchant, index) => (
//                 <Bar
//                   key={merchant}
//                   dataKey={merchant}
//                   fill={`hsl(${index * 60}, 70%, 55%)`}
//                 />
//               ))}
//             </BarChart>
//           </ResponsiveContainer>
//         </AnimatedCard>

//         {/* Pie Chart */}
//         <AnimatedCard>
//           <h2 className="text-lg font-semibold mb-4 text-white">
//             Spending Distribution
//           </h2>
//           <ResponsiveContainer width="100%" height={260}>
//             <PieChart>
//               <Pie
//                 data={categoryData}
//                 dataKey="value"
//                 nameKey="name"
//                 outerRadius={90}
//                 label
//               >
//                 {categoryData.map((entry, index) => (
//                   <Cell
//                     key={`cell-${index}`}
//                     fill={PIE_COLORS[index % PIE_COLORS.length]}
//                   />
//                 ))}
//               </Pie>
//               <Tooltip />
//               <Legend />
//             </PieChart>
//           </ResponsiveContainer>
//         </AnimatedCard>

//       </div>
//     </div>
//   );
// }

// function AnimatedCard({ children }) {
//   return (
//     <motion.div
//       whileHover={{ scale: 1.03 }}
//       transition={{ duration: 0.3 }}
//       className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl shadow-xl border border-gray-700"
//     >
//       {children}
//     </motion.div>
//   );
// }

// function StatCard({ title, value }) {
//   return (
//     <motion.div
//       whileHover={{ scale: 1.05 }}
//       className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl shadow-lg border border-gray-700"
//     >
//       <h2 className="text-sm uppercase tracking-wide text-gray-400">
//         {title}
//       </h2>
//       <p className="text-3xl mt-3 font-bold text-white">
//         {value}
//       </p>
//     </motion.div>
//   );
// }
import { useEffect, useState } from "react";
import API from "../services/api";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from "recharts";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [monthlyMerchantData, setMonthlyMerchantData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [merchantKeys, setMerchantKeys] = useState([]);
  const [cards, setCards] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const profile = await API.get("/auth/profile");
      setUser(profile.data);

      const cardsRes = await API.get("/cards");
      setCards(cardsRes.data);

      if (cardsRes.data.length === 0) return;

      const primaryCard =
        cardsRes.data.find(c => c.isPrimary) || cardsRes.data[0];

      setSelectedCardId(primaryCard.id);
      await loadCardTransactions(primaryCard.id);
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadCardTransactions = async (cardId) => {
    const txRes = await API.get(`/cards/${cardId}/transactions`);
    const txData = txRes.data;

    setTransactions(txData);

    const latestTx = [...txData]
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(-10);

    setAnalytics(
      latestTx.map(tx => ({
        date: new Date(tx.createdAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short"
        }),
        amount: Number(tx.amount)
      }))
    );

    const monthlyMap = {};
    const merchantsSet = new Set();
    const merchantTotals = {};

    txData.forEach(tx => {
      const month = new Date(tx.createdAt).toLocaleString("default", {
        month: "short"
      });

      merchantsSet.add(tx.merchant);

      if (!monthlyMap[month]) monthlyMap[month] = { month };
      if (!monthlyMap[month][tx.merchant]) monthlyMap[month][tx.merchant] = 0;

      monthlyMap[month][tx.merchant] += Number(tx.amount);

      if (!merchantTotals[tx.merchant]) merchantTotals[tx.merchant] = 0;
      merchantTotals[tx.merchant] += Number(tx.amount);
    });

    setMerchantKeys(Array.from(merchantsSet));
    setMonthlyMerchantData(Object.values(monthlyMap));

    setCategoryData(
      Object.keys(merchantTotals).map(key => ({
        name: key,
        value: merchantTotals[key]
      }))
    );
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        Loading dashboard...
      </div>
    );

  const totalSpent = transactions.reduce(
    (sum, tx) => sum + Number(tx.amount),
    0
  );

  const totalTransactions = transactions.length;
  const fraudCount = transactions.filter(tx => tx.isFraud).length;

  // ✅ NEW: Total Available Credit Calculation
  const totalAvailableCredit = cards
    .filter(c => c.cardType === "credit")
    .reduce((sum, c) => sum + Number(c.availableCredit || 0), 0);

  const PIE_COLORS = [
    "#00C49F",
    "#FF8042",
    "#FFBB28",
    "#8884D8",
    "#FF4560",
    "#0088FE"
  ];

  return (
    <div className="px-12 py-10 min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white">

      <motion.h1
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-4xl font-bold mb-12 premium-gold tracking-wide"
      >
        CredX Dashboard
      </motion.h1>

      {/* ✅ UPDATED: Now 6 Stat Cards */}
      <div className="grid md:grid-cols-6 gap-8 mb-12">
        <StatCard title="Wallet Balance" value={`₹ ${user.wallet?.balance || 0}`} />
        <StatCard title="Credit Score" value={user.credit_score || 0} />
        <StatCard title="Available Credit" value={`₹ ${totalAvailableCredit}`} />
        <StatCard title="Total Spent" value={`₹ ${totalSpent}`} />
        <StatCard title="Transactions" value={totalTransactions} />
        <StatCard title="Fraud Alerts" value={fraudCount} />
      </div>

      <div className="mb-12">
        <label className="mr-3 text-white font-semibold">Select Card:</label>
        <select
          value={selectedCardId || ""}
          onChange={async (e) => {
            const cardId = e.target.value;
            setSelectedCardId(cardId);
            await loadCardTransactions(cardId);
          }}
          className="bg-black border border-gray-600 text-white px-4 py-2 rounded-lg"
        >
          {cards.map(card => (
            <option key={card.id} value={card.id}>
              {card.maskedNumber} ({card.cardType})
            </option>
          ))}
        </select>
      </div>

      <div className="grid lg:grid-cols-3 gap-10">

        <AnimatedCard>
          <h2 className="text-lg font-semibold mb-4 text-white">
            Spending Trend
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={analytics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#ccc" />
              <YAxis stroke="#ccc" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#ffffff"
                strokeWidth={1.2}
                dot={{ r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </AnimatedCard>

        <AnimatedCard>
          <h2 className="text-lg font-semibold mb-4 text-white">
            Monthly Merchant Spendings
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyMerchantData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="month" stroke="#ccc" />
              <YAxis stroke="#ccc" />
              <Tooltip />
              <Legend />
              {merchantKeys.map((merchant, index) => (
                <Bar
                  key={merchant}
                  dataKey={merchant}
                  fill={`hsl(${index * 60}, 70%, 55%)`}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </AnimatedCard>

        <AnimatedCard>
          <h2 className="text-lg font-semibold mb-4 text-white">
            Spending Distribution
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={categoryData}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                label
              >
                {categoryData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </AnimatedCard>

      </div>
    </div>
  );
}

function AnimatedCard({ children }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.3 }}
      className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl shadow-xl border border-gray-700"
    >
      {children}
    </motion.div>
  );
}

function StatCard({ title, value }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl shadow-lg border border-gray-700"
    >
      <h2 className="text-sm uppercase tracking-wide text-gray-400">
        {title}
      </h2>
      <p className="text-3xl mt-3 font-bold text-white">
        {value}
      </p>
    </motion.div>
  );
}