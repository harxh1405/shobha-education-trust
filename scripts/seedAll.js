import { connectDB, disconnectDB } from '../server/db.js';
import { seedAdmin } from './seedAdmin.js';
import { seedFeeCategories } from './seedFeeCategories.js';
import { seedSampleContent } from './seedSampleContent.js';

async function main() {
  console.log('====================================================');
  console.log('  SHOBHA EDUCATION TRUST — MASTER SEEDING PIPELINE  ');
  console.log('====================================================');
  await connectDB();

  await seedAdmin();
  await seedFeeCategories();
  await seedSampleContent();

  console.log('====================================================');
  console.log('  ALL SEEDS EXECUTED SUCCESSFULLY                   ');
  console.log('====================================================');
  await disconnectDB();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('[Master Seed] Error during seeding:', err);
  await disconnectDB();
  process.exit(1);
});
