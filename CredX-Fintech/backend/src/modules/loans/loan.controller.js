const config = require('../../config/config');
const AppError = require('../../utils/AppError');
const { round2 } = require('../../utils/money');
const calculateEMI = require('../../utils/emiCalculator');
const { loanPricingFor: pricingFor } = require('../../utils/creditPolicy');
const { User, Loan } = require('../../models');
const walletService = require('../wallet/wallet.service');

// ================= APPLY LOAN =================
// Approval, loan creation, wallet credit and the ledger entry happen in one
// database transaction (see walletService.disburseLoan).
exports.applyLoan = async (req, res) => {
  const { amount, tenureMonths } = req.body;
  const userId = req.user.id;

  const user = await User.findByPk(userId);
  if (!user) throw AppError.notFound('User not found');

  const pricing = pricingFor(user.credit_score);
  if (!pricing) throw AppError.badRequest('Loan rejected due to low credit score', 'LOAN_REJECTED');

  const activeLoans = await Loan.count({ where: { userId, status: 'approved' } });
  if (activeLoans >= config.loans.maxActive) {
    throw AppError.badRequest(
      `You already have ${activeLoans} active loans. Repay one before applying again.`,
      'LOAN_LIMIT_REACHED',
    );
  }

  const emi = calculateEMI(amount, pricing.interestRate, tenureMonths);
  const totalPayable = round2(emi * tenureMonths);

  const { loan, wallet } = await walletService.disburseLoan({
    userId,
    loanAttributes: {
      amount,
      interestRate: pricing.interestRate,
      tenureMonths,
      emi,
      status: 'approved',
      remainingBalance: totalPayable,
      paidAmount: 0,
    },
  });

  res.status(201).json({
    message: 'Loan approved and amount credited to wallet',
    loan,
    walletBalance: wallet.balance,
  });
};

// ================= QUOTE (EMI preview, no side effects) =================
exports.quoteLoan = async (req, res) => {
  const { amount, tenureMonths } = req.validated.query;
  const user = await User.findByPk(req.user.id);
  if (!user) throw AppError.notFound('User not found');

  const pricing = pricingFor(user.credit_score);
  if (!pricing) {
    return res.json({ eligible: false, creditScore: user.credit_score, reason: 'A credit score of at least 650 is required' });
  }
  const emi = calculateEMI(amount, pricing.interestRate, tenureMonths);
  const totalPayable = round2(emi * tenureMonths);
  return res.json({
    eligible: true,
    creditScore: user.credit_score,
    amount,
    tenureMonths,
    interestRate: pricing.interestRate,
    emi,
    totalPayable,
    totalInterest: round2(totalPayable - amount),
  });
};

// ================= GET USER LOANS =================
exports.getUserLoans = async (req, res) => {
  const loans = await Loan.findAll({
    where: { userId: req.user.id },
    order: [['createdAt', 'DESC']],
  });
  res.json(loans);
};

// ================= PAY EMI =================
exports.payEMI = async (req, res) => {
  const { loan, wallet, transaction } = await walletService.payLoanEmi({ userId: req.user.id, loanId: req.body.loanId });
  res.json({
    message: loan.status === 'closed' ? 'Final EMI paid, loan closed' : 'EMI paid successfully',
    loan,
    walletBalance: wallet.balance,
    transaction,
  });
};
