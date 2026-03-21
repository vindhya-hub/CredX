function generateCVV() {
  return Math.floor(100 + Math.random() * 900).toString();
}

function generateExpiry() {
  const year = new Date().getFullYear() + 5;
  const month = Math.floor(1 + Math.random() * 12)
    .toString()
    .padStart(2, '0');
  return `${month}/${year.toString().slice(-2)}`;
}

function maskCard(number) {
  return number.slice(0, 4) + " **** **** " + number.slice(-4);
}

module.exports = { generateCVV, generateExpiry, maskCard };