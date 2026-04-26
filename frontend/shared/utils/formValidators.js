export const isNicValid = (nic) => {
  if (!nic) return false;
  const trimmed = nic.trim();
  return /^\d{12}$/.test(trimmed) || /^\d{9}[VvXx]$/.test(trimmed);
};

export const isGmailEmail = (email) => {
  if (!email) return false;
  const trimmed = email.trim().toLowerCase();
  return /^[a-z0-9._%+-]+@gmail\.com$/.test(trimmed);
};

export const isPhoneValid = (phone) => {
  if (!phone) return false;
  return /^\d{10}$/.test(phone.trim());
};

export const formatDate = (date) => {
  if (!date) return '';
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) {
    return '';
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDate = (dateString) => {
  if (!dateString) {
    return new Date(2000, 0, 1);
  }

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(2000, 0, 1);
  }

  return parsed;
};

export const getAge = (dateString) => {
  if (!dateString) return null;
  const birthDate = new Date(dateString);
  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
};

export const isAgeAtLeast = (dateString, minAge) => {
  const age = getAge(dateString);
  return age !== null && age >= minAge;
};

export const isAgeBetween = (dateString, minAge, maxAge) => {
  const age = getAge(dateString);
  return age !== null && age >= minAge && age <= maxAge;
};

export const isPasswordStrong = (password) => {
  if (!password) return false;
  return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password);
};
