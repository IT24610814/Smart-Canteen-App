const Counter = require('../models/Counter');
const User = require('../models/User');

const USER_SEQUENCE_KEY = 'user-sequence';

const normalizeUsername = (value = '') => value.toLowerCase().trim().replace(/\s+/g, ' ');

const formatUserId = (sequence) => `U${String(sequence).padStart(3, '0')}`;

const parseUserId = (value = '') => {
  const match = /^U(\d+)$/.exec(value);
  return match ? Number(match[1]) : 0;
};

const getCurrentMaxSequence = async () => {
  const users = await User.find({ userId: /^U\d+$/ }).select('userId').lean();
  return users.reduce((max, user) => Math.max(max, parseUserId(user.userId)), 0);
};

const ensureUserCounter = async () => {
  const existingCounter = await Counter.findById(USER_SEQUENCE_KEY).lean();
  if (existingCounter) {
    return existingCounter;
  }

  const currentMaxSequence = await getCurrentMaxSequence();
  return Counter.findByIdAndUpdate(
    USER_SEQUENCE_KEY,
    { $setOnInsert: { seq: currentMaxSequence } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const generateNextUserId = async () => {
  await ensureUserCounter();

  const counter = await Counter.findByIdAndUpdate(
    USER_SEQUENCE_KEY,
    { $inc: { seq: 1 } },
    { new: true }
  );

  return formatUserId(counter.seq);
};

const buildUniqueUsername = async (baseUsername) => {
  const normalizedBase = normalizeUsername(baseUsername);
  let attempt = normalizedBase;
  let counter = 1;

  while (await User.exists({ username: attempt })) {
    attempt = `${normalizedBase} ${counter}`;
    counter += 1;
  }

  return attempt;
};

module.exports = {
  buildUniqueUsername,
  generateNextUserId,
  normalizeUsername
};