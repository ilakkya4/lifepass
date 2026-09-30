
require('dotenv').config();
const { q, migrate } = require('./db');
const { hashPassword } = require('./auth');

const PRODUCTS = [
  { id:'LP-IPHONE-13-001', name:'iPhone 13 Pro', brand:'Apple', category:'Smartphone', image:'📱', country:'🇺🇸', material:'Aluminum, Glass, Rare Earth Elements', origin:'Cupertino, USA / Assembled in China', manufacture_date:'2021-09-24', carbon_footprint:62.4, water_usage:3800, energy_usage:78, recyclability:82, repairability:45, current_owner:'Aarav Mehta', life_score:78, price_new:119900, warranty_months:24, purchase_date:'2021-10-10' },
  { id:'LP-NIKE-AF1-002', name:'Nike Air Force 1', brand:'Nike', category:'Footwear', image:'👟', country:'🇻🇳', material:'Leather, Rubber, Foam', origin:'Vietnam', manufacture_date:'2023-03-15', carbon_footprint:14.2, water_usage:1200, energy_usage:22, recyclability:55, repairability:60, current_owner:'Priya Sharma', life_score:68, price_new:9695, warranty_months:6, purchase_date:'2023-04-15' },
  { id:'LP-TITAN-WATCH-003', name:'Titan Neo Splash', brand:'Titan', category:'Watch', image:'⌚', country:'🇮🇳', material:'Stainless Steel, Leather Strap', origin:'Hosur, India', manufacture_date:'2023-06-10', carbon_footprint:8.7, water_usage:450, energy_usage:12, recyclability:72, repairability:85, current_owner:'Rohan Kapoor', life_score:84, price_new:5495, warranty_months:24, purchase_date:'2023-07-02' },
  { id:'LP-MACBOOK-M2-004', name:'MacBook Air M2', brand:'Apple', category:'Laptop', image:'💻', country:'🇻🇳', material:'Recycled Aluminum, Lithium', origin:'Assembled in Vietnam', manufacture_date:'2022-07-15', carbon_footprint:158, water_usage:8900, energy_usage:210, recyclability:88, repairability:40, current_owner:'Sneha Iyer', life_score:82, price_new:114900, warranty_months:12, purchase_date:'2022-08-05' },
  { id:'LP-DENIM-LVC-005', name:"Levi's 501 Original", brand:"Levi's", category:'Apparel', image:'👖', country:'🇧🇩', material:'100% Cotton Denim', origin:'Bangladesh', manufacture_date:'2022-11-01', carbon_footprint:33.4, water_usage:7600, energy_usage:55, recyclability:70, repairability:75, current_owner:'Karthik Raman', life_score:71, price_new:3999, warranty_months:12, purchase_date:'2022-12-01' },
  { id:'LP-TATA-EV-006', name:'Tata Nexon EV Battery', brand:'Tata Motors', category:'EV Battery', image:'🔋', country:'🇮🇳', material:'Lithium-Ion, Cobalt, Nickel', origin:'Pune, India', manufacture_date:'2023-01-20', carbon_footprint:1250, water_usage:22000, energy_usage:480, recyclability:65, repairability:55, current_owner:'Fleet Owner — BluSmart', life_score:74, price_new:180000, warranty_months:96, purchase_date:'2023-02-10' }
];

const EVENTS = [
  ['LP-IPHONE-13-001','Manufactured','Foxconn','Zhengzhou, China','Assembled from 47 components','2021-09-24 08:00'],
  ['LP-IPHONE-13-001','Quality Check','Apple QC','Shenzhen, China','Passed A-grade inspection','2021-09-27 14:30'],
  ['LP-IPHONE-13-001','Shipped','DHL','Shanghai → Mumbai','Carbon offset applied','2021-10-02 06:15'],
  ['LP-IPHONE-13-001','Purchased','Apple Store','Mumbai, India','First owner: Aarav Mehta','2021-10-10 11:45'],
  ['LP-IPHONE-13-001','Repair','iFixit Partner','Mumbai, India','Battery replaced','2024-03-12 16:20'],
  ['LP-NIKE-AF1-002','Manufactured','Nike Factory','Ho Chi Minh, Vietnam','LWG certified leather','2023-03-15 09:00'],
  ['LP-NIKE-AF1-002','Shipped','Maersk','Vietnam → Delhi','Sea freight','2023-03-28 12:00'],
  ['LP-NIKE-AF1-002','Purchased','Nike Store','Delhi, India','First owner: Priya Sharma','2023-04-15 15:30'],
  ['LP-TITAN-WATCH-003','Manufactured','Titan Factory','Hosur, India','Made in India','2023-06-10 10:00'],
  ['LP-TITAN-WATCH-003','Purchased','Titan World','Coimbatore, India','First owner: Rohan Kapoor','2023-07-02 14:00'],
  ['LP-MACBOOK-M2-004','Manufactured','Apple','Hanoi, Vietnam','80% recycled aluminum','2022-07-15 07:00'],
  ['LP-MACBOOK-M2-004','Purchased','Apple Store','Bangalore, India','First owner: Sneha Iyer','2022-08-05 13:00'],
  ['LP-DENIM-LVC-005','Manufactured',"Levi's Factory",'Dhaka, Bangladesh','Water<Less finishing','2022-11-01 08:00'],
  ['LP-DENIM-LVC-005','Purchased',"Levi's Store",'Mumbai, India','First owner: Karthik Raman','2022-12-01 17:00'],
  ['LP-TATA-EV-006','Manufactured','Tata Motors','Pune, India','LFP chemistry, 3000+ cycles','2023-01-20 09:00'],
  ['LP-TATA-EV-006','Deployed','BluSmart','Delhi NCR','Fleet of 12 vehicles','2023-02-10 08:00'],
  ['LP-TATA-EV-006','Health Check','Tata Service','Gurugram','Battery health 94%','2024-08-15 15:00']
];

const SHOPS = [
  ['iFixit Partner Mumbai','Smartphone','Bandra, Mumbai',4.8,342,2500,'2 days',true],
  ['MacRepair Pro','Laptop','Koramangala, Bangalore',4.6,189,4500,'3 days',true],
  ['Shoe Clinic Delhi','Footwear','Hauz Khas, Delhi',4.9,512,800,'1 day',true],
  ['Titan Care Coimbatore','Watch','RS Puram, Coimbatore',4.7,128,600,'Same day',true],
  ['Denim Doctors','Apparel','Dharavi, Mumbai',4.5,267,350,'1 day',false],
  ['EV Battery Reborn','EV Battery','Pune',4.8,94,18000,'5 days',true]
];

async function seed() {
  console.log('🌱 Seeding database...');
  await migrate();

  const passHash = await hashPassword('demo1234');
  await q(`DELETE FROM users WHERE email = $1`, ['demo@lifepass.in']);
  const u = await q(`INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id`,
    ['demo@lifepass.in', passHash, 'Demo User']);
  const userId = u.rows[0].id;
  console.log(`✅ Demo user: demo@lifepass.in / demo1234`);

  await q(`DELETE FROM products WHERE user_id = $1`, [userId]);
  for (const p of PRODUCTS) {
    await q(`INSERT INTO products (id, user_id, name, brand, category, image, country, material, origin,
      manufacture_date, carbon_footprint, water_usage, energy_usage, recyclability, repairability,
      current_owner, life_score, price_new, warranty_months, purchase_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [p.id, userId, p.name, p.brand, p.category, p.image, p.country, p.material, p.origin,
       p.manufacture_date, p.carbon_footprint, p.water_usage, p.energy_usage, p.recyclability,
       p.repairability, p.current_owner, p.life_score, p.price_new, p.warranty_months, p.purchase_date]);
  }
  console.log(`✅ ${PRODUCTS.length} products`);

  await q(`DELETE FROM chain_events WHERE product_id = ANY($1)`, [PRODUCTS.map(p => p.id)]);
  for (const e of EVENTS) {
    await q(`INSERT INTO chain_events (product_id, event_type, actor, location, notes, timestamp)
             VALUES ($1,$2,$3,$4,$5,$6)`, e);
  }
  console.log(`✅ ${EVENTS.length} chain events`);

  await q(`DELETE FROM future_scenarios WHERE product_id = ANY($1)`, [PRODUCTS.map(p => p.id)]);
  await q(`DELETE FROM decisions WHERE product_id = ANY($1)`, [PRODUCTS.map(p => p.id)]);
  for (const p of PRODUCTS) {
    await q(`INSERT INTO future_scenarios (product_id, scenario_name, years_ahead, health_score, resale_value, carbon_saved, recommendation) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [p.id, 'Do Nothing', 3, Math.max(20, p.life_score - 25), Math.round(p.price_new * 0.15), 0, 'Will degrade.']);
    await q(`INSERT INTO future_scenarios (product_id, scenario_name, years_ahead, health_score, resale_value, carbon_saved, recommendation) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [p.id, 'Repair & Maintain', 3, Math.min(100, p.life_score + 10), Math.round(p.price_new * 0.45), +(p.carbon_footprint * 0.6).toFixed(1), 'Best balance.']);
    await q(`INSERT INTO future_scenarios (product_id, scenario_name, years_ahead, health_score, resale_value, carbon_saved, recommendation) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [p.id, 'Resell / Rehome', 3, Math.min(100, p.life_score + 5), Math.round(p.price_new * 0.35), +(p.carbon_footprint * 0.8).toFixed(1), 'Second owner.']);
    await q(`INSERT INTO future_scenarios (product_id, scenario_name, years_ahead, health_score, resale_value, carbon_saved, recommendation) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [p.id, 'Recycle', 3, 0, Math.round(p.price_new * 0.05), +(p.carbon_footprint * 0.9).toFixed(1), 'Max recovery.']);

    await q(`INSERT INTO decisions (product_id, option_name, cost, carbon, lifespan_years, satisfaction, score) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [p.id, 'Repair locally', Math.round(p.price_new * 0.02), 8, 3, 8, 82]);
    await q(`INSERT INTO decisions (product_id, option_name, cost, carbon, lifespan_years, satisfaction, score) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [p.id, 'Buy new replacement', p.price_new, Math.round(p.carbon_footprint * 1.1), 5, 9, 45]);
    await q(`INSERT INTO decisions (product_id, option_name, cost, carbon, lifespan_years, satisfaction, score) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [p.id, 'Resell & buy refurbished', Math.round(p.price_new * 0.15), 20, 4, 8, 78]);
    await q(`INSERT INTO decisions (product_id, option_name, cost, carbon, lifespan_years, satisfaction, score) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [p.id, 'Recycle', 0, 3, 0, 6, 88]);
  }
  console.log('✅ Scenarios + decisions');

  await q(`DELETE FROM repair_shops`);
  for (const s of SHOPS) {
    await q(`INSERT INTO repair_shops (name, category, location, rating, reviews, price, eta, certified) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, s);
  }
  console.log(`✅ ${SHOPS.length} shops`);

  console.log('\n🎉 Seed complete!\n');
  console.log('📧 Login: demo@lifepass.in');
  console.log('🔑 Password: demo1234\n');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
