// import { useEffect, useState } from "react";
// import API from "../services/api";

// export default function Loans() {
//   const [loans, setLoans] = useState([]);
//   const [amount, setAmount] = useState("");
//   const [tenure, setTenure] = useState("");

//   const fetchLoans = async () => {
//     const res = await API.get("/loans");
//     setLoans(res.data);
//   };

//   useEffect(() => {
//     fetchLoans();
//   }, []);

//   const applyLoan = async () => {
//     await API.post("/loans/apply", {
//       amount: Number(amount),
//       tenureMonths: Number(tenure)
//     });
//     setAmount("");
//     setTenure("");
//     fetchLoans();
//   };

//   const payEMI = async (loanId) => {
//     await API.post("/loans/pay-emi", { loanId });
//     fetchLoans();
//   };

//   return (
//     <div className="p-10 text-white bg-black min-h-screen">
//       <h1 className="text-3xl mb-6">Loans</h1>

//       <div className="mb-8">
//         <input
//           placeholder="Loan Amount"
//           value={amount}
//           onChange={(e) => setAmount(e.target.value)}
//           className="p-2 mr-4 bg-gray-800 rounded"
//         />
//         <input
//           placeholder="Tenure (Months)"
//           value={tenure}
//           onChange={(e) => setTenure(e.target.value)}
//           className="p-2 mr-4 bg-gray-800 rounded"
//         />
//         <button
//           onClick={applyLoan}
//           className="bg-yellow-500 px-4 py-2 rounded text-black"
//         >
//           Apply Loan
//         </button>
//       </div>

//       {loans.map((loan) => (
//         <div key={loan.id} className="bg-gray-900 p-6 rounded mb-4">
//           <p>Amount: ₹ {loan.amount}</p>
//           <p>Interest: {loan.interestRate}%</p>
//           <p>EMI: ₹ {loan.emi}</p>
//           <p>Remaining: ₹ {loan.remainingBalance}</p>
//           <p>Status: {loan.status}</p>

//           {loan.status === "approved" && (
//             <button
//               onClick={() => payEMI(loan.id)}
//               className="mt-3 bg-green-600 px-4 py-2 rounded"
//             >
//               Pay EMI
//             </button>
//           )}
//         </div>
//       ))}
//     </div>
//   );
// }
import { useState } from "react";
import API from "../services/api";

export default function Loans() {
  const [amount, setAmount] = useState("");
  const [tenure, setTenure] = useState("");
  const [loading, setLoading] = useState(false);

  const applyLoan = async () => {
    if (!amount || !tenure) {
      alert("Enter loan amount and tenure");
      return;
    }

    try {
      setLoading(true);

      const res = await API.post("/loans/apply", {
        amount: Number(amount),
        tenureMonths: Number(tenure)
      });

      alert(res.data.message);

      setAmount("");
      setTenure("");

    } catch (err) {
      alert(err.response?.data?.message || "Loan failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-12 py-10 min-h-screen bg-black text-white">

      <h1 className="text-3xl font-bold mb-8">Loans</h1>

      <div className="flex gap-6 items-center">

        <input
          type="number"
          placeholder="Loan Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="bg-gray-800 px-4 py-2 rounded-lg"
        />

        <input
          type="number"
          placeholder="Tenure (Months)"
          value={tenure}
          onChange={(e) => setTenure(e.target.value)}
          className="bg-gray-800 px-4 py-2 rounded-lg"
        />

        <button
          onClick={applyLoan}
          disabled={loading}
          className="bg-yellow-500 text-black px-6 py-2 rounded-lg hover:opacity-80"
        >
          {loading ? "Processing..." : "Apply Loan"}
        </button>

      </div>
    </div>
  );
}