const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const authRoutes = require('./modules/auth/auth.routes');
const walletRoutes = require('./modules/wallet/wallet.routes');
const transactionRoutes = require('./modules/transactions/transaction.routes');
const loanRoutes = require('./modules/loans/loan.routes');
const cardRoutes = require('./modules/cards/card.routes');



const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/cards', require('./modules/cards/card.routes'));

app.get('/', (req, res) => {
  res.send('CredX Fintech API Running');
});

module.exports = app;