import { Response } from 'express';
import { AppDataSource } from '../data-source';
import { Event } from '../entities/Event';
import { AuthRequest } from '../middleware/auth.middleware';
import { utcToLocal, isValidTimezone } from '../utils/timezone';

const eventRepo = () => AppDataSource.getRepository(Event);

/**
 * GET /api/admin/events?filter=published|not_published&page=&limit=
 * Admin view: all events (including drafts/deleted unless excluded), with user + media info.
 * "Published" here is determined purely by whether publishAt has passed (UTC comparison),
 * NOT by the stored `status` column alone, per the task's note.
 */
export async function adminListEvents(req: AuthRequest, res: Response) {
  const filter = req.query.filter as 'published' | 'not_published' | undefined;
  const includeDeleted = req.query.includeDeleted === 'true';
  const adminTz = (req.headers['x-timezone'] as string) || 'UTC';
  const zone = isValidTimezone(adminTz) ? adminTz : 'UTC';

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 20, 100);

  const qb = eventRepo()
    .createQueryBuilder('event')
    .leftJoinAndSelect('event.media', 'media')
    .leftJoinAndSelect('event.category', 'category')
    .leftJoinAndSelect('event.createdBy', 'createdBy')
    .orderBy('event.publishAt', 'DESC')
    .skip((page - 1) * limit)
    .take(limit);

  if (!includeDeleted) qb.andWhere('event.isDeleted = false');

  const now = new Date();
  if (filter === 'published') qb.andWhere('event.publishAt <= :now', { now });
  if (filter === 'not_published') qb.andWhere('event.publishAt > :now', { now });

  const [events, total] = await qb.getManyAndCount();

  const shaped = events.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    category: e.category,
    media: e.media,
    isDeleted: e.isDeleted,
    publish: utcToLocal(e.publishAt, zone),
    publishedNow: e.publishAt.getTime() <= now.getTime(),
    createdBy: e.createdBy
      ? { id: e.createdBy.id, name: e.createdBy.name, email: e.createdBy.email, role: e.createdBy.role }
      : null,
    createdAt: e.createdAt,
  }));

  res.json({ data: shaped, page, limit, total, timezone: zone });
}
