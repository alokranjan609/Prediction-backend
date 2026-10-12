const router = require('express').Router();
const User = require('../models/User');
const SearchHistory = require('../models/SearchHistory');
const { verifyTeam, verifyAdmin } = require('../middleware/auth');

const publicUserFields = '-password -__v -approvalTokenHash -approvalTokenExpires';

// Admin: list all pending registrations (users and teams)
router.get('/registrations/pending', verifyAdmin, async (req, res) => {
  try {
    const pending = await User.find({ accountStatus: 'pending' })
      .select(publicUserFields)
      .sort({ createdAt: -1 });
    res.json(pending.map((user) => ({ ...user.toObject(), role: user.getRole() })));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: approve pending registration by ID
router.put('/registrations/:id/approve', verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.accountStatus !== 'pending') {
      return res.status(400).json({ message: `Registration is already ${user.accountStatus}` });
    }

    user.accountStatus = 'approved';
    user.approvalTokenHash = null;
    user.approvalTokenExpires = null;
    await user.save();

    res.json({
      message: `${user.role === 'team' ? 'Team member' : 'User'} approved successfully`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.getRole(),
        accountStatus: user.accountStatus,
        contactNumber: user.contactNumber,
        sector: user.sector,
        departmentName: user.departmentName,
        institutionName: user.institutionName,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: reject pending registration by ID
router.put('/registrations/:id/reject', verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.accountStatus !== 'pending') {
      return res.status(400).json({ message: `Registration is already ${user.accountStatus}` });
    }

    user.accountStatus = 'rejected';
    user.approvalTokenHash = null;
    user.approvalTokenExpires = null;
    await user.save();

    res.json({
      message: `${user.role === 'team' ? 'Team member' : 'User'} rejected`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.getRole(),
        accountStatus: user.accountStatus,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Teams and admins can view all users.
router.get('/', verifyTeam, async (req, res) => {
  try {
    const users = await User.find().select(publicUserFields).sort({ createdAt: -1 });
    res.json(users.map((user) => ({ ...user.toObject(), role: user.getRole() })));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Teams and admins can view prediction/search activity.
router.get('/activity', verifyTeam, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const filter = req.query.userId ? { user: req.query.userId } : {};
    const activity = await SearchHistory.find(filter)
      .populate('user', 'name email role isAdmin')
      .sort({ searchedAt: -1 })
      .limit(limit)
      .select('-__v');
    res.json(activity.map((entry) => {
      const entryResponse = entry.toObject();
      if (entry.user) {
        entryResponse.user = {
          ...entryResponse.user,
          role: entry.user.getRole()
        };
      }
      return entryResponse;
    }));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id/activity', verifyTeam, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(publicUserFields);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const activity = await SearchHistory.find({ user: user._id })
      .sort({ searchedAt: -1 })
      .limit(limit)
      .select('-__v');
    res.json({ user: { ...user.toObject(), role: user.getRole() }, activity });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Only an admin can remove a team. /admins remains as a compatibility path.
router.delete(['/teams/:id', '/admins/:id'], verifyAdmin, async (req, res) => {
  try {
    const team = await User.findById(req.params.id);
    if (!team || team.getRole() !== 'team') {
      return res.status(404).json({ message: 'Team not found' });
    }
    await Promise.all([
      User.deleteOne({ _id: team._id }),
      SearchHistory.deleteMany({ user: team._id })
    ]);
    res.json({ message: req.path.startsWith('/admins/') ? 'Admin removed' : 'Team removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Only an admin can delete regular users and their activity.
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.getRole() !== 'user') {
      return res.status(404).json({ message: 'User not found' });
    }
    await Promise.all([
      User.deleteOne({ _id: user._id }),
      SearchHistory.deleteMany({ user: user._id })
    ]);
    res.json({ message: 'User removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
