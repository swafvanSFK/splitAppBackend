require('dotenv').config();
const { sequelize, Group, User } = require('./models');

async function check() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');
    const users = await User.findAll();
    console.log('Users in DB:');
    users.forEach(u => {
      console.log(`- ID: ${u.id}, Name: ${u.name}, Email: ${u.email}`);
    });

    const groups = await Group.findAll({
      include: [{ model: User, attributes: ['id', 'name'] }]
    });
    console.log('Groups in DB:');
    groups.forEach(g => {
      console.log(`- ID: ${g.id}`);
      console.log(`  Name: ${g.name}`);
      console.log(`  Admin User ID: ${g.admin_user_id}`);
      console.log(`  Members:`, g.Users.map(u => ({ id: u.id, name: u.name })));
    });
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}

check();
