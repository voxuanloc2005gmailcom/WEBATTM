import { authRouter } from './auth.js';
import { adminRouter } from './admin.js';
import { shopRouter } from './shop.js';
import { paymentRouter } from './payment.js';
import { techbotRouter } from './techbot.js';
import { Router } from 'express';
import { pingDatabase, query } from '../db/pool.js';
import { escapeLikePattern, parsePositiveId, parseProductsQuery } from '../utils/validation.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use(paymentRouter);
apiRouter.use(techbotRouter);
// shopRouter internally scopes authentication to /cart, /checkout, and /orders.
apiRouter.use(shopRouter);
// shopRouter itself owns /cart, /checkout, and /orders routes and applies requireAuth.

apiRouter.get('/health', async (_req, res, next) => {
  try {
    await pingDatabase();
    res.status(200).json({
      success: true,
      service: 'techgear-api',
      database: 'ok'
    });
  } catch (error) {
    error.statusCode = 503;
    error.code = 'DATABASE_UNAVAILABLE';
    next(error);
  }
});

apiRouter.get('/categories', async (_req, res, next) => {
  try {
    const result = await query(`
      SELECT
        c.id,
        c.slug,
        c.name,
        c.description,
        COUNT(p.id)::int AS product_count
      FROM categories c
      LEFT JOIN products p
        ON p.category_id = c.id
       AND p.status = 'active'
      WHERE c.status = 'active'
      GROUP BY c.id
      ORDER BY c.name ASC, c.id ASC;
    `);

    res.json({
      success: true,
      data: result.rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        productCount: row.product_count
      }))
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/products', async (req, res, next) => {
  try {
    const { page, pageSize, offset, search, category, minPrice, maxPrice, orderBy } = parseProductsQuery(req.query);
    const params = [];
    const filters = ["p.status = 'active'", "c.status = 'active'"];

    if (search !== undefined) {
      params.push(`%${escapeLikePattern(search)}%`);
      filters.push(`(p.name ILIKE $${params.length} ESCAPE '\\' OR p.sku ILIKE $${params.length} ESCAPE '\\' OR p.brand ILIKE $${params.length} ESCAPE '\\')`);
    }

    if (category !== undefined) {
      params.push(category);
      filters.push(`c.slug = $${params.length}`);
    }

    if (minPrice !== undefined) {
      params.push(minPrice);
      filters.push(`p.price >= $${params.length}`);
    }

    if (maxPrice !== undefined) {
      params.push(maxPrice);
      filters.push(`p.price <= $${params.length}`);
    }

    params.push(pageSize, offset);
    const limitPosition = params.length - 1;
    const offsetPosition = params.length;

    const result = await query(`
      SELECT
        p.id,
        p.sku,
        p.name,
        p.slug,
        p.brand,
        p.description,
        p.price,
        p.stock_quantity,
        p.status,
        c.id AS category_id,
        c.slug AS category_slug,
        c.name AS category_name,
        pi.image_url,
        pi.alt_text,
        COUNT(*) OVER() AS total_count
      FROM products p
      INNER JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_images pi
        ON pi.product_id = p.id
       AND pi.is_primary = TRUE
      WHERE ${filters.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT $${limitPosition}
      OFFSET $${offsetPosition};
    `, params);

    const totalItems = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;

    res.json({
      success: true,
      data: result.rows.map(mapProductSummary),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize)
      }
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/products/:id', async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    const result = await query(`
      SELECT
        p.id,
        p.sku,
        p.name,
        p.slug,
        p.brand,
        p.description,
        p.price,
        p.stock_quantity,
        p.status,
        p.created_at,
        p.updated_at,
        c.id AS category_id,
        c.slug AS category_slug,
        c.name AS category_name
      FROM products p
      INNER JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1
        AND p.status = 'active'
        AND c.status = 'active';
    `, [id]);

    if (result.rowCount === 0) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      error.code = 'PRODUCT_NOT_FOUND';
      throw error;
    }

    const imageResult = await query(`
      SELECT id, image_url, alt_text, sort_order, is_primary
      FROM product_images
      WHERE product_id = $1
      ORDER BY is_primary DESC, sort_order ASC, id ASC;
    `, [id]);

    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        ...mapProductDetail(row),
        images: imageResult.rows.map((image) => ({
          id: image.id,
          imageUrl: image.image_url,
          altText: image.alt_text,
          sortOrder: image.sort_order,
          isPrimary: image.is_primary
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

function mapProductSummary(row) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    description: row.description,
    price: Number(row.price),
    stockQuantity: row.stock_quantity,
    status: row.status,
    category: {
      id: row.category_id,
      slug: row.category_slug,
      name: row.category_name
    },
    primaryImage: row.image_url ? {
      imageUrl: row.image_url,
      altText: row.alt_text
    } : null
  };
}

function mapProductDetail(row) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    description: row.description,
    price: Number(row.price),
    stockQuantity: row.stock_quantity,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    category: {
      id: row.category_id,
      slug: row.category_slug,
      name: row.category_name
    }
  };
}
