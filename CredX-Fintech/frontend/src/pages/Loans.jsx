import { useEffect, useState } from "react";
import API, { errorMessage } from "../services/api";

const money = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Loans() {
  const [amount, setAmount] = useState("");
  const [tenure, setTenure] = useState("");
  const [quote, setQuote] = useState(null);
  const [loans, setLoans] = useState([]);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    API.get("/loans").then((res) => {
      if (active) setLoans(res.data);
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, [version]);

  // EMI preview for the entered amount/tenure (no side effects on the server).
  useEffect(() => {
    if (!(Number(amount) > 0 && Number.isInteger(Number(tenure)) && Number(tenure) > 0)) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      API.get("/loans/quote", { params: { amount: Number(amount), tenureMonths: Number(tenure) } })
        .then((res) => {
          if (active) setQuote(res.data);
        })
        .catch(() => {
          if (active) setQuote(null);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [amount, tenure]);

  const applyLoan = async () => {
    if (!amount || !tenure) {
      alert("Enter loan amount and tenure");
      return;
    }
    try {
      setLoading(true);
      const res = await API.post("/loans/apply", { amount: Number(amount), tenureMonths: Number(tenure) });
      alert(res.data.message);
      setAmount("");
      setTenure("");
      setQuote(null);
      setVersion((v) => v + 1);
    } catch (err) {
      alert(errorMessage(err, "Loan failed"));
    } finally {
      setLoading(false);
    }
  };

  const payEmi = async (loanId) => {
    try {
      const res = await API.post("/loans/pay", { loanId });
      alert(`${res.data.message}. Wallet balance: ${money(res.data.walletBalance)}`);
      setVersion((v) => v + 1);
    } catch (err) {
      alert(errorMessage(err, "EMI payment failed"));
    }
  };

  const showQuote = quote && Number(amount) > 0 && Number(tenure) > 0;

  return (
    <div className="px-12 py-10 min-h-screen bg-black text-white">
      <h1 className="text-3xl font-bold mb-8">Loans</h1>

      <div className="flex flex-wrap gap-6 items-center">
        <input type="number" min="1" placeholder="Loan Amount" value={amount}
          onChange={(e) => setAmount(e.target.value)} className="bg-gray-800 px-4 py-2 rounded-lg" />
        <input type="number" min="1" step="1" placeholder="Tenure (Months)" value={tenure}
          onChange={(e) => setTenure(e.target.value)} className="bg-gray-800 px-4 py-2 rounded-lg" />
        <button onClick={applyLoan} disabled={loading}
          className="bg-yellow-500 text-black px-6 py-2 rounded-lg hover:opacity-80 disabled:opacity-60">
          {loading ? "Processing..." : "Apply Loan"}
        </button>
      </div>

      {showQuote && (
        <p className="mt-4 text-sm text-gray-300">
          {quote.eligible
            ? `EMI ${money(quote.emi)} × ${quote.tenureMonths} months at ${quote.interestRate}% (total ${money(quote.totalPayable)}, interest ${money(quote.totalInterest)})`
            : `Not eligible: ${quote.reason} (your score: ${quote.creditScore})`}
        </p>
      )}

      <h2 className="text-xl font-semibold mt-12 mb-4">Your loans</h2>
      {loans.length === 0 && <p className="text-gray-500">No loans yet.</p>}
      <div className="grid md:grid-cols-2 gap-6">
        {loans.map((loan) => (
          <div key={loan.id} className="bg-gray-900 p-6 rounded-xl border border-gray-800">
            <p className="text-lg font-semibold">{money(loan.amount)} · {loan.interestRate}% · {loan.tenureMonths} months</p>
            <p className="text-gray-300 mt-2">EMI: {money(loan.emi)}</p>
            <p className="text-gray-300">Paid: {money(loan.paidAmount)} · Remaining: {money(loan.remainingBalance)}</p>
            <p className="text-sm text-gray-500 mt-1">Status: {loan.status}</p>
            {loan.status !== "closed" && loan.remainingBalance > 0 && (
              <button onClick={() => payEmi(loan.id)} className="mt-4 bg-green-600 px-4 py-2 rounded-lg hover:opacity-90">
                Pay EMI from wallet
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
