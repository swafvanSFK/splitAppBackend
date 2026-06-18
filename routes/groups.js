const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Group, UserGroup, User } = require('../models');

// GET /api/groups/user/:userId - Get all groups for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Using include since User and Group have a Many-to-Many relationship through UserGroup
    const user = await User.findByPk(userId, {
      include: [{ 
        model: Group, 
        through: { attributes: [] },
        include: [{
          model: User,
          attributes: ['id', 'name', 'email'],
          through: { attributes: [] }
        }]
      }]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ groups: user.Groups || [] });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// GET /api/groups/:groupId/users - Get all users in a group
router.get('/:groupId/users', async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const group = await Group.findByPk(groupId, {
      include: [{ model: User, through: { attributes: [] } }]
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json({ users: group.Users || [] });
  } catch (error) {
    console.error('Error fetching group members:', error);
    res.status(500).json({ error: 'Failed to fetch group members' });
  }
});

// GET /api/groups/:groupId/activity - Get activity feed
router.get('/:groupId/activity', async (req, res) => {
  const { Expense, User, ExpenseSplit } = require('../models');
  try {
    const { groupId } = req.params;
    const expenses = await Expense.findAll({
      where: { group_id: groupId },
      include: [
        { model: User, as: 'Payer', attributes: ['name'] },
        { model: ExpenseSplit, include: [{ model: User, attributes: ['name'] }] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json({ activity: expenses });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// GET /api/groups/:groupId/export - Export CSV
router.get('/:groupId/export', async (req, res) => {
  const { Parser } = require('json2csv');
  const { Expense, User } = require('../models');
  try {
    const { groupId } = req.params;
    const expenses = await Expense.findAll({
      where: { group_id: groupId },
      include: [{ model: User, as: 'Payer', attributes: ['name'] }],
      order: [['createdAt', 'DESC']]
    });

    const data = expenses.map(exp => ({
      Date: exp.createdAt.toISOString().split('T')[0],
      Category: exp.category,
      Description: exp.description || '',
      Amount: parseFloat(exp.amount).toFixed(2),
      PaidBy: exp.Payer ? exp.Payer.name : 'Unknown'
    }));

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(data);

    res.header('Content-Type', 'text/csv');
    res.attachment('expenses.csv');
    return res.send(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// POST /api/groups - Create a new group
router.post('/', async (req, res) => {
  const { name, user_id } = req.body;
  try {
    // Generate a random 6-character alphanumeric invite code
    const invite_code = crypto.randomBytes(3).toString('hex').toUpperCase();

    const group = await Group.create({ name, invite_code, admin_user_id: user_id });

    // Automatically add the creator to the group
    if (user_id) {
      await UserGroup.create({
        user_id,
        group_id: group.id
      });
    }

    // Eager-load users so frontend has the members list immediately
    const freshGroup = await Group.findByPk(group.id, {
      include: [{
        model: User,
        attributes: ['id', 'name', 'email'],
        through: { attributes: [] }
      }]
    });

    res.status(201).json({ message: 'Group created', group: freshGroup });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// POST /api/groups/join - Join a group via invite code
router.post('/join', async (req, res) => {
  const { invite_code, user_id } = req.body;
  try {
    const group = await Group.findOne({ where: { invite_code } });

    if (!group) {
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    // Check if user is already in the group
    const existingMembership = await UserGroup.findOne({
      where: { user_id, group_id: group.id }
    });

    if (existingMembership) {
      return res.status(400).json({ error: 'You are already in this group' });
    }

    await UserGroup.create({
      user_id,
      group_id: group.id
    });

    // Eager-load users so frontend has the members list immediately
    const freshGroup = await Group.findByPk(group.id, {
      include: [{
        model: User,
        attributes: ['id', 'name', 'email'],
        through: { attributes: [] }
      }]
    });

    res.status(200).json({ message: 'Joined group successfully', group: freshGroup });

    // Trigger Notification asynchronously
    try {
      const { sendGroupNotification } = require('../utils/notificationHelper');
      const newUser = await User.findByPk(user_id);
      const newUserName = newUser ? newUser.name : 'Someone';
      sendGroupNotification(
        group.id,
        user_id,
        'MEMBER_JOINED',
        'New Member Joined',
        `${newUserName} joined the room "${group.name}"`
      );
    } catch (notifErr) {
      console.error('Notification trigger error:', notifErr);
    }
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// PUT /api/groups/:groupId - Edit room name (Admin only)
router.put('/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const { name, userId } = req.body;

  if (!name || !userId) {
    return res.status(400).json({ error: 'Missing room name or user ID' });
  }

  try {
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (group.admin_user_id !== userId) {
      return res.status(403).json({ error: 'Only the room admin is allowed to rename it.' });
    }

    await group.update({ name });

    // Eager-load users so frontend has the updated members list
    const freshGroup = await Group.findByPk(group.id, {
      include: [{
        model: User,
        attributes: ['id', 'name', 'email'],
        through: { attributes: [] }
      }]
    });

    res.json({ message: 'Room renamed successfully', group: freshGroup });
  } catch (error) {
    console.error('Error updating group name:', error);
    res.status(500).json({ error: 'Failed to rename room' });
  }
});

// DELETE /api/groups/:groupId - Delete room and all its details (Admin only)
router.delete('/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.body || {}; // Allow from body

  // Also support reading from headers or query parameters if body is not parsed
  const requesterId = userId || req.query.userId || req.headers['x-user-id'];

  if (!requesterId) {
    return res.status(400).json({ error: 'Requester User ID is required' });
  }

  try {
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (group.admin_user_id !== requesterId) {
      return res.status(403).json({ error: 'Only the room admin is allowed to delete it.' });
    }

    const { Expense, ExpenseSplit } = require('../models');

    // 1. Delete splits
    const expenses = await Expense.findAll({ where: { group_id: groupId } });
    const expenseIds = expenses.map(e => e.id);
    await ExpenseSplit.destroy({ where: { expense_id: expenseIds } });
    
    // 2. Delete expenses
    await Expense.destroy({ where: { group_id: groupId } });
    
    // 3. Delete user groups memberships
    await UserGroup.destroy({ where: { group_id: groupId } });
    
    // 4. Finally delete group
    await group.destroy();

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

module.exports = router;
