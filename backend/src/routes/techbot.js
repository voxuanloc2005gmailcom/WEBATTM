import { Router } from 'express';
import { query } from '../db/pool.js';
import {
  assertSafePrompt,
  buildFallbackReply,
  buildSystemPrompt,
  normalizeTechbotQuestion,
  sanitizeModelReply
} from '../utils/techbot.js';

export const techbotRouter = Router();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;
const buckets = new Map();

function clientKey(req) {
  const userId = req.auth?.userId;
  if (userId) return `user:${userId}`;
  const forwarded = String(req.headers['x-real-ip'] || '').trim();
  return `ip:${forwarded || req.ip || 'unknown'}`;
}

function enforceRateLimit(req) {
  const key = clientKey(req);
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    return;
  }
  if (current.count >= MAX_REQUESTS) {
    const error = new Error('TechBot rate limit exceeded. Please try again later.');
    error.statusCode = 429;
    error.code = 'TECHBOT_RATE_LIMITED';
    error.retryAfterSeconds = Math.max(1, Math.ceil((WINDOW_MS - (now - current.startedAt)) / 1000));
    throw error;
  }
  current.count += 1;
}

async function loadCatalogContext(question) {
  const terms = question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((term) => term.length >= 3)
    .slice(0, 5);

  const params = [];
  let filter = '';
  if (terms.length) {
    const clauses = terms.map((term, index) => {
      params.push(`%${term.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
      return `(LOWER(p.name) LIKE $${index + 1} OR LOWER(p.sku) LIKE $${index + 1} OR LOWER(c.name) LIKE $${index + 1})`;
    });
    filter = `AND (${clauses.join(' OR ')})`;
  }

  const result = await query(`
    SELECT p.id, p.sku, p.name, p.price, p.stock_quantity,
           c.name AS category, p.description
    FROM products p
    INNER JOIN categories c ON c.id = p.category_id AND c.status = 'active'
    WHERE p.status = 'active'
      ${filter}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT 12;
  `, params);

  return result.rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    name: row.name,
    price: Number(row.price),
    stockQuantity: row.stock_quantity,
    category: row.category,
    description: row.description
  }));
}

async function callOllama(question, products) {
  const enabled = String(process.env.TECHBOT_ENABLED ?? 'true').toLowerCase() !== 'false';
  const baseUrl = String(process.env.TECHBOT_OLLAMA_URL || '').trim();
  const model = String(process.env.TECHBOT_MODEL || '').trim();
  if (!enabled || !baseUrl || !model) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9_000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          {
            role: 'user',
            content: `Public product catalog context:\n${JSON.stringify(products)}\n\nCustomer question:\n${question}`
          }
        ],
        options: { temperature: 0.2 }
      }),
      signal: controller.signal
    });
    if (!response.ok) return null;
    const body = await response.json();
    return sanitizeModelReply(body?.message?.content);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

techbotRouter.post('/techbot', async (req, res, next) => {
  try {
    enforceRateLimit(req);
    const question = normalizeTechbotQuestion(req.body?.question);
    assertSafePrompt(question);

    const products = await loadCatalogContext(question);
    const modelReply = await callOllama(question, products);
    const reply = modelReply || buildFallbackReply(question, products);
    res.json({
      success: true,
      data: {
        answer: reply,
        engine: modelReply ? 'ollama' : 'safe-catalog-fallback',
        recommendations: products.slice(0, 4).map((product) => ({
          id: product.id,
          name: product.name,
          price: product.price,
          stockQuantity: product.stockQuantity,
          category: product.category
        }))
      }
    });
  } catch (error) {
    if (error.retryAfterSeconds) {
      res.setHeader('Retry-After', String(error.retryAfterSeconds));
    }
    next(error);
  }
});

techbotRouter.get('/techbot/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      enabled: String(process.env.TECHBOT_ENABLED ?? 'true').toLowerCase() !== 'false',
      ollamaConfigured: Boolean(String(process.env.TECHBOT_OLLAMA_URL || '').trim() && String(process.env.TECHBOT_MODEL || '').trim())
    }
  });
});
