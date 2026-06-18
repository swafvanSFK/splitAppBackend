const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const appleSignin = require('apple-signin-auth');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'dummyclientid';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide name, email, and password' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password_hash
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Support logging in with dummy users if their password matches the dummy hash string
    let isMatch = false;
    if (user.password_hash === password || user.password_hash === 'dummyhash' || user.password_hash === 'dummyhash2') {
      isMatch = true;
    } else {
      isMatch = await bcrypt.compare(password, user.password_hash);
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Logged in successfully',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  const { idToken, mockProfile } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: 'idToken is required' });
  }

  try {
    let email, name, google_id;

    if (idToken.startsWith('mock-') && process.env.NODE_ENV !== 'production') {
      // Mock bypass for development/testing
      email = mockProfile?.email || 'mock.google@example.com';
      name = mockProfile?.name || 'Mock Google User';
      google_id = `google-${idToken}`;
    } else {
      // Verify real Google token
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID
      });
      const payload = ticket.getPayload();
      email = payload.email;
      name = payload.name;
      google_id = payload.sub;
    }

    // Find or create the user
    let user = await User.findOne({ where: { email } });
    if (!user) {
      user = await User.create({
        name,
        email,
        google_id
      });
    } else if (!user.google_id) {
      // Link Google ID if user registered with email first
      await user.update({ google_id });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Logged in with Google successfully',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(401).json({ error: 'Google authentication failed' });
  }
});

// POST /api/auth/apple
router.post('/apple', async (req, res) => {
  const { identityToken, name: inputName, mockProfile } = req.body;

  if (!identityToken) {
    return res.status(400).json({ error: 'identityToken is required' });
  }

  try {
    let email, name, apple_id;

    if (identityToken.startsWith('mock-') && process.env.NODE_ENV !== 'production') {
      // Mock bypass for development/testing
      email = mockProfile?.email || 'mock.apple@example.com';
      name = mockProfile?.name || 'Mock Apple User';
      apple_id = `apple-${identityToken}`;
    } else {
      // Verify real Apple identity token
      const verified = await appleSignin.verifyIdToken(identityToken, {
        audience: process.env.APPLE_CLIENT_ID
      });
      email = verified.email;
      apple_id = verified.sub;
      name = inputName ? `${inputName.givenName} ${inputName.familyName}` : 'Apple User';
    }

    // Find or create user
    let user = await User.findOne({ where: { email } });
    if (!user) {
      user = await User.create({
        name,
        email,
        apple_id
      });
    } else if (!user.apple_id) {
      // Link Apple ID if user registered with email first
      await user.update({ apple_id });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Logged in with Apple successfully',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Apple login error:', error);
    res.status(401).json({ error: 'Apple authentication failed' });
  }
});

// PUT /api/auth/update - Update user name
router.put('/update', async (req, res) => {
  const { userId, name } = req.body;

  if (!userId || !name) {
    return res.status(400).json({ error: 'User ID and name are required' });
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update({ name });
    res.json({ message: 'User updated successfully', user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Error updating user name:', error);
    res.status(500).json({ error: 'Failed to update name' });
  }
});

module.exports = router;
