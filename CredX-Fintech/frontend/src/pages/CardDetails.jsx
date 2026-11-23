import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API, { errorMessage } from "../services/api";
import { motion } from "framer-motion";

const money = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CARD_BACKGROUNDS = {
  VISA: "linear-gradient(135deg,#0f2027,#203a43,#2c5364)",
  MASTERCARD: "linear-gradient(135deg,#c31432,#240b36)",
  AMEX: "linear-gradient(135deg,#1e3c72,#2a5298)",
};

export default function CardDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [card, setCard] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([API.get(`/cards/${id}`), API.get(`/cards/${id}/transactions`)])
      .then(([cardRes, txRes]) => {
        if (!active) return;
        setCard(cardRes.data);
        setTransactions(txRes.data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id, version]);

  const reload = () => setVersion((v) => v + 1);

  const simulate = async () => {
    setBusy(true);
    try {
      await API.post("/cards/simulate", { cardId: id, count: 10 });
      reload();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // Pays the credit card bill from the wallet (empty amount = full outstanding balance).
  const payBill = async () => {
    setBusy(true);
    try {
      const body = payAmount ? { cardId: id, amount: Number(payAmount) } : { cardId: id };
      const res = await API.post("/cards/pay-bill", body);
      alert(`${res.data.message}. Wallet balance: ${money(res.data.walletBalance)}`);
      setPayAmount("");
      reload();
    } catch (err) {
      alert(errorMessage(err, "Payment failed"));
    } finally {
      setBusy(false);
    }
  };

  const isCredit = card?.cardType === "credit";

  return (
    <div className="px-12 py-10 min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white">

      <button
        onClick={() => navigate("/cards")}
        className="mb-10 bg-gradient-to-r from-[#bfa34a] to-[#f0e2a0] text-black px-5 py-2 rounded-md font-semibold shadow-md hover:opacity-90 transition"
      >
        ← Back
      </button>

      {card && (
        <div className="flex justify-center gap-16 mb-16 flex-wrap">

          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.03 }}>
            <div
              className="relative rounded-2xl shadow-2xl p-8 overflow-hidden"
              style={{ width: "420px", height: "250px", background: CARD_BACKGROUNDS[card.brand] || "linear-gradient(135deg,#1c1c1c,#000000)" }}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent"></div>

              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm tracking-widest text-gray-300">CREDX BANK</p>
                  <p className="text-lg font-semibold mt-1 text-[#f0e2a0]">{card.brand || "CARD"}</p>
                </div>
                <p className="text-sm uppercase text-gray-300">{card.cardType} · {card.status}</p>
              </div>

              <div className="mt-12">
                <p className="text-2xl tracking-[5px] font-mono text-white">{card.maskedNumber}</p>
              </div>

              <div className="flex justify-between mt-12">
                <div>
                  <p className="text-xs text-gray-400">Card Holder</p>
                  <p className="text-sm font-semibold uppercase">{card.cardHolderName || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Expires</p>
                  <p className="text-sm font-semibold">{card.expiryDate}</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-gray-900 to-black border border-gray-700 rounded-2xl shadow-xl p-8 w-[420px]"
          >
            <h2 className="text-xl font-bold mb-8 text-[#f0e2a0]">Account Details</h2>

            <div className="space-y-6 text-sm">
              <Detail label="Card Type" value={card.cardType} />
              {isCredit ? (
                <>
                  <Detail label="Credit Limit" value={money(card.creditLimit)} />
                  <Detail label="Available Credit" value={money(card.availableCredit)} highlight />
                  <Detail label="Outstanding Balance" value={money(card.outstandingBalance)} />
                  <Detail label="Minimum Due" value={money(card.minimumDue)} />
                </>
              ) : (
                <Detail label="Pays from" value="Your CredX wallet" />
              )}
            </div>

            {isCredit && card.outstandingBalance > 0 && (
              <div className="mt-8 space-y-3">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={`Amount (empty = full ${money(card.outstandingBalance)})`}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-black border border-gray-700 p-3 rounded-lg"
                />
                <button
                  onClick={payBill}
                  disabled={busy}
                  className="w-full bg-gradient-to-r from-[#bfa34a] to-[#f0e2a0] text-black px-6 py-2 rounded-md font-semibold disabled:opacity-60"
                >
                  Pay bill from wallet
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-gray-900 to-black border border-gray-700 rounded-3xl shadow-2xl p-10"
      >
        <h1 className="text-2xl font-bold mb-8 text-[#f0e2a0]">Card Transactions</h1>

        <button
          onClick={simulate}
          disabled={busy}
          className="mb-8 bg-gradient-to-r from-[#bfa34a] to-[#f0e2a0] text-black px-6 py-2 rounded-md font-semibold shadow-md hover:opacity-90 transition disabled:opacity-60"
        >
          Simulate 10 Transactions
        </button>
        <p className="mb-6 text-xs text-gray-500">Simulated transactions are sample history only; they do not change balances.</p>

        {transactions.length === 0 && <p className="text-gray-400">No transactions yet.</p>}

        {transactions.map((tx) => (
          <div key={tx.id} className="flex justify-between border-b border-gray-700 py-5">
            <div>
              <p className="font-semibold">{tx.merchant}</p>
              <p className="text-sm text-gray-400">
                {new Date(tx.createdAt).toLocaleString()} · {tx.category || "other"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-white">{money(tx.amount)}</p>
              {tx.status === "declined" && <p className="text-red-500 text-sm">⚠ Declined{tx.isFraud ? " (suspected fraud)" : ""}</p>}
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function Detail({ label, value, highlight = false }) {
  return (
    <div>
      <p className="text-gray-400">{label}</p>
      <p className={`font-semibold ${highlight ? "text-lg text-[#f0e2a0]" : ""} capitalize`}>{value}</p>
    </div>
  );
}
