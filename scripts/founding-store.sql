INSERT INTO members (email,password_hash,display_name,phone,city,brands,store_slug,account_type,description,created_at)
SELECT 'toyota-parts@autopart.internal','disabled','Toyota Parts','',NULL,'["Toyota","Nissan"]','toyota-parts','platform','قطع غيار تويوتا ونيسان، حسب طلبك',CAST(CURRENT_TIMESTAMP AS TEXT)
WHERE NOT EXISTS (SELECT 1 FROM members WHERE store_slug='toyota-parts') ON CONFLICT (store_slug) DO NOTHING;
INSERT INTO inventory (owner_id,name,name_en,model,years,manufacture_country,description,brand,reference,compatibility,price,quantity,part_type,image_key,legacy_product_id,stock_confirmed,deleted_at,created_at)
SELECT m.id,p.name_ar,p.name_en,p.model,p.years,p.manufacture_country,COALESCE(p.description_ar,p.description_en),p.brand,p.reference,COALESCE(p.compatibility,p.model),p.price,1,COALESCE(p.part_type,'original'),p.image_key,p.id,0,p.deleted_at,p.created_at
FROM products p JOIN members m ON m.store_slug='toyota-parts' AND m.account_type='platform'
WHERE NOT EXISTS (SELECT 1 FROM inventory i WHERE i.legacy_product_id=p.id) ON CONFLICT (legacy_product_id) DO NOTHING;
UPDATE leads SET owner_id=(SELECT id FROM members WHERE store_slug='toyota-parts' AND account_type='platform') WHERE owner_id IS NULL;
INSERT INTO form_settings (id,value)
SELECT 'member:' || CAST(m.id AS TEXT),f.value FROM form_settings f JOIN members m ON m.store_slug='toyota-parts' AND m.account_type='platform'
WHERE f.id='part_request' AND NOT EXISTS (SELECT 1 FROM form_settings s WHERE s.id='member:' || CAST(m.id AS TEXT)) ON CONFLICT (id) DO NOTHING;
