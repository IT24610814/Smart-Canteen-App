const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User Schema - for all roles
const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      unique: true,
      sparse: true
    },
    staffId: {
      type: String,
      unique: true,
      sparse: true
    },
    username: {
      type: String,
      unique: true,
      required: true,
      lowercase: true
    },
    email: {
      type: String,
      required: true,
      match: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
    },
    phone: {
      type: String,
      required: true,
      match: /^\d{10}$/
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    fullName: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'foodmaster', 'inventory', 'promotion', 'order', 'finance', 'feedback', 'customer'],
      required: true
    },
    nic: {
      type: String,
      unique: true,
      sparse: true // Only for staff
    },
    address: String,
    dateOfBirth: Date,
    profilePhoto: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
