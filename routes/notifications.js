const express = require('express');
const router = express.Router();
const { Notification, PushToken, Group } = require('../models');

// POST /api/notifications/token - Register/update push token
router.post('/token', async (req, res) => {
  const { userId, token } = req.body;

  if (!userId || !token) {
    return res.status(400).json({ error: 'User ID and token are required' });
  }

  try {
    const existingToken = await PushToken.findOne({ where: { token } });
    if (existingToken) {
      // Update ownership if it changed
      await existingToken.update({ user_id: userId });
      return res.status(200).json({ message: 'Token ownership updated', token: existingToken });
    }

    // Create a new token mapping
    const newToken = await PushToken.create({ user_id: userId, token });
    res.status(201).json({ message: 'Token registered successfully', token: newToken });
  } catch (error) {
    console.error('Error registering push token:', error);
    res.status(500).json({ error: 'Failed to register push token' });
  }
});

// GET /api/notifications/user/:userId - Fetch all notifications for a user
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const list = await Notification.findAll({
      where: { user_id: userId },
      include: [{ model: Group, attributes: ['name'] }],
      order: [['createdAt', 'DESC']]
    });

    res.json({ notifications: list });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PUT /api/notifications/:notificationId/read - Mark notification as read
router.put('/:notificationId/read', async (req, res) => {
  const { notificationId } = req.params;

  try {
    const notification = await Notification.findByPk(notificationId);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await notification.update({ is_read: true });
    res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

// PUT /api/notifications/user/:userId/read-all - Mark all as read
router.put('/user/:userId/read-all', async (req, res) => {
  const { userId } = req.params;

  try {
    await Notification.update(
      { is_read: true },
      { where: { user_id: userId, is_read: false } }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

module.exports = router;
