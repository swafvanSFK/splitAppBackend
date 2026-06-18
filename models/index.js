const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'expense_tracker',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'postgres',
    logging: false,
  }
);

const User = require('./User')(sequelize);
const Group = require('./Group')(sequelize);
const UserGroup = require('./UserGroup')(sequelize);
const Expense = require('./Expense')(sequelize);
const ExpenseSplit = require('./ExpenseSplit')(sequelize);
const Settlement = require('./Settlement')(sequelize);
const Notification = require('./Notification')(sequelize);
const PushToken = require('./PushToken')(sequelize);

// Associations
User.belongsToMany(Group, { through: UserGroup, foreignKey: 'user_id' });
Group.belongsToMany(User, { through: UserGroup, foreignKey: 'group_id' });

Group.hasMany(Expense, { foreignKey: 'group_id' });
Expense.belongsTo(Group, { foreignKey: 'group_id' });

User.hasMany(Expense, { foreignKey: 'paid_by_user_id', as: 'PaidExpenses' });
Expense.belongsTo(User, { foreignKey: 'paid_by_user_id', as: 'Payer' });

Expense.hasMany(ExpenseSplit, { foreignKey: 'expense_id' });
ExpenseSplit.belongsTo(Expense, { foreignKey: 'expense_id' });

User.hasMany(ExpenseSplit, { foreignKey: 'user_id' });
ExpenseSplit.belongsTo(User, { foreignKey: 'user_id' });

Group.hasMany(Settlement, { foreignKey: 'group_id' });
Settlement.belongsTo(Group, { foreignKey: 'group_id' });

User.hasMany(Settlement, { foreignKey: 'from_user_id', as: 'SettlementsOwed' });
Settlement.belongsTo(User, { foreignKey: 'from_user_id', as: 'Debtor' });

User.hasMany(Settlement, { foreignKey: 'to_user_id', as: 'SettlementsToReceive' });
Settlement.belongsTo(User, { foreignKey: 'to_user_id', as: 'Creditor' });

User.hasMany(Notification, { foreignKey: 'user_id' });
Notification.belongsTo(User, { foreignKey: 'user_id' });

Group.hasMany(Notification, { foreignKey: 'group_id' });
Notification.belongsTo(Group, { foreignKey: 'group_id' });

User.hasMany(PushToken, { foreignKey: 'user_id' });
PushToken.belongsTo(User, { foreignKey: 'user_id' });

module.exports = {
  sequelize,
  User,
  Group,
  UserGroup,
  Expense,
  ExpenseSplit,
  Settlement,
  Notification,
  PushToken,
};
