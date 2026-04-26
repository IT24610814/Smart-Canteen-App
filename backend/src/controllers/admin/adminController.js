const User = require('../../models/User');
const {
  validateNIC,
  validateEmail,
  validatePhone,
  validateAge
} = require('../../utils/validators');
const { buildUniqueUsername, generateNextUserId } = require('../../utils/userIdentity');
const { createProfileHandlers, deleteStoredProfilePhoto, sanitizeUser } = require('../../utils/profileHandlers');

const STAFF_ROLES = ['admin', 'foodmaster', 'inventory', 'promotion', 'order', 'finance', 'feedback'];

const profileHandlers = createProfileHandlers({ minAge: 16 });

exports.getDashboard = async (req, res) => {
  try {
    const [totalStaff, totalCustomers, roleGroups] = await Promise.all([
      User.countDocuments({ role: { $in: STAFF_ROLES }, isActive: true }),
      User.countDocuments({ role: 'customer', isActive: true }),
      User.aggregate([
        { $match: { role: { $in: STAFF_ROLES }, isActive: true } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ])
    ]);

    const staffByRole = STAFF_ROLES.reduce((acc, role) => {
      acc[role] = 0;
      return acc;
    }, {});

    roleGroups.forEach((row) => {
      staffByRole[row._id] = row.count;
    });

    return res.status(200).json({
      totalStaff,
      totalCustomers,
      staffByRole
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load dashboard', error: error.message });
  }
};

exports.getStaff = async (req, res) => {
  try {
    const { search = '', role = '' } = req.query;
    const filter = {
      role: { $in: STAFF_ROLES },
      isActive: true
    };

    if (role && STAFF_ROLES.includes(role)) {
      filter.role = role;
    }

    if (search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ fullName: regex }, { userId: regex }, { username: regex }];
    }

    const staff = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 });

    return res.status(200).json(staff);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load staff', error: error.message });
  }
};

exports.createStaff = async (req, res) => {
  try {
    const { fullName, nic, phone, email, address, dateOfBirth, role } = req.body;

    if (!fullName || !nic || !phone || !email || !dateOfBirth || !role) {
      return res.status(400).json({ message: 'Full name, NIC, phone, email, DOB, and role are required' });
    }

    if (!STAFF_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid staff role' });
    }

    if (!validateNIC(nic)) {
      return res.status(400).json({ message: 'Invalid NIC format' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({ message: 'Phone must be exactly 10 digits' });
    }

    if (!validateAge(dateOfBirth, 16)) {
      return res.status(400).json({ message: 'Staff age must be at least 16' });
    }

    const exists = await User.findOne({
      $or: [{ nic }, { email: email.toLowerCase().trim() }, { phone: phone.trim() }]
    });

    if (exists) {
      return res.status(409).json({ message: 'Staff with the same NIC, email, or phone already exists' });
    }

    const generatedUserId = await generateNextUserId();
    const username = await buildUniqueUsername(fullName);

    const staff = await User.create({
      userId: generatedUserId,
      fullName: fullName.trim(),
      nic,
      phone: phone.trim(),
      email: email.toLowerCase().trim(),
      address: String(address || '').trim(),
      dateOfBirth: dateOfBirth || null,
      role,
      staffId: generatedUserId,
      username,
      password: nic
    });

    return res.status(201).json({
      message: 'Staff created successfully',
      generatedCredentials: {
        userId: generatedUserId,
        username,
        password: nic
      },
      staff: sanitizeUser(staff)
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create staff', error: error.message });
  }
};

exports.updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, username, nic, phone, email, address, dateOfBirth, role } = req.body;

    const staff = await User.findById(id);
    if (!staff || !STAFF_ROLES.includes(staff.role)) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    if (nic && !validateNIC(nic)) {
      return res.status(400).json({ message: 'Invalid NIC format' });
    }

    if (email && !validateEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (phone && !validatePhone(phone)) {
      return res.status(400).json({ message: 'Phone must be exactly 10 digits' });
    }

    if (dateOfBirth && !validateAge(dateOfBirth, 16)) {
      return res.status(400).json({ message: 'Staff age must be at least 16' });
    }

    if (role && !STAFF_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid staff role' });
    }

    if (username !== undefined && !String(username).trim()) {
      return res.status(400).json({ message: 'Username is required' });
    }

    if (nic || email || phone || username) {
      const duplicate = await User.findOne({
        _id: { $ne: id },
        $or: [
          ...(username ? [{ username: String(username).toLowerCase().trim() }] : []),
          ...(nic ? [{ nic }] : []),
          ...(email ? [{ email: email.toLowerCase().trim() }] : []),
          ...(phone ? [{ phone: phone.trim() }] : [])
        ]
      });

      if (duplicate) {
        return res.status(409).json({ message: 'Username, NIC, email, or phone already in use' });
      }
    }

    if (fullName !== undefined) staff.fullName = fullName.trim();
    if (username !== undefined) staff.username = String(username).toLowerCase().trim();
    if (nic !== undefined) staff.nic = nic;
    if (phone !== undefined) staff.phone = phone.trim();
    if (email !== undefined) staff.email = email.toLowerCase().trim();
    if (address !== undefined) staff.address = String(address || '').trim();
    if (dateOfBirth !== undefined) staff.dateOfBirth = dateOfBirth || null;
    if (role !== undefined) staff.role = role;

    await staff.save();
    return res.status(200).json({ message: 'Staff updated successfully', staff: sanitizeUser(staff) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update staff', error: error.message });
  }
};

exports.deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await User.findById(id);

    if (!staff || !STAFF_ROLES.includes(staff.role)) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    deleteStoredProfilePhoto(staff.profilePhoto);

    await User.findByIdAndDelete(id);
    return res.status(200).json({ message: 'Staff deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete staff', error: error.message });
  }
};

exports.getCustomers = async (req, res) => {
  try {
    const { search = '' } = req.query;
    const filter = { role: 'customer', isActive: true };

    if (search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ fullName: regex }, { username: regex }, { userId: regex }];
    }

    const customers = await User.find(filter).select('-password').sort({ createdAt: -1 });
    return res.status(200).json(customers);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load customers', error: error.message });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, username, nic, email, phone, address, dateOfBirth } = req.body;

    const customer = await User.findById(id);
    if (!customer || customer.role !== 'customer') {
      return res.status(404).json({ message: 'Customer not found' });
    }

    if (username !== undefined && !String(username).trim()) {
      return res.status(400).json({ message: 'Username is required' });
    }

    if (nic && !validateNIC(nic)) {
      return res.status(400).json({ message: 'Invalid NIC format' });
    }

    if (email && !validateEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (phone && !validatePhone(phone)) {
      return res.status(400).json({ message: 'Phone must be exactly 10 digits' });
    }

    if (dateOfBirth && !validateAge(dateOfBirth, 17)) {
      return res.status(400).json({ message: 'Customer age must be greater than 16' });
    }

    if (username || nic || email || phone) {
      const duplicate = await User.findOne({
        _id: { $ne: id },
        $or: [
          ...(username ? [{ username: String(username).toLowerCase().trim() }] : []),
          ...(nic ? [{ nic }] : []),
          ...(email ? [{ email: email.toLowerCase().trim() }] : []),
          ...(phone ? [{ phone: phone.trim() }] : [])
        ]
      });

      if (duplicate) {
        return res.status(409).json({ message: 'Username, NIC, email, or phone already in use' });
      }
    }

    if (fullName !== undefined) customer.fullName = fullName.trim();
    if (username !== undefined) customer.username = String(username).toLowerCase().trim();
    if (nic !== undefined) customer.nic = nic;
    if (email !== undefined) customer.email = email.toLowerCase().trim();
    if (phone !== undefined) customer.phone = phone.trim();
    if (address !== undefined) customer.address = address;
    if (dateOfBirth !== undefined) customer.dateOfBirth = dateOfBirth || null;

    await customer.save();

    return res.status(200).json({
      message: 'Customer updated successfully',
      customer: sanitizeUser(customer)
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update customer', error: error.message });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await User.findById(id);

    if (!customer || customer.role !== 'customer') {
      return res.status(404).json({ message: 'Customer not found' });
    }

    deleteStoredProfilePhoto(customer.profilePhoto);

    await User.findByIdAndDelete(id);
    return res.status(200).json({ message: 'Customer deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete customer', error: error.message });
  }
};

exports.getProfile = profileHandlers.getProfile;
exports.updateProfile = profileHandlers.updateProfile;
exports.changePassword = profileHandlers.changePassword;
exports.uploadProfilePhoto = profileHandlers.uploadProfilePhoto;
exports.deleteProfilePhoto = profileHandlers.deleteProfilePhoto;
