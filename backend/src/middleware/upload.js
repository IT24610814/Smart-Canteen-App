const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');

// Ensure upload directories exist
const ensureUploadDirs = () => {
  const dirs = [
    './uploads/profile-pictures',
    './uploads/complaints',
    './uploads/receipts',
    './uploads/menu-items'
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

ensureUploadDirs();

// Profile Picture Upload
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/profile-pictures');
  },
  filename: async (req, file, cb) => {
    try {
      const extension = path.extname(file.originalname).toLowerCase() || '.jpg';
      const authUserId = req.user?.id || req.user?.userId;
      let identity = authUserId ? String(authUserId) : 'user';

      if (authUserId) {
        const user = await User.findById(authUserId).select('userId staffId');
        identity = user?.userId || user?.staffId || identity;
      }

      const safeIdentity = String(identity).replace(/[^a-zA-Z0-9_-]/g, '');
      cb(null, `${safeIdentity}-${Date.now()}${extension}`);
    } catch (error) {
      cb(error);
    }
  }
});

const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 5242880 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});


// Complaint Upload
const complaintStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/complaints');
  },
  filename: (req, file, cb) => {
    cb(null, `complaint-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const complaintUpload = multer({
  storage: complaintStorage,
  limits: { fileSize: 5242880 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

// Menu Item Upload
const menuItemStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/menu-items');
  },
  filename: (req, file, cb) => {
    cb(null, `menu-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const menuItemUpload = multer({
  storage: menuItemStorage,
  limits: { fileSize: 5242880 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

// Receipt Upload
const receiptStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/receipts');
  },
  filename: (req, file, cb) => {
    cb(null, `receipt-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const receiptUpload = multer({
  storage: receiptStorage,
  limits: { fileSize: 1048576 }, // 1MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /text|plain/;
    const extname = /\.txt$/.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if ((mimetype || extname) && extname) return cb(null, true);
    cb(new Error('Only text files are allowed'));
  }
});

module.exports = {
  profileUpload,
  menuItemUpload,
  complaintUpload,
  receiptUpload,
  ensureUploadDirs
};
