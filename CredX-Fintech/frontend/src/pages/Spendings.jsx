import { useEffect, useState } from "react";
import API from "../services/api";
import { motion } from "framer-motion";

export default function Spendings() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    API.get("/cards/spendings").then((res) => {
      if (active) setData(res.data);
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!data) return <div>Loading...</div>;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-5xl mx-auto"
    >
      <h1 className="text-3xl font-bold mb-6">Total Spendings</h1>

      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <p className="text-2xl font-semibold">
          ₹ {data.totalSpent}
        </p>
      </div>

      {data.transactions.map((tx) => (
        <div
          key={tx.id}
          className="bg-white p-4 rounded shadow mb-3 flex justify-between"
        >
          <div>
            <p>{tx.merchant}</p>
            <p className="text-sm text-gray-500">
              {new Date(tx.createdAt).toLocaleString()}
            </p>
          </div>

          <p className="font-semibold">₹ {tx.amount}</p>
        </div>
      ))}
    </motion.div>
  );
}