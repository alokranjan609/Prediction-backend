const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch((err) => console.log('MongoDB Connection Error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/predict', require('./routes/prediction'));
app.use('/api/search-history', require('./routes/searchHistory'));
app.use('/api/saved-areas', require('./routes/savedAreas'));


// Create or update the top-level admin user on server start based on .env.
const User = require('./models/User');
const migrateRolesAndCreateAdmin = async () => {
  try {
    // Existing records use: super_admin (top level), admin (team level).
    // Only run this one-time conversion while legacy top-level records exist;
    // otherwise a later restart could demote canonical admin records.
    if (await User.exists({ role: 'super_admin' })) {
      await User.updateMany({ role: 'admin' }, { $set: { role: 'team' } });
      await User.updateMany({ role: 'super_admin' }, { $set: { role: 'admin' } });
    }

    const adminEmail = process.env.ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD || process.env.SUPER_ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.log('Admin credentials not configured in .env');
      return;
    }

    const adminExists = await User.findOne({ email: adminEmail });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await User.create({
        name: 'Admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        isAdmin: true,
        contactNumber: 'N/A',
        accountStatus: 'approved',
      });
      console.log(`Admin user created for ${adminEmail}`);
    } else {
      let needsSave = false;

      // Update password if .env password changed
      const isMatch = await bcrypt.compare(adminPassword, adminExists.password);
      if (!isMatch) {
        adminExists.password = await bcrypt.hash(adminPassword, 10);
        needsSave = true;
        console.log(`Updated password for admin ${adminEmail} from .env`);
      }

      if (adminExists.role !== 'admin' || !adminExists.isAdmin) {
        adminExists.role = 'admin';
        adminExists.isAdmin = true;
        needsSave = true;
        console.log(`Promoted user ${adminEmail} to admin`);
      }

      if (!adminExists.contactNumber) {
        adminExists.contactNumber = 'N/A';
        needsSave = true;
      }

      if (adminExists.accountStatus !== 'approved') {
        adminExists.accountStatus = 'approved';
        needsSave = true;
      }

      if (needsSave) {
        await adminExists.save();
      }
    }
  } catch (error) {
    console.log('Error creating/updating admin:', error);
  }
};

migrateRolesAndCreateAdmin();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
