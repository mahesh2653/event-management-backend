import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import { Category } from '../entities/Category';
import { Event } from '../entities/Event';
import { hashPassword } from '../utils/password';
import { slugify } from '../utils/slugify';
import { localToUtc } from '../utils/timezone';

dotenv.config();

// Mirrors the structure of the provided frontend mock data (mockCategories, mockUsers, mockEvents)
const categorySeed: { name: string; parent?: string }[] = [
  { name: 'Business' },
  { name: 'Marketing', parent: 'Business' },
  { name: 'Digital Marketing', parent: 'Marketing' },
  { name: 'Content Marketing', parent: 'Marketing' },
  { name: 'Finance', parent: 'Business' },
  { name: 'Investment', parent: 'Finance' },
  { name: 'Mutual Funds', parent: 'Investment' },
  { name: 'Stocks', parent: 'Investment' },
  { name: 'Technology' },
  { name: 'AI & ML', parent: 'Technology' },
  { name: 'Web Development', parent: 'Technology' },
  { name: 'Cloud', parent: 'Technology' },
  { name: 'Design' },
  { name: 'UI/UX', parent: 'Design' },
  { name: 'Branding', parent: 'Design' },
  { name: 'Education' },
  { name: 'Workshops', parent: 'Education' },
  { name: 'Certifications', parent: 'Education' },
  { name: 'Health' },
  { name: 'Wellness', parent: 'Health' },
];

async function run() {
  await AppDataSource.initialize();
  console.log('Connected. Seeding...');

  const userRepo = AppDataSource.getRepository(User);
  const categoryRepo = AppDataSource.getRepository(Category);
  const eventRepo = AppDataSource.getRepository(Event);

  // --- Admin + a couple of sample users ---
  const adminExists = await userRepo.findOne({ where: { username: 'admin' } });
  let admin: User;
  if (!adminExists) {
    admin = userRepo.create({
      name: 'Admin User',
      username: 'admin',
      email: 'admin@eventflow.io',
      password: await hashPassword('Admin@123'),
      role: 'admin',
      status: 'active',
      timezone: 'Asia/Kolkata',
    });
    await userRepo.save(admin);
    console.log('Created admin user -> username: admin / password: Admin@123');
  } else {
    admin = adminExists;
  }

  const editorExists = await userRepo.findOne({ where: { username: 'priya.patel' } });
  if (!editorExists) {
    const editor = userRepo.create({
      name: 'Priya Patel',
      username: 'priya.patel',
      email: 'priya.patel@eventflow.io',
      password: await hashPassword('Editor@123'),
      role: 'editor',
      status: 'active',
      timezone: 'Asia/Kolkata',
    });
    await userRepo.save(editor);
    console.log('Created editor user -> username: priya.patel / password: Editor@123');
  }

  // --- Nested categories ---
  const nameToId = new Map<string, string>();
  for (const cat of categorySeed) {
    const existing = await categoryRepo.findOne({ where: { slug: slugify(cat.name) } });
    if (existing) {
      nameToId.set(cat.name, existing.id);
      continue;
    }
    const parentId = cat.parent ? nameToId.get(cat.parent) || null : null;
    const created = categoryRepo.create({ name: cat.name, slug: slugify(cat.name), parentId });
    await categoryRepo.save(created);
    nameToId.set(cat.name, created.id);
  }
  console.log(`Seeded ${categorySeed.length} categories (nested).`);

  // --- Sample events: mix of already-published and future-scheduled ---
  const sampleEvents = [
    { title: 'Global AI Summit 2026', category: 'AI & ML', daysOffset: -2, time: '10:00' },
    { title: 'Digital Marketing Masterclass', category: 'Digital Marketing', daysOffset: -1, time: '14:00' },
    { title: 'Finance & Investment Expo', category: 'Investment', daysOffset: 3, time: '09:30' },
    { title: 'UX Design Workshop', category: 'UI/UX', daysOffset: 5, time: '11:00' },
    { title: 'Cloud Native Meetup', category: 'Cloud', daysOffset: -5, time: '17:00' },
  ];

  for (const s of sampleEvents) {
    const exists = await eventRepo.findOne({ where: { title: s.title } });
    if (exists) continue;

    const base = new Date();
    base.setDate(base.getDate() + s.daysOffset);
    const dateStr = base.toISOString().slice(0, 10);
    const timezone = 'Asia/Kolkata';
    const publishAt = localToUtc(dateStr, s.time, timezone);

    const event = eventRepo.create({
      title: s.title,
      description: `<p>${s.title} — sample seeded event with full details, speakers and networking sessions.</p>`,
      categoryId: nameToId.get(s.category) || null,
      publishAt,
      sourceTimezone: timezone,
      status: publishAt.getTime() <= Date.now() ? 'published' : 'scheduled',
      createdById: admin.id,
    });
    await eventRepo.save(event);
  }
  console.log(`Seeded ${sampleEvents.length} sample events.`);

  console.log('Seeding complete.');
  await AppDataSource.destroy();
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
