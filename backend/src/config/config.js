module.exports = {
  mongodb: {
    url: process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_canteen'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your_secret_key',
    expireIn: process.env.JWT_EXPIRE || '7d'
  },
  file: {
    maxSize: process.env.MAX_FILE_SIZE || 5242880, // 5MB
    uploadDir: process.env.UPLOAD_DIR || './uploads'
  },
  server: {
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    clientUrl: process.env.CLIENT_URL || 'http://localhost:3000'
  }
};
