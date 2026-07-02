import { Response } from 'express';
import { AppDataSource } from '../data-source';
import { Category } from '../entities/Category';
import { AuthRequest } from '../middleware/auth.middleware';
import { slugify } from '../utils/slugify';

const categoryRepo = () => AppDataSource.getRepository(Category);

interface TreeNode extends Category {
  children: TreeNode[];
}

function buildTree(flat: Category[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  flat.forEach((c) => map.set(c.id, { ...c, children: [] } as TreeNode));

  const roots: TreeNode[] = [];
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

/** GET /api/categories - returns nested tree */
export async function listCategories(_req: AuthRequest, res: Response) {
  const flat = await categoryRepo().find({ order: { name: 'ASC' } });
  res.json({ data: buildTree(flat) });
}

/** POST /api/categories  body: { name, parentId? } - nested category creation */
export async function createCategory(req: AuthRequest, res: Response) {
  const { name, parentId } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required' });

  if (parentId) {
    const parent = await categoryRepo().findOne({ where: { id: parentId } });
    if (!parent) return res.status(400).json({ message: 'parentId does not reference an existing category' });
  }

  const baseSlug = slugify(name);
  let slug = baseSlug;
  let counter = 1;
  while (await categoryRepo().findOne({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const category = categoryRepo().create({ name, slug, parentId: parentId || null });
  await categoryRepo().save(category);
  res.status(201).json({ message: 'Category created', category });
}

/** DELETE /api/categories/:id — cascades to children via FK onDelete: CASCADE */
export async function deleteCategory(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const category = await categoryRepo().findOne({ where: { id } });
  if (!category) return res.status(404).json({ message: 'Category not found' });

  await categoryRepo().delete({ id });
  res.json({ message: 'Category (and its subcategories) deleted' });
}
