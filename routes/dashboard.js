const express = require('express');
const router = express.Router();
const { Expense, ExpenseSplit } = require('../models');
const { Op } = require('sequelize');

// GET /api/dashboard/:userId/:groupId
router.get('/:userId/:groupId', async (req, res) => {
  const { userId, groupId } = req.params;

  try {
    // 1. Get recent expenses (limiting to 5)
    const recentExpenses = await Expense.findAll({
      where: { group_id: groupId },
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    // 2. Calculate Total I Paid (Excluding Settlements for display)
    const expensesPaid = await Expense.findAll({ 
      where: { 
        paid_by_user_id: userId, 
        group_id: groupId,
        category: { [Op.ne]: 'Settlement' }
      } 
    });
    const totalIPaid = expensesPaid.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

    // Calculate All Paid (Including Settlements for balance)
    const allExpensesPaid = await Expense.findAll({ 
      where: { paid_by_user_id: userId, group_id: groupId } 
    });
    const totalAllPaid = allExpensesPaid.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

    // 3. Calculate Total My Share (Excluding Settlements for display)
    const mySplits = await ExpenseSplit.findAll({ 
      where: { user_id: userId },
      include: [{
        model: Expense,
        where: { 
          group_id: groupId,
          category: { [Op.ne]: 'Settlement' }
        },
        attributes: []
      }]
    });
    const totalMyShare = mySplits.reduce((sum, split) => sum + parseFloat(split.amount_owed), 0);

    // Calculate All Owed (Including Settlements for balance)
    const allMySplits = await ExpenseSplit.findAll({ 
      where: { user_id: userId },
      include: [{
        model: Expense,
        where: { group_id: groupId },
        attributes: []
      }]
    });
    const totalAllMyShare = allMySplits.reduce((sum, split) => sum + parseFloat(split.amount_owed), 0);

    // 4. Calculate Current Monthly Balance
    // Balance = (Everything you ever paid) - (Everything you ever owed)
    const currentMonthlyBalance = totalAllPaid - totalAllMyShare;

    // 5. Category Breakdown for Pie Chart (Excluding Settlements)
    const allGroupExpenses = await Expense.findAll({ 
      where: { 
        group_id: groupId,
        category: { [Op.ne]: 'Settlement' }
      } 
    });
    const categoryTotals = {};
    allGroupExpenses.forEach(exp => {
      const cat = exp.category || 'Misc';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + parseFloat(exp.amount);
    });

    const categoryBreakdown = Object.keys(categoryTotals).map((name, index) => {
      const colors = ['#7C3AED', '#EC4899', '#8B5CF6', '#F472B6', '#C084FC'];
      return {
        name,
        amount: categoryTotals[name],
        color: colors[index % colors.length],
        legendFontColor: '#7F7F7F',
        legendFontSize: 14
      };
    });

    // Formatting recent expenses for frontend
    const formattedExpenses = recentExpenses.map(exp => ({
      id: exp.id,
      description: exp.description || (exp.category + ' Expense'),
      amount: parseFloat(exp.amount),
      category: exp.category,
      paidBy: exp.paid_by_user_id === userId ? 'You' : 'Someone Else',
      date: exp.createdAt
    }));

    res.json({
      totalIPaid,
      totalMyShare,
      currentMonthlyBalance,
      categoryBreakdown,
      recentExpenses: formattedExpenses
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;
