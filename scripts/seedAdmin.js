import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../server/db.js';
import { AdminUser } from '../server/models/AdminUser.js';

dotenv.config();

export async function seedAdmin() {
  await connectDB();

  const username = (process.env.ADMIN_USERNAME || 'singhyug2026').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '2026@Rishi';
  const name = process.env.ADMIN_NAME || 'Sanjay Singh';

  console.log(`[Seed] Provisioning admin account: ${username}...`);

  const passwordHash = await AdminUser.hashPassword(password);

  let user = await AdminUser.findOne({ username });
  if (user) {
    user.passwordHash = passwordHash;
    user.name = name;
    user.isActive = true;
    await user.save();
    console.log(`[Seed] Successfully updated administrator account "${username}".`);
  } else {
    user = await AdminUser.create({
      username,
      passwordHash,
      name,
      role: 'superadmin',
      isActive: true
    });
    console.log(`[Seed] Successfully created new administrator account "${username}".`);
  }

  // Also ensure fallback institutional admin account 'admin' is provisioned
  if (username !== 'admin') {
    const adminHash = await AdminUser.hashPassword(process.env.ADMIN_PASSWORD || '2026@Rishi');
    let defaultAdmin = await AdminUser.findOne({ username: 'admin' });
    if (defaultAdmin) {
      defaultAdmin.passwordHash = adminHash;
      defaultAdmin.isActive = true;
      await defaultAdmin.save();
      console.log('[Seed] Synchronized institutional "admin" account.');
    } else {
      await AdminUser.create({
        username: 'admin',
        passwordHash: adminHash,
        name: 'Trust Administrator',
        role: 'superadmin',
        isActive: true
      });
      console.log('[Seed] Created institutional "admin" account.');
    }
  }

  return user;
}

if (process.argv[1].endsWith('seedAdmin.js')) {
  seedAdmin()
    .then(async () => {
      console.log('[Seed] Admin setup complete.');
      await disconnectDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Seed] Error provisioning admin:', err);
      await disconnectDB();
      process.exit(1);
    });
}
