require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const expensesRouter = require('./routes/expenses');
const dashboardRouter = require('./routes/dashboard');
const settlementsRouter = require('./routes/settlements');
const groupsRouter = require('./routes/groups');
const authRouter = require('./routes/auth');

app.use('/api/expenses', expensesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/settlements', settlementsRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/auth', authRouter);

// Basic health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Expense Tracker API.' });
});

// Sync database and start server
sequelize.sync({ force: false }) // Set to true to drop tables on restart
  .then(async () => {
    console.log('Database synced successfully.');
    
    // Check and create the column dynamically to prevent Sequelize sync mismatch in existing environments
    try {
      await sequelize.query('ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "admin_user_id" UUID;');
      console.log('Group table admin_user_id column verified.');
    } catch (queryErr) {
      console.warn('Failed to add admin_user_id column dynamically:', queryErr.message);
    }

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}.`);
    });
  })
  .catch((err) => {
    console.error('Failed to sync database:', err);
  });
