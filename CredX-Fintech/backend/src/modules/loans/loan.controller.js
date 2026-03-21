// const Loan = require('./loan.model');
// const User = require('../users/user.model');
// const calculateEMI = require('../../utils/emiCalculator');
// const Wallet = require('../wallet/wallet.model');
// exports.applyLoan = async (req, res) => {
//   try {
//     const { amount, tenureMonths } = req.body;
//     const userId = req.user.id;

//     const user = await User.findByPk(userId);

//     let interestRate;
//     let status;

//     if (user.credit_score >= 750) {
//       interestRate = 8;
//       status = 'approved';
//     } else if (user.credit_score >= 650) {
//       interestRate = 12;
//       status = 'approved';
//     } else {
//       return res.status(400).json({
//         message: "Loan rejected due to low credit score"
//       });
//     }

//     const emi = calculateEMI(amount, interestRate, tenureMonths);

//     const loan = await Loan.create({
//       userId,
//       amount,
//       interestRate,
//       tenureMonths,
//       emi,
//       status
//     });
//     // 🔹 Auto disburse if approved
//     if (status === 'approved') {
//         const wallet = await Wallet.findOne({ where: { userId } });
//         wallet.balance += amount;
//         await wallet.save();
//     }

//     res.json({
//       message: "Loan processed",
//       loan
//     });

//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };
const Loan = require('./loan.model');
const User = require('../users/user.model');
const Wallet = require('../wallet/wallet.model');
const calculateEMI = require('../../utils/emiCalculator');

// ================= APPLY LOAN =================
exports.applyLoan = async (req, res) => {
  try {
    const { amount, tenureMonths } = req.body;
    const userId = req.user.id;

    if (!amount || !tenureMonths) {
      return res.status(400).json({
        message: "Loan amount and tenure are required"
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let interestRate;
    let status;

    // 🔹 Loan approval logic based on credit score
    if (user.credit_score >= 750) {
      interestRate = 8;
      status = "approved";
    } else if (user.credit_score >= 650) {
      interestRate = 12;
      status = "approved";
    } else {
      return res.status(400).json({
        message: "Loan rejected due to low credit score"
      });
    }

    // 🔹 EMI calculation
    const emi = calculateEMI(amount, interestRate, tenureMonths);

    // 🔹 Create loan record
    const loan = await Loan.create({
      userId,
      amount,
      interestRate,
      tenureMonths,
      emi,
      status,
      remainingBalance: amount,
      paidAmount: 0
    });

    // 🔹 Auto disburse amount to wallet if approved
    if (status === "approved") {
      const wallet = await Wallet.findOne({ where: { userId } });

      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }

      wallet.balance += Number(amount);
      await wallet.save();
    }

    res.json({
      message: "Loan approved and amount credited to wallet",
      loan
    });

  } catch (error) {
    console.error("Loan Apply Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ================= GET USER LOANS =================
exports.getUserLoans = async (req, res) => {
  try {
    const loans = await Loan.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    res.json(loans);

  } catch (error) {
    console.error("Get Loans Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ================= PAY EMI =================
exports.payEMI = async (req, res) => {
  try {
    const { loanId } = req.body;
    const userId = req.user.id;

    const loan = await Loan.findOne({
      where: { id: loanId, userId }
    });

    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    if (loan.remainingBalance <= 0) {
      return res.status(400).json({ message: "Loan already paid" });
    }

    const wallet = await Wallet.findOne({ where: { userId } });

    if (!wallet || wallet.balance < loan.emi) {
      return res.status(400).json({
        message: "Insufficient wallet balance to pay EMI"
      });
    }

    // Deduct EMI
    wallet.balance -= loan.emi;
    await wallet.save();

    loan.paidAmount += loan.emi;
    loan.remainingBalance -= loan.emi;

    if (loan.remainingBalance <= 0) {
      loan.remainingBalance = 0;
      loan.status = "closed";
    }

    await loan.save();

    res.json({
      message: "EMI paid successfully",
      loan
    });

  } catch (error) {
    console.error("Pay EMI Error:", error);
    res.status(500).json({ error: error.message });
  }
};