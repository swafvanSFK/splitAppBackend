const express = require('express');
const router = express.Router();
const { Expense, ExpenseSplit, User } = require('../models');
const { calculateSettlements } = require('../utils/settlementEngine');

// GET /api/settlements/:groupId
router.get('/:groupId', async (req, res) => {
  const { groupId } = req.params;

  try {
    // 1. Fetch all expenses for this group
    const expenses = await Expense.findAll({
      where: { group_id: groupId }
    });
    
    if (expenses.length === 0) {
        return res.json({ groupId, rawBalances: {}, settlements: [] });
    }

    const expenseIds = expenses.map(e => e.id);

    // 2. Fetch all splits for these expenses
    const splits = await ExpenseSplit.findAll({
      where: { expense_id: expenseIds }
    });

    // 3. Calculate net balances for each user
    // Balance = Total Paid - Total Owed
    const balances = {};

    // Add what they paid (Creditor)
    expenses.forEach(exp => {
      const payerId = exp.paid_by_user_id;
      if (!balances[payerId]) balances[payerId] = 0;
      balances[payerId] += parseFloat(exp.amount);
    });

    // Subtract what they owe (Debtor)
    splits.forEach(split => {
      const userId = split.user_id;
      if (!balances[userId]) balances[userId] = 0;
      balances[userId] -= parseFloat(split.amount_owed);
    });

    // Clean up floating point precision issues (e.g., 0.000000000001)
    for (const userId in balances) {
      if (Math.abs(balances[userId]) < 0.01) {
        delete balances[userId];
      }
    }

    // 4. Run greedy algorithm to simplify debts
    const optimizedTransactions = calculateSettlements(balances);

    // 5. Fetch user names to make the response readable for the frontend
    const users = await User.findAll();
    const userMap = {};
    users.forEach(u => userMap[u.id] = u.name);

    const formattedTransactions = optimizedTransactions.map(t => ({
      id: Math.random().toString(), // Dummy ID for React list keys
      from: userMap[t.from_user_id] || 'Unknown',
      to: userMap[t.to_user_id] || 'Unknown',
      from_user_id: t.from_user_id,
      to_user_id: t.to_user_id,
      amount: t.amount
    }));

    res.json({
      groupId,
      rawBalances: balances,
      settlements: formattedTransactions
    });

  } catch (error) {
    console.error('Error calculating settlements:', error);
    res.status(500).json({ error: 'Failed to calculate settlements' });
  }
});

// POST /api/settlements/pay
router.post('/pay', async (req, res) => {
  const { groupId, payer_id, payee_id, amount } = req.body;
  
  if (!groupId || !payer_id || !payee_id || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const expense = await Expense.create({
      amount,
      category: 'Settlement',
      group_id: groupId,
      paid_by_user_id: payer_id
    });

    await ExpenseSplit.create({
      expense_id: expense.id,
      user_id: payee_id,
      amount_owed: amount
    });

    res.status(201).json({ message: 'Payment recorded successfully' });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

module.exports = router;
