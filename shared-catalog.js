function blankPlaceholder(id, cat){
  const MERCH = ['Accessories','Wearables','Shirts','Caps','Shorts','Socks','ToteBags','Bracelets','Keychains'];
  const accent = cat === 'Tea' ? '#7C9885'
    : cat === 'Cakes' ? '#B98A9A'
    : MERCH.includes(cat) ? '#7C93A6'
    : '#C08552';
  const label = (cat || 'Crafts & Crumbs').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
    <defs>
      <linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#F7F5F1"/>
        <stop offset="1" stop-color="#EFEAE1"/>
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="url(#g${id})"/>
    <rect x="16" y="16" width="368" height="368" fill="none" stroke="${accent}" stroke-width="1.4" stroke-dasharray="7 7" opacity="0.5"/>
    <g transform="translate(160,148)" stroke="${accent}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <rect x="0" y="0" width="80" height="60" rx="6"/>
      <circle cx="18" cy="16" r="7"/>
      <path d="M0 50l22-20 18 15 16-13 24 20"/>
    </g>
    <text x="200" y="252" text-anchor="middle" font-family="Poppins, sans-serif" font-size="11" letter-spacing="3" fill="${accent}" font-weight="600">${label}</text>
    <text x="200" y="272" text-anchor="middle" font-family="Poppins, sans-serif" font-size="9" letter-spacing="1.5" fill="${accent}" font-weight="500" opacity="0.75">PHOTO COMING SOON</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/* Turns whatever's stored in a product's img/imgs field into a src
   that actually resolves, regardless of which page is rendering it.
   Real URLs (Cloudinary https://, or a generated data: placeholder)
   pass through untouched. A bare filename (e.g. "croissant.jpg" —
   left over from before every upload went through Cloudinary, or
   just a local static asset that's never needed to change) is NOT
   broken, but it IS relative — the browser resolves it against the
   current page's own path, so the exact same string correctly
   becomes /croissant.jpg from the customer site's root page but
   wrongly becomes /admin/croissant.jpg from the admin app's nested
   route, 404ing there even though the file exists at the site root.
   Prefixing a leading slash forces it to resolve from the site root
   every time, so both apps show the same image from the same string
   with zero Firestore changes needed.

   IMPORTANT: this is why a "fix broken images" tool should never
   treat a bare filename as broken on its own (see isBrokenImageRef in
   products-services.js) — this function already makes it display
   correctly everywhere; overwriting it in Firestore would be
   destroying a working reference, not fixing a broken one. */
function resolveImageSrc(src){
  if(!src) return '';
  if(src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) return src;
  return '/' + src.replace(/^\/+/, '');
}
window.resolveImageSrc = resolveImageSrc;

/* ================= PRODUCTS / COMBOS STATE =================
   SEED_PRODUCTS is only used to seed Firestore once (via the Admin
   app's "Seed Starter Catalog" button) and as an offline fallback if
   Firestore is unreachable/empty. The live catalog both apps actually
   render from is the mutable PRODUCTS array, populated from Firestore
   at startup by loadProductsFromFirestore() below. */
let PRODUCTS = [];
// Flat delivery fee, admin-configurable (Admin > Settings).
let DELIVERY_FEE = 60;

/* ================= SEED DATA ================= */
const SEED_PRODUCTS = [
  /* ---- Pastries: All-day Bakery ---- */
  { id:'p13', name:'Classic Buttered Croissant', cat:'Pastries', price:120,
    desc:'72-hour laminated dough, baked golden and flaky every morning.',
    img:'croissant.jpg',
    imgs:['croissant.jpg'],
    ingredients:'Flour, cultured butter, yeast, sea salt.',
    allergens:'Gluten (wheat), Milk. May contain traces of egg.' },
  { id:'p14', name:'Sausage and Bacon Flatbread', cat:'Pastries', price:165,
    desc:'Oven-baked flatbread topped with savory sausage, bacon, and melted cheese.',
    img:'flatbread.png',
    imgs:['flatbread.png'],
    ingredients:'Flatbread dough, sausage, bacon, mozzarella, house sauce.',
    allergens:'Gluten (wheat), Milk. May contain traces of soy.' },
  { id:'p15', name:'Dark Chocolate Macadamia Cookie', cat:'Pastries', price:110,
    desc:'Chewy cookie loaded with dark chocolate chunks and roasted macadamia nuts.',
    img:'cookie.jpg',
    imgs:['cookie.jpg'],
    ingredients:'Flour, brown butter, dark chocolate chunks, roasted macadamia nuts.',
    allergens:'Gluten (wheat), Milk, Tree Nuts (macadamia). May contain traces of soy and other nuts.' },
  { id:'p16', name:'Apple Cinnamon Turnover', cat:'Pastries', price:125,
    desc:'Flaky puff pastry folded around warm spiced apple filling, finished with icing.',
    img:'turnover.jpg',
    imgs:['turnover.jpg'],
    ingredients:'Puff pastry, cinnamon spiced apples, vanilla icing drizzle.',
    allergens:'Gluten (wheat), Milk, Egg.' },
  { id:'p17', name:'Classic Cinnamon Roll', cat:'Pastries', price:130,
    desc:'Soft swirled roll layered with cinnamon sugar, topped with sweet glaze.',
    img:'cinnamonroll.jpg',
    imgs:['cinnamonroll.jpg'],
    ingredients:'Flour, butter, brown sugar, cinnamon, sweet glaze.',
    allergens:'Gluten (wheat), Milk, Egg.' },

  /* ---- Sandwiches & Pasta ---- */
  { id:'p18', name:'Beef Shawarma', cat:'Sandwiches', price:0,
    desc:'Warm pita rolled around marinated shaved beef, garlic sauce, and pickled vegetables.',
    img:'beefshawarma.jpeg', imgs:['beefshawarma.jpeg'],
    ingredients:'Pita bread, marinated beef, garlic sauce, pickles, lettuce, tomato.',
    allergens:'Gluten (wheat). May contain traces of milk and sesame.' },
  { id:'p19', name:'Chicken Kofta', cat:'Sandwiches', price:0,
    desc:'Spiced grilled chicken kofta tucked into flatbread with garlic sauce and fresh vegetables.',
    img:'chickenkofta.jpeg', imgs:['chickenkofta.jpeg'],
    ingredients:'Ground chicken, Middle Eastern spice blend, flatbread, garlic sauce, vegetables.',
    allergens:'Gluten (wheat). May contain traces of milk.' },
  { id:'p20', name:'Grilled Cheese on Sourdough Bread', cat:'Sandwiches', price:0,
    desc:'Buttery sourdough grilled until crisp with a melty blend of cheeses.',
    img:'grilledcheese.jpeg', imgs:['grilledcheese.jpeg'],
    ingredients:'Sourdough bread, butter, blended cheeses.',
    allergens:'Gluten (wheat), Milk.' },
  { id:'p21', name:'Classic Lasagna', cat:'Sandwiches', price:0,
    desc:'Layers of pasta, slow-simmered meat sauce, and melted cheese baked until bubbling.',
    img:'lasagna.jpg', imgs:['lasagna.jpg'],
    ingredients:'Lasagna pasta sheets, meat sauce, bechamel, mozzarella, parmesan.',
    allergens:'Gluten (wheat), Milk, Egg.' },
  { id:'p22', name:'Penne Pesto with Mushroom', cat:'Sandwiches', price:0,
    desc:'Penne pasta tossed in basil pesto with sauteed mushrooms and parmesan.',
    img:'pennepesto.jpg', imgs:['pennepesto.jpg'],
    ingredients:'Penne pasta, basil pesto, mushrooms, parmesan, olive oil.',
    allergens:'Gluten (wheat), Milk, Tree Nuts (pine nuts in pesto).' },

  /* ---- Cakes ---- */
  { id:'p23', name:'Triple Chocolate Cake', cat:'Cakes', price:0,
    desc:'Rich chocolate sponge layered with chocolate ganache and chocolate shavings.',
    img:'triplechocolate.jpg', imgs:['triplechocolate.jpg'],
    ingredients:'Flour, cocoa, dark chocolate, chocolate ganache, butter, eggs.',
    allergens:'Gluten (wheat), Milk, Egg.' },
  { id:'p24', name:'Blueberry Cheesecake', cat:'Cakes', price:0,
    desc:'Creamy baked cheesecake topped with a sweet blueberry compote.',
    img:'blueberry.jpg', imgs:['blueberry.jpg'],
    ingredients:'Cream cheese, graham crust, eggs, fresh blueberries, sugar.',
    allergens:'Gluten (wheat), Milk, Egg.' },
  { id:'p25', name:'New York Cheesecake', cat:'Cakes', price:0,
    desc:'Dense and creamy classic cheesecake with a buttery graham crust.',
    img:'newyork.jpg', imgs:['newyork.jpg'],
    ingredients:'Cream cheese, graham crust, eggs, vanilla, sugar.',
    allergens:'Gluten (wheat), Milk, Egg.' },
  { id:'p26', name:'Tiramisu Cake', cat:'Cakes', price:0,
    desc:'Espresso soaked sponge layered with mascarpone cream and cocoa dust.',
    img:'tiramisu.png', imgs:['tiramisu.png'],
    ingredients:'Sponge cake, espresso, mascarpone cream, cocoa powder, eggs.',
    allergens:'Gluten (wheat), Milk, Egg. Contains caffeine.' },
  { id:'p27', name:'Ubelicious Cake', cat:'Cakes', price:0,
    desc:'Soft ube sponge cake filled and topped with sweet ube frosting.',
    img:'ubelicious.png', imgs:['ubelicious.png'],
    ingredients:'Ube (purple yam), flour, butter, eggs, ube frosting.',
    allergens:'Gluten (wheat), Milk, Egg.' },

  /* ---- Drinks: Caffeine ---- */
  { id:'p28', name:'Spanish Latte', cat:'Coffee', price:139,
    desc:'Espresso balanced with steamed milk and sweetened condensed milk.',
    img:'spanish latte.png', imgs:['spanish latte.png'],
    ingredients:'Espresso, steamed milk, condensed milk.',
    allergens:'Milk.',
    sizes:[ { size:'12oz', price:139 }, { size:'16oz', price:159 }, { size:'20oz', price:179 } ] },
  { id:'p29', name:'Iced Americano', cat:'Coffee', price:109,
    desc:'Bold espresso shots poured over ice and cold water for a clean, crisp finish.',
    img:'icedamericano.png', imgs:['icedamericano.png'],
    ingredients:'Espresso, cold water, ice.',
    allergens:'None known.',
    sizes:[ { size:'12oz', price:109 }, { size:'16oz', price:129 }, { size:'20oz', price:149 } ] },
  { id:'p30', name:'White Mocha', cat:'Coffee', price:149,
    desc:'Espresso blended with steamed milk and sweet white chocolate sauce.',
    img:'whitemocha.png', imgs:['whitemocha.png'],
    ingredients:'Espresso, steamed milk, white chocolate sauce.',
    allergens:'Milk.',
    sizes:[ { size:'12oz', price:149 }, { size:'16oz', price:169 }, { size:'20oz', price:189 } ] },
  { id:'p31', name:'Vanilla Sweet Cream', cat:'Coffee', price:139,
    desc:'Espresso topped with a smooth vanilla sweet cream foam.',
    img:'vanillacream.png', imgs:['vanillacream.png'],
    ingredients:'Espresso, milk, vanilla syrup, sweet cream foam.',
    allergens:'Milk.',
    sizes:[ { size:'12oz', price:139 }, { size:'16oz', price:159 }, { size:'20oz', price:179 } ] },
  { id:'p32', name:'Dark Caramel Macchiato', cat:'Coffee', price:149,
    desc:'Espresso layered with steamed milk and finished with dark caramel drizzle.',
    img:'darkcaramelmach.png', imgs:['darkcaramelmach.png'],
    ingredients:'Espresso, steamed milk, vanilla syrup, dark caramel sauce.',
    allergens:'Milk.',
    sizes:[ { size:'12oz', price:149 }, { size:'16oz', price:169 }, { size:'20oz', price:189 } ] },

  /* ---- Drinks: Non-Caffeine ---- */
  { id:'p33', name:'Iced Matcha Latte', cat:'Non-Coffee', price:149,
    desc:'Ceremonial matcha whisked with cold milk and poured over ice.',
    img:'IcedGreenTeaLatte.jpg', imgs:['IcedGreenTeaLatte.jpg'],
    ingredients:'Matcha powder, milk, light syrup, ice.',
    allergens:'Milk.',
    sizes:[ { size:'12oz', price:149 }, { size:'16oz', price:169 }, { size:'20oz', price:189 } ] },
  { id:'p34', name:'Hot Chocolate', cat:'Non-Coffee', price:119,
    desc:'Rich cocoa steamed with milk for a warm, comforting classic.',
    img:'hot-chocolate.jpeg', imgs:['hot-chocolate.jpeg'],
    ingredients:'Cocoa, milk, sugar.',
    allergens:'Milk.',
    sizes:[ { size:'12oz', price:119 }, { size:'16oz', price:139 }, { size:'20oz', price:159 } ] },
  { id:'p35', name:'Chai Tea Cream', cat:'Non-Coffee', price:129,
    desc:'Spiced chai tea blended with steamed milk and a light layer of cream.',
    img:'chaiteacream.png', imgs:['chaiteacream.png'],
    ingredients:'Chai tea concentrate, milk, warm spices, cream.',
    allergens:'Milk.',
    sizes:[ { size:'12oz', price:129 }, { size:'16oz', price:149 }, { size:'20oz', price:169 } ] },
  { id:'p36', name:'Soy Milk', cat:'Non-Coffee', price:99,
    desc:'A smooth, plant-based milk option served warm or over ice.',
    img:'soy milk.jpg', imgs:['soy milk.jpg'],
    ingredients:'Soy milk.',
    allergens:'Soy.',
    sizes:[ { size:'12oz', price:99 }, { size:'16oz', price:119 }, { size:'20oz', price:139 } ] },
  { id:'p37', name:'Oat Milk', cat:'Non-Coffee', price:109,
    desc:'Creamy, naturally sweet oat milk, our go-to dairy-free option.',
    img:'oatmilk.png', imgs:['oatmilk.png'],
    ingredients:'Oat milk.',
    allergens:'Oats. May contain traces of gluten.',
    sizes:[ { size:'12oz', price:109 }, { size:'16oz', price:129 }, { size:'20oz', price:149 } ] },

  /* ---- Drinks: Tea ---- */
  { id:'p38', name:'Iced Hibiscus Tea with Honey Pearls', cat:'Tea', price:119,
    desc:'Tart hibiscus tea served cold with chewy honey glazed pearls.',
    img:'hibiscustea.png', imgs:['hibiscustea.png'],
    ingredients:'Hibiscus tea, honey pearls, ice.',
    allergens:'None known.',
    sizes:[ { size:'12oz', price:119 }, { size:'16oz', price:139 }, { size:'20oz', price:159 } ] },
  { id:'p39', name:'Classic Organic Earl Grey', cat:'Tea', price:99,
    desc:'Organic black tea leaves infused with fragrant bergamot.',
    img:'earlgrey.png', imgs:['earlgrey.png'],
    ingredients:'Organic Earl Grey tea leaves.',
    allergens:'None known.',
    sizes:[ { size:'12oz', price:99 }, { size:'16oz', price:119 }, { size:'20oz', price:139 } ] },
  { id:'p40', name:'Iced Matcha with a Shot of Espresso', cat:'Tea', price:149,
    desc:'Iced matcha latte with a bold shot of espresso stirred through.',
    img:'matchaespresso.png', imgs:['matchaespresso.png'],
    ingredients:'Matcha powder, milk, espresso, ice.',
    allergens:'Milk. Contains caffeine.',
    sizes:[ { size:'12oz', price:149 }, { size:'16oz', price:169 }, { size:'20oz', price:189 } ] },
  { id:'p41', name:'Black Tea', cat:'Tea', price:89,
    desc:'A straightforward, full-bodied classic black tea, hot or iced.',
    img:'blacktea.png', imgs:['blacktea.png'],
    ingredients:'Black tea leaves.',
    allergens:'None known.',
    sizes:[ { size:'12oz', price:89 }, { size:'16oz', price:109 }, { size:'20oz', price:129 } ] },
  { id:'p42', name:'Grapefruit Honey Iced Tea', cat:'Tea', price:109,
    desc:'Black tea brightened with grapefruit and a touch of honey, served over ice.',
    img:'grapefruittea.png', imgs:['grapefruittea.png'],
    ingredients:'Black tea, grapefruit, honey, ice.',
    allergens:'None known.',
    sizes:[ { size:'12oz', price:109 }, { size:'16oz', price:129 }, { size:'20oz', price:149 } ] },

  /* ---- Merchandise: Wearables ---- */
  { id:'w-shirt-1', name:'Classic Logo Shirt', cat:'Shirts', price:449,
    desc:'Soft cotton shirt with the Crafts and Crumbs logo, made for everyday wear.',
    img:blankPlaceholder('w-shirt-1','Shirts'), imgs:[blankPlaceholder('w-shirt-1','Shirts')],
    sizes:['XS','S','M','L','XL','XXL'],
    fit:'Regular Fit', },
  { id:'w-shirt-2', name:'Cropped Tee', cat:'Shirts', price:399,
    desc:'Relaxed cropped tee with a small embroidered Crafts and Crumbs mark.',
    img:blankPlaceholder('w-shirt-2','Shirts'), imgs:[blankPlaceholder('w-shirt-2','Shirts')],
    sizes:['XS','S','M','L'],
    fit:'Cropped Fit', },
  { id:'w-shirt-3', name:'Oversized Shirt', cat:'Shirts', price:549,
    desc:'Boxy, oversized fit shirt in heavyweight cotton with back print.',
    img:blankPlaceholder('w-shirt-3','Shirts'), imgs:[blankPlaceholder('w-shirt-3','Shirts')],
    sizes:['S','M','L','XL','XXL'],
    fit:'Oversized Fit', },

  { id:'w-cap-1', name:'Classic Cap', cat:'Caps', price:349,
    desc:'Adjustable cap embroidered with the Crafts and Crumbs mark.',
    img:blankPlaceholder('w-cap-1','Caps'), imgs:[blankPlaceholder('w-cap-1','Caps')],
    sizes:['One Size'],
    fit:'Adjustable', },
  { id:'w-cap-2', name:'Trucker Cap', cat:'Caps', price:379,
    desc:'Mesh-back trucker cap with a snapback closure and woven patch.',
    img:blankPlaceholder('w-cap-2','Caps'), imgs:[blankPlaceholder('w-cap-2','Caps')],
    sizes:['One Size'],
    fit:'Adjustable', },
  { id:'w-cap-3', name:'Bucket Hat', cat:'Caps', price:399,
    desc:'Cotton twill bucket hat with a subtle embroidered logo.',
    img:blankPlaceholder('w-cap-3','Caps'), imgs:[blankPlaceholder('w-cap-3','Caps')],
    sizes:['One Size'],
    fit:'Adjustable', },

  { id:'w-short-1', name:'Classic Shorts', cat:'Shorts', price:399,
    desc:'Comfortable everyday shorts featuring the Crafts and Crumbs branding.',
    img:blankPlaceholder('w-short-1','Shorts'), imgs:[blankPlaceholder('w-short-1','Shorts')],
    sizes:['XS','S','M','L','XL','XXL'],
    fit:'Regular Fit', },
  { id:'w-short-2', name:'Jogger Shorts', cat:'Shorts', price:499,
    desc:'Fleece jogger shorts with an elastic waistband and side pockets.',
    img:blankPlaceholder('w-short-2','Shorts'), imgs:[blankPlaceholder('w-short-2','Shorts')],
    sizes:['XS','S','M','L','XL'],
    fit:'Relaxed Fit', },
  { id:'w-short-3', name:'Cargo Shorts', cat:'Shorts', price:549,
    desc:'Utility cargo shorts with side pockets and an embroidered tag.',
    img:blankPlaceholder('w-short-3','Shorts'), imgs:[blankPlaceholder('w-short-3','Shorts')],
    sizes:['S','M','L','XL','XXL'],
    fit:'Relaxed Fit', },

  { id:'w-socks-1', name:'Crew Socks', cat:'Socks', price:159,
    desc:'Cozy crew socks with a cafe-inspired print.',
    img:blankPlaceholder('w-socks-1','Socks'), imgs:[blankPlaceholder('w-socks-1','Socks')],
    sizes:['S','M','L'], },
  { id:'w-socks-2', name:'Ankle Socks', cat:'Socks', price:149,
    desc:'Low-cut ankle socks with a woven logo band.',
    img:blankPlaceholder('w-socks-2','Socks'), imgs:[blankPlaceholder('w-socks-2','Socks')],
    sizes:['S','M','L'], },
  { id:'w-socks-3', name:'Knit Socks', cat:'Socks', price:179,
    desc:'Ribbed knit socks in warm, cafe-inspired tones.',
    img:blankPlaceholder('w-socks-3','Socks'), imgs:[blankPlaceholder('w-socks-3','Socks')],
    sizes:['S','M','L'], },

  { id:'w-tote-1', name:'Canvas Tote', cat:'ToteBags', price:0,
    desc:'Sturdy canvas tote for carrying home your coffee and pastry haul.',
    img:blankPlaceholder('w-tote-1','ToteBags'), imgs:[blankPlaceholder('w-tote-1','ToteBags')], },
  { id:'w-tote-2', name:'Mini Tote', cat:'ToteBags', price:0,
    desc:'Compact mini tote, sized for a quick coffee run.',
    img:blankPlaceholder('w-tote-2','ToteBags'), imgs:[blankPlaceholder('w-tote-2','ToteBags')], },
  { id:'w-tote-3', name:'Zip Tote', cat:'ToteBags', price:0,
    desc:'Zippered tote with an inner pocket, built for everyday errands.',
    img:blankPlaceholder('w-tote-3','ToteBags'), imgs:[blankPlaceholder('w-tote-3','ToteBags')], },


  /* ---- Merchandise: Bracelets ---- */
  { id:'p48', name:'Beads Bracelet', cat:'Bracelets', price:0,
    desc:'Handstrung beaded bracelet in cafe inspired colors.',
    img:'beads.png', imgs:['beads.png'], },
  { id:'p49', name:'Charm Bracelet', cat:'Bracelets', price:0,
    desc:'Delicate bracelet finished with a small charm.',
    img:'charm.png', imgs:['charm.png'], },
  { id:'p50', name:'Slider Bracelet', cat:'Bracelets', price:0,
    desc:'Adjustable slider clasp bracelet for a comfortable fit.',
    img:'slider.png', imgs:['slider.png'], },
  { id:'p51', name:'Pearl Bracelet', cat:'Bracelets', price:0,
    desc:'Dainty bracelet strung with freshwater style pearls.',
    img:'pearl.png', imgs:['pearl.png'], },
  { id:'p52', name:'Hololith Bracelet', cat:'Bracelets', price:0,
    desc:'Bracelet featuring holographic beads that catch the light.',
    img:'hololith.png', imgs:['hololith.png'], },

  /* ---- Merchandise: Keychains ---- */
  { id:'p53', name:'Mini Ceramic Mug Keychain', cat:'Keychains', price:0,
    desc:'A tiny hand-glazed ceramic mug charm for your keys or bag.',
    img:'ceramicmug.png', imgs:['ceramicmug.png'], },
  { id:'p54', name:'Acrylic Boba Tea Keychain', cat:'Keychains', price:0,
    desc:'A playful acrylic charm shaped like a boba tea cup.',
    img:'acrylicboba.png', imgs:['acrylicboba.png'], },
  { id:'p55', name:'Fuzzy Wire Croissant Keychain', cat:'Keychains', price:0,
    desc:'A soft, fuzzy wire croissant charm, handmade and huggable.',
    img:'croissantkeychain.png', imgs:['croissantkeychain.png'], },
  { id:'p56', name:'Crochet Cake Keychain', cat:'Keychains', price:0,
    desc:'A tiny crocheted slice of cake, stitched by hand.',
    img:'crochetcake.png', imgs:['crochetcake.png'], },
  { id:'p57', name:'Lasagna Resin Keychain', cat:'Keychains', price:0,
    desc:'A miniature resin lasagna charm, cast to look good enough to eat.',
    img:'lasagnaresin.png', imgs:['lasagnaresin.png'], },
];

/* ================= CATEGORY METADATA ================= */
const FOOD_CATEGORIES = ['Coffee', 'Non-Coffee', 'Tea', 'Pastries', 'Sandwiches', 'Cakes'];
const DRINK_CATEGORIES = ['Coffee', 'Non-Coffee', 'Tea'];
const SIZED_CATEGORIES = ['Shirts', 'Caps', 'Shorts', 'Socks'];
/* Default size list offered for each sized category when adding a new
   product, or when switching an existing product to one of these
   categories. Editing a product that already has its own size list
   keeps that list instead (see renderSizePriceRows in admin.js). */
const DEFAULT_SIZES_BY_CATEGORY = {
  Shirts: ['XS','S','M','L','XL','XXL'],
  Shorts: ['XS','S','M','L','XL','XXL'],
  Socks: ['S','M','L'],
  Caps: ['One Size'],
};

const CAT_LABELS = {
  'Coffee': { group:'Drinks', sub:'Caffeine' },
  'Non-Coffee': { group:'Drinks', sub:'Non-Caffeine' },
  'Tea': { group:'Drinks', sub:'Tea' },
  'Pastries': { group:'Food', sub:'Pastries' },
  'Sandwiches': { group:'Food', sub:'Sandwiches & Pasta' },
  'Cakes': { group:'Food', sub:'Cakes' },
  'Shirts': { group:'Wearables', sub:'Shirts' },
  'Caps': { group:'Wearables', sub:'Caps' },
  'Shorts': { group:'Wearables', sub:'Shorts' },
  'Socks': { group:'Wearables', sub:'Socks' },
  'ToteBags': { group:'Wearables', sub:'Tote Bags' },
  'Bracelets': { group:'Merchandise', sub:'Bracelets' },
  'Keychains': { group:'Merchandise', sub:'Keychains' },
};

/* Categories an admin has added at runtime via the "+ Add Category"
   form (admin.js), on top of the built-in set above. */
let CUSTOM_CATEGORIES = [];

/* Folds one category doc (see categories-service.js for the shape)
   into the shared category metadata every UI that lists/prices
   products by category needs: CAT_LABELS (badge + breadcrumb text),
   FOOD_CATEGORIES / DRINK_CATEGORIES / SIZED_CATEGORIES /
   DEFAULT_SIZES_BY_CATEGORY (pricing + stock behavior). Safe to call
   more than once with the same category — it just no-ops after the
   first time (CAT_LABELS[c.id] already set). Does NOT touch
   MENU_SIDEBAR/MERCH_SIDEBAR — see applyCustomCategory() in script.js
   for the storefront-only wrapper that also does that. */
function applyCustomCategoryCore(c){
  if(CAT_LABELS[c.id]) return;
  CAT_LABELS[c.id] = { group: c.group, sub: c.label };

  if(c.pricingType === 'sized-price'){
    if(!DRINK_CATEGORIES.includes(c.id)) DRINK_CATEGORIES.push(c.id);
  } else if(c.pricingType === 'sized-stock'){
    if(!SIZED_CATEGORIES.includes(c.id)) SIZED_CATEGORIES.push(c.id);
    DEFAULT_SIZES_BY_CATEGORY[c.id] = (c.sizes && c.sizes.length) ? c.sizes : ['One Size'];
  }
  if(c.hasFoodFields && !FOOD_CATEGORIES.includes(c.id)) FOOD_CATEGORIES.push(c.id);
}

/* Reverses applyCustomCategoryCore. Only ever called on entries from
   CUSTOM_CATEGORIES; built-in categories never go through this. */
function removeCustomCategoryEffectsCore(c){
  delete CAT_LABELS[c.id];
  delete DEFAULT_SIZES_BY_CATEGORY[c.id];

  const di = DRINK_CATEGORIES.indexOf(c.id);
  if(di > -1) DRINK_CATEGORIES.splice(di, 1);
  const si = SIZED_CATEGORIES.indexOf(c.id);
  if(si > -1) SIZED_CATEGORIES.splice(si, 1);
  const fi = FOOD_CATEGORIES.indexOf(c.id);
  if(fi > -1) FOOD_CATEGORIES.splice(fi, 1);
}

/* ================= PRICE / SIZE HELPERS ================= */
const peso = n => '₱' + n.toLocaleString('en-PH');

function getSizeOptions(p){
  if(!p.sizes) return [];
  return p.sizes.map(s => {
    if(typeof s === 'string') return { size: s, price: p.price, stock: null };
    return {
      size: s.size,
      price: typeof s.price === 'number' ? s.price : p.price,
      stock: typeof s.stock === 'number' ? s.stock : null
    };
  });
}

function getDisplayPrice(p){
  const opts = getSizeOptions(p);
  if(!opts.length) return p.price;
  return Math.min(...opts.map(o => o.price));
}

/* True when at least two sizes are actually priced differently — true
   for every drink (12oz/16oz/20oz each cost more) and false for
   wearables (one flat price regardless of size), which is what
   decides whether each size chip needs its own price shown. */
function hasVariablePricing(p){
  const opts = getSizeOptions(p);
  if(opts.length < 2) return false;
  return new Set(opts.map(o => o.price)).size > 1;
}

function priceLabel(p){
  if(hasVariablePricing(p)){
    const opts = getSizeOptions(p);
    const min = Math.min(...opts.map(o => o.price));
    const max = Math.max(...opts.map(o => o.price));
    return `${peso(min)}–${peso(max)}`;
  }
  return peso(getDisplayPrice(p));
}

/* ================= LAUNCH POPUP ================= */
/* Shared between script.js (renders the real #promoOverlay a visitor
   sees) and admin.js (renders the isolated #promoPreviewOverlay from
   whatever's currently typed in the settings form). Keeping the
   defaults/product-resolution/content-injection logic here — instead
   of duplicated in both files — means the preview can never drift
   out of sync with what visitors actually see. */

/* Mirrors settings-service.js's DEFAULT_PROMO_POPUP so this file
   never has to import that module (script.js/admin.js load this as a
   plain script, not a module). Keep the two in sync by hand if either
   changes. */
const PROMO_POPUP_DEFAULTS = {
  enabled: true,
  badgeText: 'New',
  eyebrow: 'Just Dropped',
  headline: 'Fresh Brews,<br>Fresh Merch.',
  copy: 'New seasonal drinks and a handcrafted merch line just landed at Crafts & Crumbs — brewed and stitched with the same care as always.',
  ctaText: 'Take a Look',
  dismissText: 'Maybe later',
  category: '',
  sortMode: 'featured',
  productIds: []
};

/* The in-memory config script.js actually reads when it decides
   whether/what to show. Starts as the defaults; script.js overwrites
   it with the fetched Firestore settings on load, and admin.js
   overwrites it again right after a successful save so a freshly
   saved popup takes effect on this browser's very next fresh session
   without needing a redeploy. */
let PROMO_POPUP_CONFIG = { ...PROMO_POPUP_DEFAULTS };

const PROMO_PICK_LIMIT = 3;

/* Turns a saved/in-progress popup config into the up-to-3 products it
   should showcase:
   - Hand-picked productIds win when present, in the order they were
     picked (missing/deleted product ids are silently dropped).
   - Otherwise falls back to auto-featuring the chosen category,
     sorted "featured" (catalog order, i.e. however PRODUCTS/Firestore
     already orders them — treated as the closest available proxy for
     "best sellers first" since there's no separate sales-count field)
     or "newest" (reverse catalog order, since newer admin-added
     products land later in PRODUCTS).
   - With no picks and no category, returns whatever's first in the
     catalog so the popup still has something to show. */
function resolvePromoProducts(cfg){
  cfg = cfg || PROMO_POPUP_CONFIG;
  const all = (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []) || [];
  const picked = (cfg.productIds || [])
    .map(id => all.find(p => p.id === id))
    .filter(Boolean)
    .slice(0, PROMO_PICK_LIMIT);
  if(picked.length) return picked;

  let pool = cfg.category ? all.filter(p => p.cat === cfg.category) : all.slice();
  if(cfg.sortMode === 'newest') pool = pool.slice().reverse();
  return pool.slice(0, PROMO_PICK_LIMIT);
}

/* Injects a popup config + resolved products into whichever set of
   elements is passed in — the real popup's ids or the admin preview's
   ids, via the same code either way. `selectors` keys: badge, eyebrow,
   title, copy, cta, dismiss, stage, cards (each a CSS selector
   string). Only sets content/markup — click handlers (close/dismiss/
   CTA navigation, open/close animation classes) stay in script.js and
   admin.js respectively, since those differ between the real popup
   and the preview. */
function applyPromoPopupContent(cfg, products, selectors){
  const $ = window.jQuery || window.$;
  $(selectors.badge).text(cfg.badgeText || 'New');
  $(selectors.eyebrow).text(cfg.eyebrow || 'Just Dropped');
  $(selectors.title).html(cfg.headline || '');
  $(selectors.copy).text(cfg.copy || '');
  $(selectors.cta).text(cfg.ctaText || 'Take a Look');
  $(selectors.dismiss).text(cfg.dismissText || 'Maybe later');

  const count = products.length;
  // Fan the cards out symmetrically around center: 1 card sits dead
  // center facing forward; each additional pair alternates left/right,
  // leaning away and sinking back in Z the further out it sits.
  // That whole effect (rotateY lean + translateZ recede + shrink) only
  // reads correctly around a center anchor card at depth 0 — with an
  // even count there's no anchor, both cards sit at the same depth,
  // and rotateY's perspective foreshortening actually shrinks each
  // card's *visual* width more than its pixel offset suggests, so
  // widening the offset alone still leaves a sliver overlapping.
  // For a pair, skip the lean/recede/shrink entirely and lay both
  // cards flat, side by side, with a plain (non-perspective) tilt for
  // a little character — that's a flat 2D rotate, so it never
  // foreshortens the card's actual footprint.
  const isPair = count === 2;
  const cardsHtml = products.map((p, i) => {
    const slot = i - (count - 1) / 2; // e.g. 3 cards -> -1, 0, 1
    const offsetx = isPair ? slot * 150 : slot * 74;
    const depth = isPair ? 0 : Math.abs(slot);
    const angle = isPair ? 0 : slot * -22;
    const tilt = isPair ? slot * -3 : slot * 4;
    const z = Math.round(100 - depth * 10);
    const thumb = (p.imgs && p.imgs[0]) || p.img || blankPlaceholder(p.id, p.cat);
    return `
      <div class="promo-stage-card" data-open-product="${p.id}" style="--i:${i}; --offsetx:${offsetx}; --depth:${depth}; --angle:${angle}; --tilt:${tilt}; --z:${z};">
        <div class="promo-stage-card-float">
          <div class="promo-stage-card-img"><img src="${resolveImageSrc(thumb)}" alt="${p.name}"></div>
          <div class="promo-stage-card-info">
            <span class="promo-stage-card-name">${p.name}</span>
            <span class="promo-stage-card-price">${priceLabel(p)}</span>
          </div>
          <div class="promo-stage-card-desc">
            <p>${p.desc || ''}</p>
            <span class="promo-stage-card-cta">Take a Closer Look →</span>
          </div>
        </div>
      </div>`;
  }).join('');
  $(selectors.cards).html(cardsHtml);
  $(selectors.stage).toggle(count > 0);
}

/* ================= COMBOS ================= */

/* Raw combo records from Firestore (name, desc, img, drinkId, pastryId,
   discountPercent, active) and the "product-shaped" versions derived
   from them — see buildComboProducts() below. Kept separate from
   PRODUCTS so the Menu/Merch grids and the admin Products table never
   accidentally pick up a combo as if it were a real catalog item. */
let COMBOS = [];
let COMBO_PRODUCTS = [];

function buildComboProducts(){
  COMBO_PRODUCTS = COMBOS.filter(c => c.active).map(c => {
    const drink = PRODUCTS.find(p => p.id === c.drinkId);
    const pastry = PRODUCTS.find(p => p.id === c.pastryId);
    if(!drink || !pastry) return null;

    const drinkOpts = getSizeOptions(drink).length ? getSizeOptions(drink) : [{ size: null, price: drink.price, stock: null }];
    const discount = Number(c.discountPercent) || 0;
    const originalSizes = drinkOpts.map(o => ({ size: o.size, price: o.price + pastry.price }));
    const sizes = originalSizes.map(o => ({ size: o.size, price: Math.round(o.price * (1 - discount / 100)) }));

    const stocks = [drink.stock, pastry.stock].filter(s => typeof s === 'number');
    const stock = stocks.length ? Math.min(...stocks) : null;

    return {
      id: 'combo_' + c.id,
      name: c.name,
      desc: c.desc || `${drink.name} + ${pastry.name}`,
      img: c.img,
      imgs: [c.img],
      cat: 'Combo',
      sizes: drinkOpts[0].size ? sizes : undefined,
      price: Math.min(...sizes.map(s => s.price)),
      stock,
      comboMeta: {
        comboId: c.id,
        drinkId: drink.id,
        pastryId: pastry.id,
        discountPercent: discount,
        originalSizes
      }
    };
  }).filter(Boolean);
}

/* ================= FIRESTORE LOAD ================= */
async function loadProductsFromFirestore(){
  try{
    const live = await window.CCProducts.fetchAllProducts();
    if(live.length){
      PRODUCTS = live;
    } else {
      // Firestore is empty (not seeded yet) — fall back to the
      // built-in seed list so the site still renders for a demo.
      PRODUCTS = SEED_PRODUCTS;
      console.warn('Firestore "products" collection is empty. Go to the Admin page and click "Seed Starter Catalog" to populate it.');
    }
  } catch(err){
    console.error('Could not load products from Firestore, using local seed data instead.', err);
    PRODUCTS = SEED_PRODUCTS;
  }
}