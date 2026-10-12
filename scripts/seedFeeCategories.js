import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../server/db.js';
import { FeeCategory } from '../server/models/FeeCategory.js';

dotenv.config();

export async function seedFeeCategories() {
  await connectDB();

  console.log('[Seed] Seeding default course fee categories...');

  const defaultFees = [
    {
      name: 'D.El.Ed (BTC) — Annual Tuition & Training Fee',
      institution: 'Sarveshwaree Mahavidyalaya',
      programme: 'D.El.Ed (BTC)',
      academicSession: '2026-2027',
      amountPaise: 4100000, // ₹41,000 per annum
      currency: 'INR',
      description: 'Official annual fee for Diploma in Elementary Education (D.El.Ed / BTC) two-year teacher education programme.',
      status: 'published',
      isActive: true,
      createdBy: 'system'
    },
    {
      name: 'ITI — Annual Technical Training Fee (Electrician / Fitter)',
      institution: 'Sarveshwaree Private ITI',
      programme: 'Industrial Training Institute (ITI)',
      academicSession: '2026-2027',
      amountPaise: 1600000, // ₹16,000 per year
      currency: 'INR',
      description: 'Annual training and practical workshop fee for two-year NCVT/SCVT approved Electrician and Fitter technical trades.',
      status: 'published',
      isActive: true,
      createdBy: 'system'
    },
    {
      name: 'B.A. (Bachelor of Arts) — Semester Tuition Fee',
      institution: 'Sarveshwaree Mahavidyalaya',
      programme: 'Bachelor of Arts (B.A.)',
      academicSession: '2026-2027',
      amountPaise: 300000, // ₹3,000 per semester
      currency: 'INR',
      description: 'Semester tuition fee for VBS Purvanchal University affiliated 6-semester undergraduate Bachelor of Arts curriculum.',
      status: 'published',
      isActive: true,
      createdBy: 'system'
    }
  ];

  for (const feeData of defaultFees) {
    const existing = await FeeCategory.findOne({
      name: feeData.name,
      academicSession: feeData.academicSession
    });

    if (existing) {
      existing.amountPaise = feeData.amountPaise;
      existing.description = feeData.description;
      existing.status = 'published';
      existing.isActive = true;
      await existing.save();
      console.log(`[Seed] Updated fee: ${feeData.name} -> ₹${feeData.amountPaise / 100}`);
    } else {
      await FeeCategory.create(feeData);
      console.log(`[Seed] Created fee: ${feeData.name} -> ₹${feeData.amountPaise / 100}`);
    }
  }

  console.log('[Seed] Fee categories successfully seeded.');
}

if (process.argv[1].endsWith('seedFeeCategories.js')) {
  seedFeeCategories()
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Seed] Error seeding fees:', err);
      await disconnectDB();
      process.exit(1);
    });
}
