import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const frontend = path.join(root, 'frontend', 'public');
const viewsPath = path.join(frontend, 'js', 'views.js');
const appPath = path.join(frontend, 'app.js');
const cssPath = path.join(frontend, 'styles.css');
const seedPath = path.join(root, 'database', 'seed', '001_seed.sql');

const fail = (msg) => { throw new Error(`FAIL: ${msg}`); };
const pass = (msg) => console.log(`PASS: ${msg}`);
const read = (p) => fs.readFileSync(p, 'utf8');

for (const [name, p] of [['views.js', viewsPath], ['app.js', appPath], ['styles.css', cssPath], ['seed', seedPath]]) {
  if (!fs.existsSync(p)) fail(`${name} missing`);
}

// JS syntax validation without executing application code.
for (const p of [appPath, viewsPath, path.join(frontend,'js','api.js'), path.join(frontend,'js','utils.js'), path.join(frontend,'js','icons.js'), path.join(root,'frontend','server.js')]) {
  try { execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' }); }
  catch (e) { fail(`JavaScript syntax invalid: ${path.relative(root,p)} — ${String(e.stderr || e.message).trim()}`); }
}
pass('frontend JavaScript syntax is valid');

const views = read(viewsPath);
const app = read(appPath);
const css = read(cssPath);
const seed = read(seedPath);

const viewActions = [...new Set([...views.matchAll(/data-action="([^"]+)"/g)].map(m => m[1]))].sort();
const handlers = new Set([...app.matchAll(/action === '([^']+)'/g)].map(m=>m[1]));
handlers.add('sort'); // handled by the change listener
for (const action of viewActions) if (!handlers.has(action)) fail(`no frontend handler for data-action=${action}`);
pass(`all ${viewActions.length} rendered data-actions have handlers`);

const requiredClasses = [...new Set([...views.matchAll(/class="([^"]+)"/g)].filter(m => !m[1].includes('${')).flatMap(m => m[1].split(/\s+/)).filter(x => /^[A-Za-z][A-Za-z0-9_-]*$/.test(x)))];
for (const cls of requiredClasses) {
  if (!css.includes(`.${cls}`)) fail(`view class has no CSS selector: .${cls}`);
}
pass(`all ${requiredClasses.length} static view class tokens have CSS`);

const requiredSlugs = [...seed.matchAll(/'([a-z0-9]+(?:-[a-z0-9]+)+)',\s*'[^']+',\s*'[^']+',\s*([0-9]+)/g)].map(m=>m[1]);
const mapSection = views.match(/const PRODUCT_IMAGE_URLS = \{([\s\S]*?)\n\};/);
if (!mapSection) fail('PRODUCT_IMAGE_URLS mapping missing');
const mappedSlugs = [...mapSection[1].matchAll(/'([^']+)':\s*'https:\/\//g)].map(m=>m[1]);
const missingImages = requiredSlugs.filter(s => !mappedSlugs.includes(s));
if (missingImages.length) fail(`missing real image mapping for: ${missingImages.join(', ')}`);
if (mappedSlugs.length < 12) fail(`expected 12 real product image URLs, found ${mappedSlugs.length}`);
pass(`real product photography mapped for all ${requiredSlugs.length} seeded products`);

for (const forbidden of ['CELLPHONES', '#d70018', '#c50015', '???', 'support@techgear.local', 'checked_out']) {
  if (views.includes(forbidden) || css.includes(forbidden) || app.includes(forbidden)) fail(`forbidden frontend residue found: ${forbidden}`);
}
pass('no legacy/placeholder frontend residue found');

if (views.includes('09xx xxx xxx')) fail('fake phone placeholder remains');
pass('user-facing phone placeholder is neutral');

const rendered = {};
const mod = await import(pathToFileURL(viewsPath));
const state={user:{fullName:'Nguyen Van A',email:'a@example.com',role:'customer'},session:{},categories:[{slug:'keyboard',name:'Bàn phím',productCount:3},{slug:'mouse',name:'Chuột',productCount:3}],cart:{id:1,status:'active',items:[{id:1,quantity:1,product:{id:1,slug:'keychron-k2-v2',name:'Keychron K2 V2',brand:'Keychron',sku:'KB-001',price:1890000,stockQuantity:10,category:{slug:'keyboard',name:'Bàn phím'}},lineTotal:1890000}],subtotal:1890000},navOpen:false,authModal:null,quickView:null,confirm:null,tb:{messages:[],open:false,busy:false,pending:false}};
const product=state.cart.items[0].product;
rendered.home=mod.homeView(state,{newest:[product],cheapest:[product],premium:[product]});
rendered.products=mod.productsView(state,{page:1,sort:'newest'},{data:[product],pagination:{page:1,pageSize:12,totalItems:1,totalPages:1}});
rendered.detail=mod.productDetailView(product,[]);
rendered.cart=mod.cartView(state);
rendered.checkout=mod.checkoutView(state);
const testOrder={id:7,orderNumber:'TG-1',status:'payment_pending',recipientName:'A',grandTotal:1890000,subtotal:1890000,shippingFee:0,discountTotal:0,currency:'VND',createdAt:new Date().toISOString(),items:[{id:1,productId:1,productName:'Keychron K2 V2',sku:'KB-001',unitPrice:1890000,quantity:1,lineTotal:1890000}],recipient:{name:'A',phone:'0900000000',shippingAddress:'1 Duong A'},payment:{provider:'vnpay',status:'pending',amount:1890000,currency:'VND'}};
rendered.orders=mod.ordersView(state,[testOrder]);
rendered.orderDetail=mod.orderDetailView(testOrder,'');
rendered.techbot=mod.techbotView(state.tb);
const all=Object.values(rendered).join('\n');
if ((all.match(/data-product-image/g)||[]).length < 7) fail('rendered UI does not emit product photo elements');
if (!rendered.cart.includes('data-action="cart-step"') || !rendered.cart.includes('data-action="cart-set"')) fail('cart quantity controls not rendered');
if (!rendered.detail.includes('data-action="buy-now"')) fail('Buy Now control not rendered');
if (!rendered.orderDetail.includes('data-action="pay-vnpay"') || !rendered.orderDetail.includes('data-order=')) fail('order payment control/data attribute mismatch');
if (!rendered.techbot.includes('data-action="techbot-ask"') || !rendered.techbot.includes('data-action="techbot-clear"')) fail('TechBot controls not rendered');
pass('critical view rendering checks passed');

console.log('PASS: frontend static verification complete');
