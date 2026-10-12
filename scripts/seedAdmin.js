import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../server/db.js';
import { AdminUser } from '../server/models/AdminUser.js';

dotenv.config();

export async function seedAdmin() {
  await connectDB();

  const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin@SET2026!';
  const name = process.env.ADMIN_NAME || 'Trust Administrator';

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
