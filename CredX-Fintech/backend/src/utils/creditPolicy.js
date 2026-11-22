/**
 * Credit-score based product rules, shared by the card and loan modules and
 * the assistant so every place quotes the same numbers.
 */

/** Credit limit for a new credit card (a low score still gets a card). */
function creditLimitFor(creditScore) {
  if (creditScore >= 750) return 200000;
  if (creditScore >= 650) return 100000;
  if (creditScore >= 550) return 50000;
  return 25000;
}

/** Loan interest rate by credit score; null means the application is rejected. */
function loanPricingFor(creditScore) {
  if (creditScore >= 750) return { interestRate: 8 };
  if (creditScore >= 650) return { interestRate: 12 };
  return null;
}

module.exports = { creditLimitFor, loanPricingFor };
