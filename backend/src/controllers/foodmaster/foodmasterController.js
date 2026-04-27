const MenuItem = require('../../models/MenuItem');
const User = require('../../models/User');
const fs = require('fs');
const path = require('path');
const { createProfileHandlers } = require('../../utils/profileHandlers');
const { deleteStoredProfilePhoto } = require('../../utils/profileHandlers');

const profileHandlers = createProfileHandlers({ minAge: 16 });

// Generate unique itemId
const generateItemId = async () => {
  const count = await MenuItem.countDocuments();
  return `ITEM${String(count + 1).padStart(4, '0')}`;
};

// Get all menu items with optional search/filter
exports.getMenu = async (req, res) => {
  try {
    const { search, isActive } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const items = await MenuItem.find(query).sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single menu item
exports.getMenuItemById = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new menu item
exports.createMenuItem = async (req, res) => {
  try {
    const { name, price, description } = req.body;

    // Validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Item name is required' });
    }

    if (!price || isNaN(price) || parseFloat(price) < 0) {
      return res.status(400).json({ message: 'Valid price is required' });
    }

    // Check if name already exists
    const existingItem = await MenuItem.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
    if (existingItem) {
      return res.status(400).json({ message: 'Item name already exists' });
    }

    const itemId = await generateItemId();
    let image = null;

    if (req.file) {
      const extension = (path.extname(req.file.originalname) || path.extname(req.file.filename) || '.jpg').toLowerCase();
      const imageFileName = `${itemId}${extension}`;
      const targetPath = path.join(process.cwd(), 'uploads', 'menu-items', imageFileName);

      fs.renameSync(req.file.path, targetPath);
      image = `/uploads/menu-items/${imageFileName}`;
    }

    const newItem = new MenuItem({
      itemId,
      name,
      price: parseFloat(price),
      description: description || '',
      image,
      isActive: true
    });

    await newItem.save();
    res.status(201).json({
      message: 'Menu item created successfully',
      item: newItem
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: error.message });
  }
};

// Update menu item
exports.updateMenuItem = async (req, res) => {
  try {
    const { name, price, description, isActive } = req.body;
    const item = await MenuItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    // Validate new name if provided
    if (name && name !== item.name) {
      const existingItem = await MenuItem.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
      if (existingItem) {
        return res.status(400).json({ message: 'Item name already exists' });
      }
      item.name = name;
    }

    if (price !== undefined) {
      if (isNaN(price) || parseFloat(price) < 0) {
        return res.status(400).json({ message: 'Valid price is required' });
      }
      item.price = parseFloat(price);
    }

    if (description !== undefined) {
      item.description = description;
    }

    if (isActive !== undefined) {
      item.isActive = isActive;
    }

    // Handle image upload
    if (req.file) {
      // Delete old image if exists
      if (item.image) {
        deleteStoredProfilePhoto(item.image);
      }
      item.image = `/uploads/menu-items/${req.file.filename}`;
    }

    await item.save();
    res.json({
      message: 'Menu item updated successfully',
      item
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: error.message });
  }
};

// Delete menu item
exports.deleteMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    // Delete image if exists
    if (item.image) {
      deleteStoredProfilePhoto(item.image);
    }

    await item.deleteOne();
    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProfile = profileHandlers.getProfile;
exports.updateProfile = profileHandlers.updateProfile;
exports.changePassword = profileHandlers.changePassword;
exports.uploadProfilePhoto = profileHandlers.uploadProfilePhoto;
exports.deleteProfilePhoto = profileHandlers.deleteProfilePhoto;
