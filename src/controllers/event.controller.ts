import { Response } from 'express';
import { AppDataSource } from '../data-source';
import { Event } from '../entities/Event';
import { EventMedia } from '../entities/EventMedia';
import { AuthRequest } from '../middleware/auth.middleware';
import { localToUtc, utcToLocal, isPublished, isValidTimezone } from '../utils/timezone';

const eventRepo = () => AppDataSource.getRepository(Event);
const mediaRepo = () => AppDataSource.getRepository(EventMedia);

/**
 * POST /api/events
 * multipart/form-data: title, description, categoryId, publishDate (YYYY-MM-DD),
 * publishTime (HH:mm), timezone (IANA string), photos[] (files)
 * Event stays invisible to public listing until publishAt (converted to UTC) has passed.
 */
export async function createEvent(req: AuthRequest, res: Response) {
  const { title, description, categoryId, publishDate, publishTime, timezone } = req.body;

  if (!title || !description || !publishDate || !publishTime || !timezone) {
    return res.status(400).json({
      message: 'title, description, publishDate, publishTime and timezone are required',
    });
  }
  if (!isValidTimezone(timezone)) {
    return res.status(400).json({ message: `Invalid IANA timezone: ${timezone}` });
  }

  let publishAtUtc: Date;
  try {
    publishAtUtc = localToUtc(publishDate, publishTime, timezone);
  } catch (err: any) {
    return res.status(400).json({ message: err.message });
  }

  const event = eventRepo().create({
    title,
    description,
    categoryId: categoryId || null,
    publishAt: publishAtUtc,
    sourceTimezone: timezone,
    status: isPublished(publishAtUtc) ? 'published' : 'scheduled',
    createdById: req.user!.userId,
  });
  await eventRepo().save(event);

  const files = (req.files as Express.Multer.File[]) || [];
  if (files.length) {
    const mediaEntities = files.map((file, idx) =>
      mediaRepo().create({
        eventId: event.id,
        url: `/uploads/${file.filename}`,
        order: idx,
      }),
    );
    await mediaRepo().save(mediaEntities);
  }

  const saved = await eventRepo().findOne({ where: { id: event.id }, relations: ['media', 'category'] });
  res.status(201).json({ message: 'Event created', event: saved });
}

/**
 * DELETE /api/events/:id
 * body: { permanent?: boolean }  -- soft delete by default (isDeleted=true), hard delete if permanent=true
 */
export async function deleteEvent(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const permanent = req.body?.permanent === true || req.query?.permanent === 'true';

  const event = await eventRepo().findOne({ where: { id } });
  if (!event) return res.status(404).json({ message: 'Event not found' });

  if (permanent) {
    await eventRepo().delete({ id });
    return res.json({ message: 'Event permanently deleted' });
  }

  event.isDeleted = true;
  event.status = 'deleted';
  event.deletedAt = new Date();
  await eventRepo().save(event);
  res.json({ message: 'Event moved to trash (soft deleted)', event });
}

/**
 * GET /api/events
 * Public listing: only PUBLISHED, non-deleted events. Times are converted to the
 * requester's timezone, taken from `X-Timezone` header or `?timezone=` query param.
 */
export async function listEvents(req: AuthRequest, res: Response) {
  const requesterTz = (req.headers['x-timezone'] as string) || (req.query.timezone as string) || 'UTC';
  const zone = isValidTimezone(requesterTz) ? requesterTz : 'UTC';

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const categoryId = req.query.categoryId as string | undefined;

  const qb = eventRepo()
    .createQueryBuilder('event')
    .leftJoinAndSelect('event.media', 'media')
    .leftJoinAndSelect('event.category', 'category')
    .where('event.isDeleted = false')
    .andWhere('event.publishAt <= :now', { now: new Date() }) // only published (time-based)
    .orderBy('event.publishAt', 'DESC')
    .skip((page - 1) * limit)
    .take(limit);

  if (categoryId) qb.andWhere('event.categoryId = :categoryId', { categoryId });

  const [events, total] = await qb.getManyAndCount();

  const shaped = events.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    category: e.category,
    media: e.media,
    publish: utcToLocal(e.publishAt, zone),
    status: e.status,
  }));

  res.json({ data: shaped, page, limit, total, timezone: zone });
}

export async function getEvent(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const requesterTz = (req.headers['x-timezone'] as string) || 'UTC';
  const zone = isValidTimezone(requesterTz) ? requesterTz : 'UTC';

  const event = await eventRepo().findOne({
    where: { id, isDeleted: false },
    relations: ['media', 'category'],
  });
  if (!event) return res.status(404).json({ message: 'Event not found' });

  res.json({
    ...event,
    publish: utcToLocal(event.publishAt, zone),
  });
}
