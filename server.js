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
  .then(() => {
    console.log('Database synced successfully.');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}.`);
    });
  })
  .catch((err) => {
    console.error('Failed to sync database:', err);
  });
