const { sequelize, User, Group, UserGroup, Expense, ExpenseSplit } = require('./models');

async function seed() {
  await sequelize.sync();

  try {
    const [user1] = await User.findOrCreate({
      where: { id: '11111111-1111-1111-1111-111111111111' },
      defaults: { name: 'Safwan', email: 'safwan@example.com', password_hash: 'dummyhash' }
    });

    const [user2] = await User.findOrCreate({
      where: { id: '33333333-3333-3333-3333-333333333333' },
      defaults: { name: 'Alex', email: 'alex@example.com', password_hash: 'dummyhash2' }
    });

    const [group] = await Group.findOrCreate({
      where: { id: '22222222-2222-2222-2222-222222222222' },
      defaults: { name: 'Hostel 101 Group', invite_code: 'HOSTEL101' }
    });

    await UserGroup.findOrCreate({
      where: { user_id: user1.id, group_id: group.id }
    });
    await UserGroup.findOrCreate({
      where: { user_id: user2.id, group_id: group.id }
    });

    const expenseCount = await Expense.count();
    if (expenseCount === 0) {
      // Dummy Expense 1: Safwan paid $100 for groceries. Alex owes $50.
      const expense1 = await Expense.create({
        amount: 100,
        category: 'Food',
        group_id: group.id,
        paid_by_user_id: user1.id,
      });

      await ExpenseSplit.bulkCreate([
        { expense_id: expense1.id, user_id: user1.id, amount_owed: 50 },
        { expense_id: expense1.id, user_id: user2.id, amount_owed: 50 }
      ]);

      // Dummy Expense 2: Alex paid $200 for utilities. Safwan owes $100.
      const expense2 = await Expense.create({
        amount: 200,
        category: 'Utilities',
        group_id: group.id,
        paid_by_user_id: user2.id,
      });

      await ExpenseSplit.bulkCreate([
        { expense_id: expense2.id, user_id: user1.id, amount_owed: 100 },
        { expense_id: expense2.id, user_id: user2.id, amount_owed: 100 }
      ]);
      console.log('Successfully seeded dummy expenses!');
    }

    console.log('Seed completed!');
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    process.exit();
  }
}

seed();
