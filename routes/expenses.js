const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { Expense, ExpenseSplit, User } = require('../models');
const { sendGroupNotification } = require('../utils/notificationHelper');

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// POST /api/expenses
router.post('/', upload.single('receipt'), async (req, res) => {
  const { amount, category, description, group_id, paid_by_user_id, splits } = req.body;
  
  // Handle splits which might be a JSON string if sent via FormData
  let parsedSplits = [];
  if (splits) {
    parsedSplits = typeof splits === 'string' ? JSON.parse(splits) : splits;
  }

  // Handle receipt URL if uploaded
  let receipt_url = req.body.receipt_url || null;
  if (req.file) {
    receipt_url = `/uploads/${req.file.filename}`;
  }

  try {
    const expense = await Expense.create({
      amount,
      category,
      description,
      receipt_url,
      group_id,
      paid_by_user_id
    });

    if (parsedSplits && parsedSplits.length > 0) {
      const splitData = parsedSplits.map(split => ({
        expense_id: expense.id,
        user_id: split.user_id,
        amount_owed: split.amount_owed
      }));
      await ExpenseSplit.bulkCreate(splitData);
    }

    res.status(201).json({ message: 'Expense added successfully', expense });

    // Trigger Notification asynchronously
    try {
      const payer = await User.findByPk(paid_by_user_id);
      const payerName = payer ? payer.name : 'Someone';
      sendGroupNotification(
        group_id,
        paid_by_user_id,
        'EXPENSE_ADDED',
        'New Expense Added',
        `${payerName} added a new expense of AED ${parseFloat(amount).toFixed(2)}: "${description || category}"`
      );
    } catch (notifErr) {
      console.error('Notification trigger error:', notifErr);
    }
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

// GET /api/expenses/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await Expense.findByPk(id, {
      include: [{ model: ExpenseSplit }]
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json({ expense });
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if expense exists
    const expense = await Expense.findByPk(id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Delete associated splits first
    await ExpenseSplit.destroy({ where: { expense_id: id } });
    
    // Delete the expense
    await expense.destroy();
    
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// PUT /api/expenses/:id
router.put('/:id', upload.single('receipt'), async (req, res) => {
  const { id } = req.params;
  const { amount, category, description, splits } = req.body;

  try {
    const expense = await Expense.findByPk(id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Handle receipt URL if uploaded
    let receipt_url = expense.receipt_url;
    if (req.file) {
      receipt_url = `/uploads/${req.file.filename}`;
    } else if (req.body.receipt_url === 'null' || req.body.receipt_url === '') {
      receipt_url = null;
    }

    // Update expense
    await expense.update({
      amount,
      category,
      description,
      receipt_url
    });

    // Handle splits
    let parsedSplits = [];
    if (splits) {
      parsedSplits = typeof splits === 'string' ? JSON.parse(splits) : splits;
    }

    if (parsedSplits && parsedSplits.length > 0) {
      // Remove old splits
      await ExpenseSplit.destroy({ where: { expense_id: id } });
      
      // Create new splits
      const splitData = parsedSplits.map(split => ({
        expense_id: id,
        user_id: split.user_id,
        amount_owed: split.amount_owed
      }));
      await ExpenseSplit.bulkCreate(splitData);
    }

    res.json({ message: 'Expense updated successfully', expense });
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

module.exports = router;
