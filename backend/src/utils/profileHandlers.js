const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const { validateNIC, validateEmail, validatePhone, validateAge } = require('./validators');

const PASSWORD_POLICY = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

const sanitizeUser = (user) => {
  const plain = user.toObject();
  delete plain.password;
  return plain;
};

const getRequestUserObjectId = (req) => req.user?.userId || req.user?.id;

const resolveStoredFilePath = (filePath) => {
  if (!filePath) {
    return null;
  }

  const normalized = filePath.replace(/^[/\\]+/, '').replace(/\//g, path.sep);
  return path.join(process.cwd(), normalized);
};

const deleteStoredProfilePhoto = (profilePhotoPath) => {
  const absolutePath = resolveStoredFilePath(profilePhotoPath);

  if (absolutePath && fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
};

const createProfileHandlers = ({ minAge = 16 } = {}) => {
  const getProfile = async (req, res) => {
    try {
      const user = await User.findById(getRequestUserObjectId(req)).select('-password');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      return res.status(200).json(user);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to load profile', error: error.message });
    }
  };

  const updateProfile = async (req, res) => {
    try {
      const { fullName, username, nic, email, phone, address, dateOfBirth } = req.body;
      const user = await User.findById(getRequestUserObjectId(req));

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (username !== undefined && !String(username).trim()) {
        return res.status(400).json({ message: 'Username is required' });
      }

      if (email !== undefined && !validateEmail(String(email).trim())) {
        return res.status(400).json({ message: 'Invalid email format' });
      }

      if (nic !== undefined && String(nic).trim() !== '' && !validateNIC(String(nic).trim())) {
        return res.status(400).json({ message: 'Invalid NIC format' });
      }

      if (phone !== undefined && !validatePhone(String(phone).trim())) {
        return res.status(400).json({ message: 'Phone must be exactly 10 digits' });
      }

      if (dateOfBirth !== undefined && dateOfBirth !== '' && !validateAge(dateOfBirth, minAge)) {
        return res.status(400).json({ message: `Age must be at least ${minAge}` });
      }

      if (username !== undefined || nic !== undefined || email !== undefined || phone !== undefined) {
        const duplicate = await User.findOne({
          _id: { $ne: user._id },
          $or: [
            ...(username !== undefined ? [{ username: String(username).toLowerCase().trim() }] : []),
            ...(nic !== undefined && String(nic).trim() !== '' ? [{ nic: String(nic).trim() }] : []),
            ...(email !== undefined ? [{ email: String(email).toLowerCase().trim() }] : []),
            ...(phone !== undefined ? [{ phone: String(phone).trim() }] : [])
          ]
        });

        if (duplicate) {
          return res.status(409).json({ message: 'Username, NIC, email, or phone already in use' });
        }
      }

      if (fullName !== undefined) user.fullName = String(fullName).trim();
      if (username !== undefined) user.username = String(username).toLowerCase().trim();
      if (nic !== undefined) user.nic = String(nic || '').trim() || null;
      if (email !== undefined) user.email = String(email).toLowerCase().trim();
      if (phone !== undefined) user.phone = String(phone).trim();
      if (address !== undefined) user.address = String(address || '').trim();
      if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;

      await user.save();

      return res.status(200).json({
        message: 'Profile updated successfully',
        profile: sanitizeUser(user)
      });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to update profile', error: error.message });
    }
  };

  const changePassword = async (req, res) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;

      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: 'Current password, new password, and confirmation are required' });
      }

      if (!PASSWORD_POLICY.test(newPassword)) {
        return res.status(400).json({ message: 'New password must be at least 8 characters and include letters and numbers' });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'New password and confirmation do not match' });
      }

      const user = await User.findById(getRequestUserObjectId(req));
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const matches = await user.comparePassword(currentPassword);
      if (!matches) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      user.password = newPassword;
      await user.save();

      return res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to change password', error: error.message });
    }
  };

  const uploadProfilePhoto = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Profile photo is required' });
      }

      const user = await User.findById(getRequestUserObjectId(req));
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.profilePhoto) {
        deleteStoredProfilePhoto(user.profilePhoto);
      }

      user.profilePhoto = `/uploads/profile-pictures/${req.file.filename}`;
      await user.save();

      return res.status(200).json({
        message: 'Profile photo uploaded successfully',
        profilePhoto: user.profilePhoto
      });
    } catch (error) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(500).json({ message: 'Failed to upload profile photo', error: error.message });
    }
  };

  const deleteProfilePhoto = async (req, res) => {
    try {
      const user = await User.findById(getRequestUserObjectId(req));
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.profilePhoto) {
        deleteStoredProfilePhoto(user.profilePhoto);
      }

      user.profilePhoto = null;
      await user.save();

      return res.status(200).json({ message: 'Profile photo deleted successfully' });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to delete profile photo', error: error.message });
    }
  };

  return {
    getProfile,
    updateProfile,
    changePassword,
    uploadProfilePhoto,
    deleteProfilePhoto,
    sanitizeUser
  };
};

module.exports = {
  createProfileHandlers,
  deleteStoredProfilePhoto,
  sanitizeUser
};