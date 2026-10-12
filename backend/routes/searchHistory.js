const router = require('express').Router();
const SearchHistory = require('../models/SearchHistory');
const { authenticate } = require('../middleware/auth');

// GET /api/search-history — list current user's search history
router.get('/', authenticate, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    const history = await SearchHistory.find({ user: req.user._id })
      .sort({ searchedAt: -1 })
      .limit(limit)
      .select('-__v');

    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Search history fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch search history'
    });
  }
});

// DELETE /api/search-history — clear all history for current user
router.delete('/', authenticate, async (req, res) => {
  try {
    await SearchHistory.deleteMany({ user: req.user._id });

    res.json({
      success: true,
      message: 'Search history cleared'
    });
  } catch (error) {
    console.error('Search history clear error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear search history'
    });
  }
});

// DELETE /api/search-history/:id — delete a single entry
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const entry = await SearchHistory.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Search history entry not found'
      });
    }

    res.json({
      success: true,
      message: 'Search history entry deleted'
    });
  } catch (error) {
    console.error('Search history delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete search history entry'
    });
  }
});

module.exports = router;
