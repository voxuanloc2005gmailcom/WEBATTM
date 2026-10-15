-- TechGear Store Phase 1 seed data.
-- Execute as techgear_owner after 001_initial_schema.sql.

BEGIN;

INSERT INTO categories (slug, name, description, status)
VALUES
    ('keyboard', 'Bàn phím', 'Bàn phím cơ, văn phòng và gaming cho nhiều nhu cầu sử dụng.', 'active'),
    ('mouse', 'Chuột', 'Chuột gaming và chuột văn phòng với nhiều mức giá.', 'active'),
    ('component', 'Linh kiện PC', 'CPU, RAM, SSD, nguồn và các linh kiện nâng cấp PC.', 'active'),
    ('monitor', 'Màn hình', 'Màn hình văn phòng, gaming và sáng tạo nội dung.', 'active')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    status = EXCLUDED.status;

INSERT INTO products (category_id, sku, name, slug, brand, description, price, stock_quantity, status)
SELECT c.id, v.sku, v.name, v.slug, v.brand, v.description, v.price, v.stock_quantity, 'active'
FROM (VALUES
    ('keyboard', 'KB-001', 'Keychron K2 V2', 'keychron-k2-v2', 'Keychron', 'Bàn phím cơ 75%, kết nối đa thiết bị, phù hợp làm việc và lập trình.', 1890000, 25),
    ('keyboard', 'KB-002', 'Akko 5075B Plus', 'akko-5075b-plus', 'Akko', 'Bàn phím cơ 75% hot-swap, hỗ trợ kết nối không dây.', 2190000, 18),
    ('keyboard', 'KB-003', 'Logitech MX Keys S', 'logitech-mx-keys-s', 'Logitech', 'Bàn phím low-profile cho văn phòng và năng suất cao.', 2490000, 16),
    ('mouse', 'MS-001', 'Logitech G Pro X Superlight 2', 'logitech-g-pro-x-superlight-2', 'Logitech', 'Chuột gaming không dây nhẹ, cảm biến hiệu năng cao.', 3590000, 12),
    ('mouse', 'MS-002', 'Razer DeathAdder V3', 'razer-deathadder-v3', 'Razer', 'Chuột công thái học nhẹ cho gaming FPS.', 1990000, 20),
    ('mouse', 'MS-003', 'Logitech MX Master 3S', 'logitech-mx-master-3s', 'Logitech', 'Chuột năng suất đa thiết bị cho văn phòng và lập trình.', 2690000, 14),
    ('component', 'CPU-001', 'AMD Ryzen 7 7700', 'amd-ryzen-7-7700', 'AMD', 'CPU 8 nhân 16 luồng dành cho gaming và công việc đa nhiệm.', 7590000, 10),
    ('component', 'RAM-001', 'Corsair Vengeance 32GB DDR5', 'corsair-vengeance-32gb-ddr5', 'Corsair', 'Kit RAM DDR5 32GB cho nền tảng desktop hiện đại.', 2790000, 22),
    ('component', 'SSD-001', 'Samsung 990 EVO 1TB', 'samsung-990-evo-1tb', 'Samsung', 'SSD NVMe 1TB cho hệ điều hành, phần mềm và game.', 2190000, 30),
    ('component', 'PSU-001', 'Corsair RM750e', 'corsair-rm750e', 'Corsair', 'Nguồn 750W chuẩn hiệu suất cao, phù hợp PC gaming.', 2890000, 11),
    ('monitor', 'MN-001', 'Dell G2724D', 'dell-g2724d', 'Dell', 'Màn hình 27 inch QHD 165Hz cho gaming và học tập.', 6790000, 8),
    ('monitor', 'MN-002', 'LG 27GP850-B', 'lg-27gp850-b', 'LG', 'Màn hình 27 inch QHD tần số quét cao, phù hợp gaming.', 7490000, 7)
) AS v(category_slug, sku, name, slug, brand, description, price, stock_quantity)
JOIN categories c ON c.slug = v.category_slug
ON CONFLICT (sku) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    brand = EXCLUDED.brand,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    stock_quantity = EXCLUDED.stock_quantity,
    category_id = EXCLUDED.category_id,
    status = 'active';

INSERT INTO product_images (product_id, image_url, alt_text, sort_order, is_primary)
SELECT p.id,
       '/assets/products/' || p.slug || '.webp',
       p.name,
       0,
       TRUE
FROM products p
WHERE p.sku IN ('KB-001','KB-002','KB-003','MS-001','MS-002','MS-003','CPU-001','RAM-001','SSD-001','PSU-001','MN-001','MN-002')
  AND NOT EXISTS (
      SELECT 1 FROM product_images pi
      WHERE pi.product_id = p.id AND pi.is_primary = TRUE
  );

COMMIT;
