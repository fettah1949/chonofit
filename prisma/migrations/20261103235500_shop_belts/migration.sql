INSERT INTO "ShopProduct" ("id", "name", "price", "stock", "createdAt", "updatedAt")
SELECT 'shop-ceinture-blanche', 'Ceinture blanche', 40, 10, '2026-11-03 23:55:01', '2026-11-03 23:55:01'
WHERE NOT EXISTS (SELECT 1 FROM "ShopProduct" WHERE "name" = 'Ceinture blanche');

INSERT INTO "ShopProduct" ("id", "name", "price", "stock", "createdAt", "updatedAt")
SELECT 'shop-ceinture-jaune', 'Ceinture jaune', 40, 6, '2026-11-03 23:55:02', '2026-11-03 23:55:02'
WHERE NOT EXISTS (SELECT 1 FROM "ShopProduct" WHERE "name" = 'Ceinture jaune');

INSERT INTO "ShopProduct" ("id", "name", "price", "stock", "createdAt", "updatedAt")
SELECT 'shop-ceinture-orange', 'Ceinture orange', 40, 4, '2026-11-03 23:55:03', '2026-11-03 23:55:03'
WHERE NOT EXISTS (SELECT 1 FROM "ShopProduct" WHERE "name" = 'Ceinture orange');

INSERT INTO "ShopProduct" ("id", "name", "price", "stock", "createdAt", "updatedAt")
SELECT 'shop-ceinture-verte', 'Ceinture verte', 40, 4, '2026-11-03 23:55:04', '2026-11-03 23:55:04'
WHERE NOT EXISTS (SELECT 1 FROM "ShopProduct" WHERE "name" = 'Ceinture verte');

INSERT INTO "ShopProduct" ("id", "name", "price", "stock", "createdAt", "updatedAt")
SELECT 'shop-ceinture-bleue', 'Ceinture bleue', 40, 2, '2026-11-03 23:55:05', '2026-11-03 23:55:05'
WHERE NOT EXISTS (SELECT 1 FROM "ShopProduct" WHERE "name" = 'Ceinture bleue');

INSERT INTO "ShopProduct" ("id", "name", "price", "stock", "createdAt", "updatedAt")
SELECT 'shop-ceinture-marron', 'Ceinture marron', 40, 2, '2026-11-03 23:55:06', '2026-11-03 23:55:06'
WHERE NOT EXISTS (SELECT 1 FROM "ShopProduct" WHERE "name" = 'Ceinture marron');
