const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Register route
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    //console.log(name, email, password);
    
    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    user = new User({
      name,
      email,
      password: hashedPassword
    });

    await user.save();

    // Create and return JWT token
    const token = jwt.sign(
      { userId: user._id, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  console.log('Login route hit - Request body:', req.body); // Log the incoming request

  try {
    const { email, password } = req.body;
    console.log('Attempting to find user with email:', email); // Log the email being searched

    const user = await User.findOne({ email });
    console.log('User found from database:', user); // Log the found user

    if (!user) {
      console.log('No user found with this email'); // Log when user not found
      return res.status(400).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match result:', isMatch); // Log password match result

    if (!isMatch) {
      console.log('Invalid password provided'); // Log invalid password
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { 
        id: user._id, 
        isAdmin: user.isAdmin, 
        name: user.name 
      },
      process.env.JWT_SECRET
    );

    console.log('Generated token and sending response with:', { // Log the response data
      token: token.substring(0, 20) + '...', // Only log part of the token for security
      isAdmin: user.isAdmin,
      name: user.name
    });

    res.json({
      token,
      isAdmin: user.isAdmin,
      name: user.name,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error); // Log any errors
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 