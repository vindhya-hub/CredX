import { useEffect, useState } from "react";
import API, { errorMessage } from "../services/api";
import { motion } from "framer-motion";

const money = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const LEDGER_LABELS = {
  transfer: "Transfer",
  deposit: "Top-up",
  loan_disbursement: "Loan disbursement",
  emi_payment: "EMI payment",
  card_payment: "Card bill payment",
};

const inputClass = "bg-black border border-gray-700 p-3 w-full rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#d4af37]";
const buttonClass = "bg-gradient-to-r from-[#c6a84f] to-[#f1e3a1] text-black font-medium px-6 py-3 rounded-lg shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300 disabled:opacity-60";

export default function Wallet() {
  const [wallet, setWallet] = useState(null);
  const [cards, setCards] = useState([]);
  const [history, setHistory] = useState([]);
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [source, setSource] = useState(""); // "" = simulated bank transfer, else a credit card id
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([API.get("/wallet"), API.get("/cards"), API.get("/transactions/history?limit=10")])
      .then(([walletRes, cardsRes, historyRes]) => {
        if (!active) return;
        setWallet(walletRes.data);
        setCards(cardsRes.data);
        setHistory(historyRes.data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [version]);

  const reload = () => setVersion((v) => v + 1);
  const creditCards = cards.filter((c) => c.cardType === "credit" && c.status === "active");

  const run = async (action, onDone) => {
    setBusy(true);
    try {
      await action();
      onDone();
      reload();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const transfer = () =>
    run(() => API.post("/transactions/transfer", { receiverEmail: email, amount: Number(amount) }), () => {
      setEmail("");
      setAmount("");
    });

  const addMoney = () =>
    run(() => API.post("/wallet/add-money", { amount: Number(addAmount), ...(source && { cardId: source }) }), () => setAddAmount(""));

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
      <h1 className="text-4xl font-semibold tracking-wide mb-12 bg-gradient-to-r from-[#d4af37] via-[#f5e6b2] to-[#bfa34a] bg-clip-text text-transparent">
        Wallet
      </h1>

      <motion.div
        whileHover={{ scale: 1.015 }}
        transition={{ duration: 0.3 }}
        className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-3xl shadow-2xl border border-gray-800 mb-12"
      >
        <p className="text-sm uppercase tracking-widest text-gray-500 mb-2">Current Balance</p>
        <p className="text-4xl font-light text-white tracking-wide">{money(wallet.balance)}</p>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-10 mb-10">
        <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-3xl shadow-xl border border-gray-800">
          <h2 className="text-lg font-medium mb-6 tracking-wide text-gray-200">Add Funds</h2>
          <div className="space-y-5">
            <select value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
              <option value="">Bank transfer (simulated)</option>
              {creditCards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.maskedNumber} (credit, {money(card.availableCredit)} available)
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">Debit cards draw from this wallet, so only credit cards can fund it.</p>
            <input type="number" min="0" step="0.01" placeholder="Enter Amount" value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)} className={inputClass} />
            <button onClick={addMoney} disabled={busy || !addAmount} className={buttonClass}>Add Money</button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-3xl shadow-xl border border-gray-800">
          <h2 className="text-lg font-medium mb-6 tracking-wide text-gray-200">Transfer Funds</h2>
          <div className="space-y-5">
            <input type="email" placeholder="Receiver Email" value={email}
              onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            <input type="number" min="0" step="0.01" placeholder="Enter Amount" value={amount}
              onChange={(e) => setAmount(e.target.value)} className={inputClass} />
            <button onClick={transfer} disabled={busy || !email || !amount} className={buttonClass}>Transfer</button>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-3xl shadow-xl border border-gray-800">
        <h2 className="text-lg font-medium mb-6 tracking-wide text-gray-200">Recent Activity</h2>
        {history.length === 0 && <p className="text-gray-500">No wallet activity yet.</p>}
        {history.map((tx) => {
          const outgoing = tx.direction === "debit";
          const other = outgoing ? tx.receiver : tx.sender;
          return (
            <div key={tx.id} className="flex justify-between border-b border-gray-800 py-4">
              <div>
                <p className="font-medium">
                  {LEDGER_LABELS[tx.type] || tx.type}
                  {tx.type === "transfer" && other ? ` ${outgoing ? "to" : "from"} ${other.name}` : ""}
                </p>
                <p className="text-sm text-gray-500">{new Date(tx.createdAt).toLocaleString()}{tx.description ? ` · ${tx.description}` : ""}</p>
              </div>
              <p className={`font-semibold ${outgoing ? "text-red-400" : "text-green-400"}`}>
                {outgoing ? "−" : "+"}{money(tx.amount)}
              </p>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
