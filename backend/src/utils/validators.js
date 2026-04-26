// Utility to generate unique IDs
const generateId = (prefix) => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Utility to validate NIC format (Sri Lankan format: 9V / 12 digits)
const validateNIC = (nic) => {
  const nicPattern = /^([0-9]{9}[vV]|[0-9]{12})$/;
  return nicPattern.test(nic);
};

// Utility to validate email
const validateEmail = (email) => {
  const emailPattern = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  return emailPattern.test(email);
};

// Utility to validate phone
const validatePhone = (phone) => {
  return /^\d{10}$/.test(phone);
};

// Utility to validate date and age
const validateAge = (dateOfBirth, minAge = 16) => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= minAge;
};

// Utility to calculate discount
const calculateDiscount = (amount, discountPercentage) => {
  return (amount * discountPercentage) / 100;
};

// Utility to generate username from name
const generateUsername = (fullName) => {
  const base = fullName
    .toLowerCase()
    .replace(/\s+/g, '')
    .substring(0, 10);
  return `${base}-${Date.now()}`;
};

// Utility to generate random password
const generatePassword = () => {
  return Math.random().toString(36).slice(-8).toUpperCase() + Math.random().toString(36).slice(-2);
};

module.exports = {
  generateId,
  validateNIC,
  validateEmail,
  validatePhone,
  validateAge,
  calculateDiscount,
  generateUsername,
  generatePassword
};
