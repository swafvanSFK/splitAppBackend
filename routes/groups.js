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
      include: [{ model: Group, through: { attributes: [] } }]
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

    const group = await Group.create({ name, invite_code });

    // Automatically add the creator to the group
    if (user_id) {
      await UserGroup.create({
        user_id,
        group_id: group.id
      });
    }

    res.status(201).json({ message: 'Group created', group });
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

    res.status(200).json({ message: 'Joined group successfully', group });
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

module.exports = router;
