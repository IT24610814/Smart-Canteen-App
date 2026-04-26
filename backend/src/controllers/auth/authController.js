const User = require('../../models/User');
const { generateToken } = require('../../middleware/auth');
const { validateNIC, validateEmail, validatePhone } = require('../../utils/validators');
const { generateNextUserId, normalizeUsername } = require('../../utils/userIdentity');
const { sanitizeUser } = require('../../utils/profileHandlers');

const KNOWN_ROLES = new Set(['admin', 'foodmaster', 'inventory', 'promotion', 'order', 'finance', 'feedback', 'customer']);

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({ username: username.toLowerCase().trim(), isActive: true });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = generateToken(user._id, user.role);
    return res.status(200).json({
      message: 'Login successful',
      token,
      role: user.role,
      isKnownRole: KNOWN_ROLES.has(user.role),
      user: sanitizeUser(user)
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

exports.registerCustomer = async (req, res) => {
  try {
    const { fullName, username, password, nic, email, phone, address, dateOfBirth } = req.body;

    if (!fullName || !username || !password || !nic || !email || !phone || !address || !dateOfBirth) {
      return res.status(400).json({ message: 'Full name, username, password, NIC, email, phone, address, and DOB are required' });
    }

    if (!validateNIC(String(nic).trim())) {
      return res.status(400).json({ message: 'Invalid NIC format' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({ message: 'Phone must be exactly 10 digits' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }

    if (Number.isNaN(birthDate.getTime()) || age < 17) {
      return res.status(400).json({ message: 'Customer age must be greater than 16' });
    }

    const normalizedUsername = normalizeUsername(username);
    const existingUser = await User.findOne({
      $or: [
        { username: normalizedUsername },
        { nic: String(nic).trim() },
        { email: email.toLowerCase().trim() },
        { phone: phone.trim() }
      ]
    });

    if (existingUser) {
      return res.status(409).json({ message: 'Username, NIC, email, or phone already exists' });
    }

    const customer = await User.create({
      userId: await generateNextUserId(),
      fullName: fullName.trim(),
      username: normalizedUsername,
      password,
      nic: String(nic).trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      role: 'customer',
      address: address.trim(),
      dateOfBirth: birthDate
    });

    const token = generateToken(customer._id, customer.role);
    return res.status(201).json({
      message: 'Customer registration successful',
      token,
      role: customer.role,
      user: sanitizeUser(customer)
    });
  } catch (error) {
    return res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};

exports.verify = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid or inactive user' });
    }

    return res.status(200).json({
      message: 'Token verified',
      role: user.role,
      user
    });
  } catch (error) {
    return res.status(500).json({ message: 'Token verification failed', error: error.message });
  }
};

exports.logout = async (req, res) => {
  return res.status(200).json({ message: 'Logout successful' });
};
