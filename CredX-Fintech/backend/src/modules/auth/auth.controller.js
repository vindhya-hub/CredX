// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const User = require('../users/user.model');
// const Wallet = require('../wallet/wallet.model');
// const generateAccessToken = (user) => {
//   return jwt.sign(
//     { id: user.id, role: user.role },
//     process.env.JWT_SECRET,
//     { expiresIn: '15m' }
//   );
// };

// const generateRefreshToken = (user) => {
//   return jwt.sign(
//     { id: user.id },
//     process.env.JWT_REFRESH_SECRET,
//     { expiresIn: '7d' }
//   );
// };

// exports.register = async (req, res) => {
//   try {
//     const { name, email, password } = req.body;

//     const existingUser = await User.findOne({ where: { email } });
//     if (existingUser)
//       return res.status(400).json({ message: "User already exists" });

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const user = await User.create({
//       name,
//       email,
//       password: hashedPassword
//     });

//     // Auto-create wallet
//     await Wallet.create({
//       userId: user.id
//     });

//     res.status(201).json({
//       message: "User registered successfully",
//       user
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// exports.login = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     const user = await User.findOne({ where: { email } });
//     if (!user)
//       return res.status(400).json({ message: "Invalid credentials" });

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch)
//       return res.status(400).json({ message: "Invalid credentials" });

//     const accessToken = generateAccessToken(user);
//     const refreshToken = generateRefreshToken(user);

//     res.json({
//       accessToken,
//       refreshToken
//     });

//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };
// exports.getProfile = async (req, res) => {
//   try {
//     const user = await User.findByPk(req.user.id, {
//       attributes: { exclude: ['password'] },
//       include: [
//         {
//           model: Wallet,
//           as: 'wallet',
//           attributes: ['balance']
//         }
//       ]
//     });

//     res.json(user);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../users/user.model');
const Wallet = require('../wallet/wallet.model');

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
};

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword
    });

    // Auto-create wallet
    await Wallet.create({
      userId: user.id
    });

    res.status(201).json({
      message: "User registered successfully",
      user
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user)
      return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({
      accessToken,
      refreshToken
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Wallet,
          as: 'wallet',
          attributes: ['balance']
        }
      ]
    });

    res.json(user);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



// ✅ ADDED: FORGOT PASSWORD (does not disturb existing code)

exports.forgotPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword)
      return res.status(400).json({ message: "Email and new password required" });

    const user = await User.findOne({ where: { email } });

    if (!user)
      return res.status(404).json({ message: "User not found" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Password reset successful" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};