/* =========================================================
   Crafts & Crumbs — script.js
   Built with jQuery. Bootstrap 5 is loaded on the page for
   its base utility classes/reset; the layout itself uses a
   custom design system defined in css/style.css.
========================================================= */

/* ================= PLACEHOLDER IMAGE HELPER =================
   Generates a simple on-brand "photo coming soon" placeholder for
   any product that doesn't have a real photo yet. Swap p.img /
   p.imgs to a real file path whenever a photo is ready. */
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

/* ================= DATA =================
   SEED_PRODUCTS is only used to seed Firestore once (via the
   Admin page's "Seed Starter Catalog" button). The live catalog
   that the site actually renders from is the mutable PRODUCTS
   array below, populated from Firestore at startup. */
let PRODUCTS = [];
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
  { id:'p28', name:'Spanish Latte', cat:'Coffee', price:0,
    desc:'Espresso balanced with steamed milk and sweetened condensed milk.',
    img:'spanish latte.png', imgs:['spanish latte.png'],
    ingredients:'Espresso, steamed milk, condensed milk.',
    allergens:'Milk.' },
  { id:'p29', name:'Iced Americano', cat:'Coffee', price:0,
    desc:'Bold espresso shots poured over ice and cold water for a clean, crisp finish.',
    img:'icedamericano.png', imgs:['icedamericano.png'],
    ingredients:'Espresso, cold water, ice.',
    allergens:'None known.' },
  { id:'p30', name:'White Mocha', cat:'Coffee', price:0,
    desc:'Espresso blended with steamed milk and sweet white chocolate sauce.',
    img:'whitemocha.png', imgs:['whitemocha.png'],
    ingredients:'Espresso, steamed milk, white chocolate sauce.',
    allergens:'Milk.' },
  { id:'p31', name:'Vanilla Sweet Cream', cat:'Coffee', price:0,
    desc:'Espresso topped with a smooth vanilla sweet cream foam.',
    img:'vanillacream.png', imgs:['vanillacream.png'],
    ingredients:'Espresso, milk, vanilla syrup, sweet cream foam.',
    allergens:'Milk.' },
  { id:'p32', name:'Dark Caramel Macchiato', cat:'Coffee', price:0,
    desc:'Espresso layered with steamed milk and finished with dark caramel drizzle.',
    img:'darkcaramelmach.png', imgs:['darkcaramelmach.png'],
    ingredients:'Espresso, steamed milk, vanilla syrup, dark caramel sauce.',
    allergens:'Milk.' },

  /* ---- Drinks: Non-Caffeine ---- */
  { id:'p33', name:'Iced Matcha Latte', cat:'Non-Coffee', price:0,
    desc:'Ceremonial matcha whisked with cold milk and poured over ice.',
    img:'IcedGreenTeaLatte.jpg', imgs:['IcedGreenTeaLatte.jpg'],
    ingredients:'Matcha powder, milk, light syrup, ice.',
    allergens:'Milk.' },
  { id:'p34', name:'Hot Chocolate', cat:'Non-Coffee', price:0,
    desc:'Rich cocoa steamed with milk for a warm, comforting classic.',
    img:'hot-chocolate.jpeg', imgs:['hot-chocolate.jpeg'],
    ingredients:'Cocoa, milk, sugar.',
    allergens:'Milk.' },
  { id:'p35', name:'Chai Tea Cream', cat:'Non-Coffee', price:0,
    desc:'Spiced chai tea blended with steamed milk and a light layer of cream.',
    img:'chaiteacream.png', imgs:['chaiteacream.png'],
    ingredients:'Chai tea concentrate, milk, warm spices, cream.',
    allergens:'Milk.' },
  { id:'p36', name:'Soy Milk', cat:'Non-Coffee', price:0,
    desc:'A smooth, plant-based milk option served warm or over ice.',
    img:'soy milk.jpg', imgs:['soy milk.jpg'],
    ingredients:'Soy milk.',
    allergens:'Soy.' },
  { id:'p37', name:'Oat Milk', cat:'Non-Coffee', price:0,
    desc:'Creamy, naturally sweet oat milk, our go-to dairy-free option.',
    img:'oatmilk.png', imgs:['oatmilk.png'],
    ingredients:'Oat milk.',
    allergens:'Oats. May contain traces of gluten.' },

  /* ---- Drinks: Tea ---- */
  { id:'p38', name:'Iced Hibiscus Tea with Honey Pearls', cat:'Tea', price:0,
    desc:'Tart hibiscus tea served cold with chewy honey glazed pearls.',
    img:'hibiscustea.png', imgs:['hibiscustea.png'],
    ingredients:'Hibiscus tea, honey pearls, ice.',
    allergens:'None known.' },
  { id:'p39', name:'Classic Organic Earl Grey', cat:'Tea', price:0,
    desc:'Organic black tea leaves infused with fragrant bergamot.',
    img:'earlgrey.png', imgs:['earlgrey.png'],
    ingredients:'Organic Earl Grey tea leaves.',
    allergens:'None known.' },
  { id:'p40', name:'Iced Matcha with a Shot of Espresso', cat:'Tea', price:0,
    desc:'Iced matcha latte with a bold shot of espresso stirred through.',
    img:'matchaespresso.png', imgs:['matchaespresso.png'],
    ingredients:'Matcha powder, milk, espresso, ice.',
    allergens:'Milk. Contains caffeine.' },
  { id:'p41', name:'Black Tea', cat:'Tea', price:0,
    desc:'A straightforward, full-bodied classic black tea, hot or iced.',
    img:'blacktea.png', imgs:['blacktea.png'],
    ingredients:'Black tea leaves.',
    allergens:'None known.' },
  { id:'p42', name:'Grapefruit Honey Iced Tea', cat:'Tea', price:0,
    desc:'Black tea brightened with grapefruit and a touch of honey, served over ice.',
    img:'grapefruittea.png', imgs:['grapefruittea.png'],
    ingredients:'Black tea, grapefruit, honey, ice.',
    allergens:'None known.' },

  /* ---- Merchandise: Wearables ---- */
  { id:'w-shirt-1', name:'Classic Logo Shirt', cat:'Shirts', price:0,
    desc:'Soft cotton shirt with the Crafts and Crumbs logo, made for everyday wear.',
    img:blankPlaceholder('w-shirt-1','Shirts'), imgs:[blankPlaceholder('w-shirt-1','Shirts')],
    sizes:['XS','S','M','L','XL','XXL'],
    fit:'Regular Fit', },
  { id:'w-shirt-2', name:'Cropped Tee', cat:'Shirts', price:0,
    desc:'Relaxed cropped tee with a small embroidered Crafts and Crumbs mark.',
    img:blankPlaceholder('w-shirt-2','Shirts'), imgs:[blankPlaceholder('w-shirt-2','Shirts')],
    sizes:['XS','S','M','L'],
    fit:'Cropped Fit', },
  { id:'w-shirt-3', name:'Oversized Shirt', cat:'Shirts', price:0,
    desc:'Boxy, oversized fit shirt in heavyweight cotton with back print.',
    img:blankPlaceholder('w-shirt-3','Shirts'), imgs:[blankPlaceholder('w-shirt-3','Shirts')],
    sizes:['S','M','L','XL','XXL'],
    fit:'Oversized Fit', },

  { id:'w-cap-1', name:'Classic Cap', cat:'Caps', price:0,
    desc:'Adjustable cap embroidered with the Crafts and Crumbs mark.',
    img:blankPlaceholder('w-cap-1','Caps'), imgs:[blankPlaceholder('w-cap-1','Caps')],
    sizes:['One Size'],
    fit:'Adjustable', },
  { id:'w-cap-2', name:'Trucker Cap', cat:'Caps', price:0,
    desc:'Mesh-back trucker cap with a snapback closure and woven patch.',
    img:blankPlaceholder('w-cap-2','Caps'), imgs:[blankPlaceholder('w-cap-2','Caps')],
    sizes:['One Size'],
    fit:'Adjustable', },
  { id:'w-cap-3', name:'Bucket Hat', cat:'Caps', price:0,
    desc:'Cotton twill bucket hat with a subtle embroidered logo.',
    img:blankPlaceholder('w-cap-3','Caps'), imgs:[blankPlaceholder('w-cap-3','Caps')],
    sizes:['One Size'],
    fit:'Adjustable', },

  { id:'w-short-1', name:'Classic Shorts', cat:'Shorts', price:0,
    desc:'Comfortable everyday shorts featuring the Crafts and Crumbs branding.',
    img:blankPlaceholder('w-short-1','Shorts'), imgs:[blankPlaceholder('w-short-1','Shorts')],
    sizes:['XS','S','M','L','XL','XXL'],
    fit:'Regular Fit', },
  { id:'w-short-2', name:'Jogger Shorts', cat:'Shorts', price:0,
    desc:'Fleece jogger shorts with an elastic waistband and side pockets.',
    img:blankPlaceholder('w-short-2','Shorts'), imgs:[blankPlaceholder('w-short-2','Shorts')],
    sizes:['XS','S','M','L','XL'],
    fit:'Relaxed Fit', },
  { id:'w-short-3', name:'Cargo Shorts', cat:'Shorts', price:0,
    desc:'Utility cargo shorts with side pockets and an embroidered tag.',
    img:blankPlaceholder('w-short-3','Shorts'), imgs:[blankPlaceholder('w-short-3','Shorts')],
    sizes:['S','M','L','XL','XXL'],
    fit:'Relaxed Fit', },

  { id:'w-socks-1', name:'Crew Socks', cat:'Socks', price:0,
    desc:'Cozy crew socks with a cafe-inspired print.',
    img:blankPlaceholder('w-socks-1','Socks'), imgs:[blankPlaceholder('w-socks-1','Socks')],
    sizes:['S','M','L'], },
  { id:'w-socks-2', name:'Ankle Socks', cat:'Socks', price:0,
    desc:'Low-cut ankle socks with a woven logo band.',
    img:blankPlaceholder('w-socks-2','Socks'), imgs:[blankPlaceholder('w-socks-2','Socks')],
    sizes:['S','M','L'], },
  { id:'w-socks-3', name:'Knit Socks', cat:'Socks', price:0,
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

/* ================= SIZE CHARTS (Uniqlo-style measurement guides) =================
   Keyed by category. Each entry lists the sizes offered and the body/garment
   measurements shown in the "Size Guide" table on the product page. Products
   without an entry here (ToteBags, Bracelets, Keychains) don't show a size
   selector at all — they're one-size accessories, not fitted garments. */
const SIZE_CHARTS = {
  Shirts: {
    unit: 'cm',
    columns: ['Chest', 'Length', 'Shoulder'],
    rows: {
      'XS':  ['86–89',  '64', '40'],
      'S':   ['90–93',  '66', '42'],
      'M':   ['94–97',  '68', '44'],
      'L':   ['98–103', '70', '46'],
      'XL':  ['104–109','72', '48'],
      'XXL': ['110–115','74', '50'],
    }
  },
  Shorts: {
    unit: 'cm',
    columns: ['Waist', 'Hip', 'Length'],
    rows: {
      'XS':  ['66–69',  '88–91',  '38'],
      'S':   ['70–73',  '92–95',  '39'],
      'M':   ['74–78',  '96–100', '40'],
      'L':   ['79–84',  '101–106','41'],
      'XL':  ['85–91',  '107–113','42'],
      'XXL': ['92–98',  '114–120','43'],
    }
  },
  Socks: {
    unit: '',
    columns: ['Shoe Size (US)', 'Shoe Size (UK)'],
    rows: {
      'S': ['4–6.5',  '3–6'],
      'M': ['7–9.5',  '6–9'],
      'L': ['10–13',  '9–12'],
    }
  },
  Caps: {
    unit: '',
    columns: ['Head Circumference'],
    rows: {
      'One Size': ['54–60 cm, adjustable strap'],
    }
  }
};

const CATEGORIES = [
  { key:'Coffee', emoji:'☕', title:'Coffee', desc:'Slow-pulled espresso and small-batch roasts, brewed to order.', img:'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&q=80' },
  { key:'Pastries', emoji:'🥐', title:'Pastries', desc:'Laminated, folded, and baked fresh every single morning.', img:'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500&q=80' },
  { key:'Wearables', emoji:'🎁', title:'Merchandise', desc:'Shirts, caps, bracelets, and keychains made for regulars.', img:'merchcac.png' },
];

const REVIEWS = [
  { name:'Miguel R.', text:'The iced americano tastes like it was made by someone who actually cares. My mornings are better because of this place.', img:'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&q=80' },
  { name:'Andrea S.', text:'Their cinnamon roll is the best in the city, hands down. I bring a box home every weekend.', img:'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&q=80' },
  { name:'Kevin T.', text:'Cozy corner, fast wifi, and the tote bags they sell are gorgeous. I bought one for my whole team.', img:'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=101&q=80' },
];

/* ================= STATE ================= */
let cart = []; // {id, qty, size}
let currentProductId = SEED_PRODUCTS[0].id;
let pdQty = 1;
let pdSize = null;
let menuFilter = 'Coffee';
let menuSearch = '';
let merchFilter = 'Shirts';
let merchSearch = '';
let fulfillment = 'delivery';

/* ================= MENU SIDEBAR DATA ================= */
const MENU_SIDEBAR = [
  { group:'Drinks', items:[
      { label:'Caffeine', cat:'Coffee' },
      { label:'Non-Caffeine', cat:'Non-Coffee' },
      { label:'Tea', cat:'Tea' },
  ]},
  { group:'Food', items:[
      { label:'Pastries', cat:'Pastries' },
      { label:'Sandwiches & Pasta', cat:'Sandwiches' },
      { label:'Cakes', cat:'Cakes' },
  ]},
];

/* ================= MERCHANDISE SIDEBAR DATA ================= */
const MERCH_SIDEBAR = [
  { group:null, items:[
      { label:'Bracelets', cat:'Bracelets' },
      { label:'Keychains', cat:'Keychains' },
  ]},
  { group:'Wearables', items:[
      { label:'Shirts', cat:'Shirts' },
      { label:'Caps', cat:'Caps' },
      { label:'Shorts', cat:'Shorts' },
      { label:'Socks', cat:'Socks' },
      { label:'Tote Bags', cat:'ToteBags' },
  ]},
];
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

/* ================= HELPERS ================= */
const peso = n => '₱' + n.toLocaleString('en-PH');
const findProduct = id => PRODUCTS.find(p => p.id === id);

function showToast(msg){
  const $t = $('#toast');
  $('#toastMsg').text(msg);
  $t.addClass('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> $t.removeClass('show'), 2200);
}

function addToCart(id, qty=1, size=null){
  const existing = cart.find(c => c.id === id && c.size === size);
  if(existing){ existing.qty += qty; } else { cart.push({id, qty, size}); }
  updateCartCount();
  const label = findProduct(id).name + (size ? ` (${size})` : '');
  showToast('Added to cart · ' + label);
}

function updateCartCount(){
  const count = cart.reduce((s,c)=>s+c.qty,0);
  $('#cartCount').text(count).toggle(count > 0);
  renderCartDropdown();
}

/* ================= MINI CART DROPDOWN ================= */
function renderCartDropdown(){
  const $items = $('#cartDropdownItems');
  const $footer = $('#cartDropdownFooter');

  if(cart.length === 0){
    $items.html(`
      <div class="cart-dropdown-empty">
        <div class="cart-dd-empty-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="21" r="1.4" fill="currentColor"/><circle cx="18" cy="21" r="1.4" fill="currentColor"/></svg>
        </div>
        <p>Your cart is empty</p>
        <span>Discover something delicious or handmade.</span>
      </div>`);
    $footer.html(`
      <button class="btn btn-primary" data-nav="menu">Browse Menu</button>
      <button class="btn btn-outline" data-nav="merchandise">Browse Merchandise</button>
    `);
    return;
  }

  $items.html(cart.map(c => {
    const p = findProduct(c.id);
    const lineKey = `${c.id}::${c.size || ''}`;
    return `
      <div class="cart-dd-item">
        <img src="${p.img}" alt="${p.name}">
        <div>
          <div class="cart-dd-name">${p.name}${c.size ? ` <span class="cart-dd-size">(${c.size})</span>` : ''}</div>
          <div class="cart-dd-meta">
            <span>${c.qty} × ${peso(p.price)}</span>
            <span style="display:flex; align-items:center; gap:8px;">
              ${peso(p.price*c.qty)}
              <button class="cart-dd-remove" data-cart-remove="${lineKey}" aria-label="Remove item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              </button>
            </span>
          </div>
        </div>
      </div>
    `;
  }).join(''));

  $footer.html(`
    <div class="cart-dd-subtotal"><span>Subtotal</span><span>${peso(cartTotal())}</span></div>
    <button class="btn btn-primary" data-nav="checkout" id="ddCheckoutBtn">Proceed to Checkout</button>
    <button class="btn btn-outline" data-nav="cart" id="ddViewCartBtn">View Cart</button>
  `);
}

$(document).on('click', '#cartBtn', function(e){
  e.stopPropagation();
  $('#cartDropdownWrap').toggleClass('open');
});

// Clicking a cart-dropdown action (checkout / view cart) should also close the dropdown
$(document).on('click', '#cartDropdown [data-nav]', function(){
  $('#cartDropdownWrap').removeClass('open');
});

// Click anywhere outside the dropdown closes it
$(document).on('click', function(e){
  const $wrap = $('#cartDropdownWrap');
  if($wrap.hasClass('open') && !$(e.target).closest('#cartDropdownWrap').length){
    $wrap.removeClass('open');
  }
});

// Esc key closes it too
$(document).on('keydown', function(e){
  if(e.key === 'Escape'){
    $('#cartDropdownWrap').removeClass('open');
    $('#accountDropdownWrap').removeClass('open');
    closeLegalModal();
  }
});

function cartTotal(){
  return cart.reduce((s,c)=> s + findProduct(c.id).price * c.qty, 0);
}

/* ================= NAVIGATION ================= */
function navigate(pageName){
  $('.page').removeClass('active');
  $(`.page[data-page="${pageName}"]`).addClass('active');

  $('.nav-links a').each(function(){
    $(this).toggleClass('active', $(this).data('nav') === pageName);
  });

  $('#navLinks').removeClass('open');
  window.scrollTo({top:0, behavior:'instant' in window ? 'instant':'auto'});

  /* The header search box duplicates the "Looking for..." search
     already built into the Menu and Merchandise pages, so hide it
     there and only show it everywhere else. */
  $('.header-search').toggleClass('is-hidden', pageName === 'menu' || pageName === 'merchandise');

  if(pageName === 'admin' && window.currentRole !== 'admin'){
    showToast('Admin access only. Please log in as an admin.');
    $('.page').removeClass('active');
    $('.page[data-page="home"]').addClass('active');
    return;
  }
  if(pageName === 'admin' && typeof renderAdminDashboard === 'function'){
    renderAdminDashboard();
  }
  if(pageName === 'checkout' && !window.currentUser){
    showToast('Please log in to check out.');
    $('.page').removeClass('active');
    $('.page[data-page="login"]').addClass('active');
    return;
  }
  if(pageName === 'product') renderProductDetail();
  if(pageName === 'cart') renderCart();
  if(pageName === 'checkout') renderCheckoutSummary();
  if(pageName === 'about'){
    navigate('home');
    setTimeout(()=> $('.about-split')[0]?.scrollIntoView({behavior:'smooth'}), 50);
  }

  /* Cart and Checkout are the two places a stale price actually costs
     someone money, so refetch the live catalog every time either page
     is opened — this tab may have been sitting open since before an
     admin changed a price, and there's no realtime listener to tell it
     otherwise. renderCart()/renderCheckoutSummary() already painted
     above with whatever PRODUCTS we had, so this just quietly corrects
     it once the fresh fetch resolves (usually well under a second). */
  if(pageName === 'cart' || pageName === 'checkout'){
    refreshProductsThenRerender(pageName);
  }

  initReveal();
}

async function refreshProductsThenRerender(pageName){
  await loadProductsFromFirestore();
  if(!$(`.page[data-page="${pageName}"]`).hasClass('active')) return; // user already navigated away
  if(pageName === 'cart') renderCart();
  if(pageName === 'checkout') renderCheckoutSummary();
}

// Delegated nav click — covers elements rendered now or later
$(document).on('click', '[data-nav]', function(e){
  e.preventDefault();
  navigate($(this).data('nav'));
});

$('#hamburgerBtn').on('click', ()=> $('#navLinks').toggleClass('open'));

/* ================= HEADER SEARCH ================= */
function runHeaderSearch(){
  const q = $('#headerSearch').val();
  menuSearch = q;
  menuFilter = 'All';
  navigate('menu');
  renderMenuPage();
}
$('#headerSearchBtn').on('click', runHeaderSearch);
$('#headerSearch').on('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); runHeaderSearch(); } });

/* ================= RENDER: HOME ================= */
function renderCategories(){
  const isMerch = c => ['Wearables','Bracelets','Keychains'].includes(c.key);
  const html = CATEGORIES.map((c,i) => `
    <div class="cat-card reveal" style="--i:${i}" ${isMerch(c) ? `data-nav="merchandise"` : `data-menu-filter="${c.key}"`}>
      <div class="cat-img"><img src="${c.img}" alt="${c.title}"></div>
      <div class="cat-body">
        <span class="emoji">${c.emoji}</span>
        <h3>${c.title}</h3>
        <p>${c.desc}</p>
        <span class="cat-link">Explore ${c.title} <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      </div>
    </div>
  `).join('');
  $('#categoryGrid').html(html);
  initReveal();
}

$(document).on('click', '[data-menu-filter]', function(){
  menuFilter = $(this).data('menu-filter');
  navigate('menu');
  renderMenuPage();
});

function productCard(p, i=0){
  return `
    <div class="product-card reveal" style="--i:${i}">
      <div class="product-img" data-open-product="${p.id}"><img src="${p.img}" alt="${p.name}"></div>
      <div class="product-info">
        <div class="product-name" data-open-product="${p.id}">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-footer">
          <span class="price">${peso(p.price)}</span>
          <button class="add-btn" data-quick-add="${p.id}" aria-label="Add to cart">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

/* Eight curated best sellers — mixes drinks + bakes for visual variety in the carousel */
const BEST_SELLER_IDS = ['p13','p14','p15','p16','p17','p23','p28','p53'];

/* On-brand fallback artwork for any product image that fails to load
   (used by p13–p17, which point at local files that aren't hosted here). */
function placeholderImg(p){
  return blankPlaceholder(p.id, p.cat);
}

function bestSellerCard(p, i){
  return `
    <div class="product-card best-card" style="--i:${i}">
      <div class="product-img" data-open-product="${p.id}">
        <span class="bestseller-tag">${String(i+1).padStart(2,'0')}</span>
        <img src="${p.img}" alt="${p.name}">
        <div class="best-card-shade"></div>
      </div>
      <div class="product-info">
        <span class="eyebrow best-eyebrow">${p.cat}</span>
        <div class="product-name" data-open-product="${p.id}">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-footer">
          <span class="price">${peso(p.price)}</span>
          <button class="add-btn" data-quick-add="${p.id}" aria-label="Add to cart">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderBestSellers(){
  const best = BEST_SELLER_IDS.map(findProduct).filter(Boolean);
  initBestSellerCarousel(best);
}

/* ================= POPULAR THIS WEEK — auto-scrolling marquee ================= */
function debounce(fn, wait){
  let t;
  return function(...args){ clearTimeout(t); t = setTimeout(()=> fn.apply(this, args), wait); };
}

function initBestSellerCarousel(items){
  const wrapEl = document.querySelector('#bestSellerCarousel .carousel-track-wrap');
  const trackEl = document.getElementById('bestSellerGrid');
  const prevBtn = document.getElementById('bsPrev');
  const nextBtn = document.getElementById('bsNext');
  if(!wrapEl || !trackEl || !items.length) return;

  // Two back-to-back copies of the set create a seamless infinite loop
  // for the arrows/swipe to scroll through (no auto-play — purely
  // manual browsing now).
  trackEl.innerHTML = items.map(bestSellerCard).join('') + items.map(bestSellerCard).join('');

  // On-brand fallback for any image that fails to load
  $(trackEl).find('.product-img img').each(function(i){
    const p = items[i % items.length];
    $(this).one('error', function(){ this.src = placeholderImg(p); });
  });

  // NOTE: this is a plain, native-scrolling container (overflow-x:auto in
  // CSS). We only ever read/nudge wrapEl.scrollLeft here — we never call
  // setPointerCapture, preventDefault, or stopPropagation on anything, so
  // clicks on a card image/name/add-btn behave exactly like they do in the
  // menu and merch grids (same [data-open-product]/[data-quick-add]
  // delegated handlers, completely untouched by carousel code).

  let setWidth = 0;
  function measure(){
    const cards = trackEl.querySelectorAll('.product-card');
    if(cards.length < items.length) return;
    const cs = getComputedStyle(trackEl);
    const gap = parseFloat(cs.columnGap || cs.gap) || 22;
    let w = 0;
    for(let i=0; i<items.length; i++){ w += cards[i].getBoundingClientRect().width + gap; }
    setWidth = w;
    // Start a little way into the first set so the illusion of endless
    // items works when nudging backwards from the very start too.
    if(wrapEl.scrollLeft < 1) wrapEl.scrollLeft = 1;
  }
  measure();
  window.addEventListener('resize', debounce(measure, 200));

  const SPEED = 26; // px/sec, moving left — an unhurried, boutique-window drift
  // Respect the OS-level "reduce motion" setting: the passive drift is
  // pure decoration, so people who've asked for less motion get a
  // perfectly still carousel they can still browse with the arrows,
  // wheel, or a swipe — nothing here is required to use the site.
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let paused = reduceMotion;
  let interacting = false;
  let resumeTimer = null;
  let lastTime = null;
  let correcting = false; // guards against our own loop-reset scroll events
  let ramp = 1; // eases the drift back in after a pause instead of snapping to full speed

  function pauseTemporarily(ms){
    paused = true;
    clearTimeout(resumeTimer);
    if(reduceMotion) return; // stays paused — no auto-resume when motion is reduced
    resumeTimer = setTimeout(()=>{ paused = false; ramp = 0; }, ms);
  }

  // Seamless infinite loop: once we scroll past one full set, silently
  // snap back by exactly that width (imperceptible since the two halves
  // are identical copies).
  wrapEl.addEventListener('scroll', function(){
    if(correcting || setWidth <= 0) return;
    if(wrapEl.scrollLeft >= setWidth){
      correcting = true;
      wrapEl.scrollLeft -= setWidth;
      correcting = false;
    } else if(wrapEl.scrollLeft <= 0){
      correcting = true;
      wrapEl.scrollLeft += setWidth;
      correcting = false;
    }
  });

  // Drift the scroll position steadily to the right, which visually
  // carries the cards to the left — same direction reading flows.
  function frame(t){
    if(lastTime === null) lastTime = t;
    const dt = (t - lastTime) / 1000;
    lastTime = t;
    if(!paused && !interacting && setWidth > 0){
      if(ramp < 1) ramp = Math.min(1, ramp + dt * 0.5);
      correcting = true;
      wrapEl.scrollLeft += SPEED * dt * ramp;
      correcting = false;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function step(){
    const card = trackEl.querySelector('.product-card');
    const cs = getComputedStyle(trackEl);
    const gap = parseFloat(cs.columnGap || cs.gap) || 22;
    return (card ? card.getBoundingClientRect().width : 250) + gap;
  }

  prevBtn && prevBtn.addEventListener('click', function(){
    wrapEl.scrollBy({ left: -step(), behavior:'smooth' });
    pauseTemporarily(3400);
  });
  nextBtn && nextBtn.addEventListener('click', function(){
    wrapEl.scrollBy({ left: step(), behavior:'smooth' });
    pauseTemporarily(3400);
  });

  // Pause the drift while the user's mouse/finger is anywhere near the
  // carousel (this is also when the arrows fade in via CSS) — resumes
  // automatically a moment after they leave.
  wrapEl.addEventListener('mouseenter', ()=>{ clearTimeout(resumeTimer); paused = true; });
  wrapEl.addEventListener('mouseleave', ()=>{ if(!reduceMotion){ paused = false; ramp = 0; } });
  wrapEl.addEventListener('touchstart', ()=>{ interacting = true; clearTimeout(resumeTimer); }, { passive:true });
  wrapEl.addEventListener('touchend', ()=>{ interacting = false; pauseTemporarily(1500); }, { passive:true });

  // Let a vertical mouse wheel also scroll the carousel horizontally —
  // a nice touch for desktop users without a trackpad.
  wrapEl.addEventListener('wheel', function(e){
    if(Math.abs(e.deltaY) > Math.abs(e.deltaX)){
      wrapEl.scrollLeft += e.deltaY;
      e.preventDefault();
      pauseTemporarily(1800);
    }
  }, { passive:false });

  // Pause while the tab is hidden so items don't "jump" forward when
  // the user comes back.
  document.addEventListener('visibilitychange', ()=>{ lastTime = null; });
}

function renderReviews(){
  const html = REVIEWS.map(r => `
    <div class="review-card">
      <div class="review-top">
        <img src="${r.img}" alt="${r.name}">
        <div>
          <div class="review-name">${r.name}</div>
          <div class="stars">★★★★★</div>
        </div>
      </div>
      <p class="review-text">"${r.text}"</p>
    </div>
  `).join('');
  $('#reviewGrid').html(html);
}

// Delegated product-card interactions (open detail / quick add)
$(document).on('click', '[data-open-product]', function(){
  currentProductId = $(this).data('open-product');
  navigate('product');
});

$(document).on('click', '[data-quick-add]', function(e){
  e.stopPropagation();
  const id = $(this).data('quick-add');
  const p = findProduct(id);
  if(SIZE_CHARTS[p.cat] && p.sizes && p.sizes.length > 1){
    currentProductId = id;
    navigate('product');
    showToast('Please select a size');
    return;
  }
  addToCart(id, 1, (p.sizes && p.sizes.length === 1) ? p.sizes[0] : null);
  const $img = $(this).closest('.product-card').find('.product-img img').first();
  if($img.length) flyToCart($img[0]);
  $(this).addClass('added');
  setTimeout(()=> $(this).removeClass('added'), 500);
});

/* ================= RENDER: MENU ================= */
function renderMenuSidebar(){
  const html = MENU_SIDEBAR.map(g => `
    <div class="sidebar-group">
      <div class="sidebar-group-title">${g.group}</div>
      ${g.items.map(it => `<a class="sidebar-link ${menuFilter===it.cat?'active':''}" data-menu-cat="${it.cat}">${it.label}</a>`).join('')}
    </div>
  `).join('');
  $('#menuSidebarGroups').html(html);
}

$(document).on('click', '[data-menu-cat]', function(){
  menuFilter = $(this).data('menu-cat');
  menuSearch = '';
  renderMenuPage();
});

function renderMenuGrid(){
  let items = PRODUCTS.filter(p => menuFilter === 'All' || p.cat === menuFilter);
  if(menuSearch.trim()){
    const q = menuSearch.trim().toLowerCase();
    items = items.filter(p => p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
  }
  const $grid = $('#menuGrid');
  if(items.length === 0){
    $grid.html(`<div class="empty-state" style="grid-column:1/-1;">No items here yet. Try another category or search term.</div>`);
    return;
  }
  $grid.html(items.map(productCard).join(''));
  initReveal();
}

function renderMenuPage(){
  renderMenuSidebar();
  if(menuFilter === 'All'){
    $('#menuBreadcrumb').text('Search');
    $('#menuHeading').text(menuSearch ? `Results for "${menuSearch}"` : 'All Items');
  } else {
    const label = CAT_LABELS[menuFilter] || { group:menuFilter, sub:'' };
    $('#menuBreadcrumb').text(label.sub ? `${label.group} / ${label.sub}` : label.group);
    $('#menuHeading').text(label.sub || label.group);
  }
  renderMenuGrid();
  $('#menuSearch').val(menuSearch);
}

$(document).on('input', '#menuSearch', function(){
  menuSearch = $(this).val();
  renderMenuGrid();
});

/* ================= RENDER: MERCHANDISE ================= */
function renderMerchSidebar(){
  const html = MERCH_SIDEBAR.map(g => `
    <div class="sidebar-group">
      ${g.group ? `<div class="sidebar-group-title">${g.group}</div>` : ''}
      ${g.items.map(it => `<a class="sidebar-link ${merchFilter===it.cat?'active':''}" data-merch-cat="${it.cat}">${it.label}</a>`).join('')}
    </div>
  `).join('');
  $('#merchSidebarGroups').html(html);
}

$(document).on('click', '[data-merch-cat]', function(){
  merchFilter = $(this).data('merch-cat');
  merchSearch = '';
  renderMerchPage();
});

function renderMerchGrid(){
  let items = PRODUCTS.filter(p => merchFilter === 'All' || p.cat === merchFilter);
  if(merchSearch.trim()){
    const q = merchSearch.trim().toLowerCase();
    items = items.filter(p => p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
  }
  const $grid = $('#merchGrid');
  if(items.length === 0){
    $grid.html(`<div class="empty-state" style="grid-column:1/-1;">No items here yet. Try another category or search term.</div>`);
    return;
  }
  $grid.html(items.map(productCard).join(''));
  initReveal();
}

function renderMerchPage(){
  renderMerchSidebar();
  if(merchFilter === 'All'){
    $('#merchBreadcrumb').text('Search');
    $('#merchHeading').text(merchSearch ? `Results for "${merchSearch}"` : 'All Merchandise');
  } else {
    const label = CAT_LABELS[merchFilter] || { group:merchFilter, sub:'' };
    $('#merchBreadcrumb').text(label.sub ? `${label.group} / ${label.sub}` : label.group);
    $('#merchHeading').text(label.sub || label.group);
  }
  renderMerchGrid();
  $('#merchSearch').val(merchSearch);
}

$(document).on('input', '#merchSearch', function(){
  merchSearch = $(this).val();
  renderMerchGrid();
});

/* ================= RENDER: PRODUCT DETAIL ================= */
/* Renders either the ingredients/allergens block (food) or a Uniqlo-style
   size selector + fit tag + measurement guide (wearables with a SIZE_CHARTS
   entry). Other merch (totes, bracelets, keychains) gets neither. */
function renderPdSecondary(p){
  const chart = SIZE_CHARTS[p.cat];
  if(chart){
    const singleSize = p.sizes && p.sizes.length === 1;
    return `
      <div class="pd-sizing">
        <div class="pd-sizing-head">
          <h4>${singleSize ? 'Size' : 'Select Size'}</h4>
          ${p.fit ? `<span class="pd-fit-tag">${p.fit}</span>` : ''}
        </div>
        ${singleSize ? `
          <div class="size-chip active" data-pd-size="${p.sizes[0]}">${p.sizes[0]}</div>
        ` : `
          <div class="size-chip-row" id="pdSizeRow">
            ${p.sizes.map(s => `<button type="button" class="size-chip" data-pd-size="${s}">${s}</button>`).join('')}
          </div>
        `}
        <button type="button" class="size-guide-toggle" id="pdSizeGuideToggle">Size Guide</button>
        <div class="size-guide-table" id="pdSizeGuideTable" style="display:none;">
          <table>
            <thead><tr><th>Size</th>${chart.columns.map(c=>`<th>${c}${chart.unit? ` (${chart.unit})`:''}</th>`).join('')}</tr></thead>
            <tbody>
              ${Object.entries(chart.rows).map(([size, vals]) => `
                <tr><td>${size}</td>${vals.map(v=>`<td>${v}</td>`).join('')}</tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  if(p.ingredients){
    return `
      <div class="pd-info-grid">
        <div class="pd-ingredients">
          <h4>Ingredients</h4>
          <p>${p.ingredients}</p>
        </div>
        <div class="pd-ingredients pd-allergens">
          <h4>Allergens</h4>
          <p>${p.allergens || 'Please ask our staff for full allergen details.'}</p>
        </div>
      </div>
    `;
  }
  return '';
}

function renderProductDetail(){
  const p = findProduct(currentProductId);
  pdQty = 1;
  pdSize = (SIZE_CHARTS[p.cat] && p.sizes && p.sizes.length === 1) ? p.sizes[0] : null;
  $('#pdCrumb').text(p.name);
  const isMerch = ['Shirts','Caps','Shorts','Socks','ToteBags','Bracelets','Keychains'].includes(p.cat);
  $('#pdSectionLink').text(isMerch ? 'Merchandise' : 'Menu')
    .attr('data-nav', isMerch ? 'merchandise' : 'menu')
    .data('nav', isMerch ? 'merchandise' : 'menu');
  $('#pdContent').html(`
    <div>
      <div class="pd-main-img"><img id="pdMainImg" src="${p.imgs[0]}" alt="${p.name}"></div>
      <div class="pd-thumbs">
        ${p.imgs.map((im,i)=>`<img src="${im}" class="${i===0?'active':''}" data-thumb="${im}" alt="${p.name} view ${i+1}">`).join('')}
      </div>
    </div>
    <div>
      <div class="eyebrow">${p.cat}</div>
      <h1 style="margin:10px 0 4px;">${p.name}</h1>
      <div class="pd-price">${peso(p.price)}</div>
      <p class="pd-desc">${p.desc}${p.ingredients ? ' Made in small batches at our counter, using seasonal ingredients whenever we can.' : ''}</p>
      ${renderPdSecondary(p)}
      <div class="pd-actions">
        <div class="qty-select" id="pdQtySelect">
          <button data-qty-action="minus">−</button>
          <span id="pdQtyVal">1</span>
          <button data-qty-action="plus">+</button>
        </div>
        <button class="btn btn-primary" id="pdAddBtn" data-pd-add="${p.id}">Add to Cart · ${peso(p.price)}</button>
      </div>
    </div>
  `);

  const related = PRODUCTS.filter(x => x.cat === p.cat && x.id !== p.id).slice(0,4);
  const fill = related.length < 4 ? PRODUCTS.filter(x=>x.id!==p.id && !related.includes(x)).slice(0, 4-related.length) : [];
  $('#relatedGrid').html([...related, ...fill].map(productCard).join(''));
  initReveal();
}

$(document).on('click', '[data-pd-size]', function(){
  pdSize = $(this).data('pd-size');
  $('#pdSizeRow .size-chip').removeClass('active');
  $(this).addClass('active');
});

$(document).on('click', '#pdSizeGuideToggle', function(){
  $('#pdSizeGuideTable').slideToggle(160);
});

$(document).on('click', '[data-thumb]', function(){
  $('#pdMainImg').attr('src', $(this).data('thumb'));
  $('[data-thumb]').removeClass('active');
  $(this).addClass('active');
});

$(document).on('click', '[data-qty-action]', function(){
  const p = findProduct(currentProductId);
  if($(this).data('qty-action') === 'plus') pdQty++;
  else pdQty = Math.max(1, pdQty - 1);
  $('#pdQtyVal').text(pdQty);
  $('#pdAddBtn').text(`Add to Cart · ${peso(p.price * pdQty)}`);
});

$(document).on('click', '[data-pd-add]', function(){
  const p = findProduct($(this).data('pd-add'));
  if(SIZE_CHARTS[p.cat] && p.sizes && p.sizes.length > 1 && !pdSize){
    showToast('Please select a size first');
    return;
  }
  addToCart(p.id, pdQty, pdSize);
  const mainImg = document.getElementById('pdMainImg');
  if(mainImg) flyToCart(mainImg);
});

/* ================= RENDER: CART ================= */
function renderCart(){
  const $wrap = $('#cartContainer');
  if(cart.length === 0){
    $wrap.html(`
      <div class="empty-cart">
        <div class="empty-cart-icon">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="21" r="1.4" fill="currentColor"/><circle cx="18" cy="21" r="1.4" fill="currentColor"/></svg>
        </div>
        <h3>Your cart feels a little light</h3>
        <p>Add a coffee, a pastry, or a handcrafted keepsake to get started.</p>
        <div class="empty-cart-actions">
          <button class="btn btn-primary" data-nav="menu">Browse Menu</button>
          <button class="btn btn-outline" data-nav="merchandise">Browse Merchandise</button>
        </div>
      </div>`);
    return;
  }

  const itemsHtml = cart.map(c => {
    const p = findProduct(c.id);
    const lineKey = `${c.id}::${c.size || ''}`;
    return `
      <div class="cart-item">
        <img src="${p.img}" alt="${p.name}">
        <div>
          <div class="cart-item-name">${p.name}</div>
          <div class="cart-item-meta">${p.cat}${c.size ? ` · Size: ${c.size}` : ''} · ${peso(p.price)} each</div>
        </div>
        <div class="qty-select" data-cart-qty="${lineKey}">
          <button data-cart-action="minus">−</button>
          <span>${c.qty}</span>
          <button data-cart-action="plus">+</button>
        </div>
        <div style="display:flex; align-items:center; gap:14px;">
          <span class="price cart-item-price">${peso(p.price*c.qty)}</span>
          <button class="remove-btn" data-cart-remove="${lineKey}" aria-label="Remove item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  const totalQty = cart.reduce((s,c)=>s+c.qty,0);
  const subtotal = cartTotal();
  const delivery = subtotal > 0 ? 60 : 0;
  const total = subtotal + delivery;

  $wrap.html(`
    <div class="cart-layout">
      <div>
        <div class="cart-page-toolbar">
          <span class="cart-item-count">${totalQty} item${totalQty !== 1 ? 's' : ''} in your cart</span>
          <button class="cart-clear-btn" id="cartClearBtn">Clear cart</button>
        </div>
        ${itemsHtml}
      </div>
      <div class="order-summary">
        <h3>Order Summary</h3>
        <div class="sum-row"><span>Subtotal</span><span>${peso(subtotal)}</span></div>
        <div class="sum-row"><span>Delivery fee</span><span>${peso(delivery)}</span></div>
        <div class="sum-row total"><span>Total</span><span>${peso(total)}</span></div>
        <button class="btn btn-primary btn-full" style="margin-top:18px;" data-nav="checkout">Proceed to Checkout</button>
        <div class="order-summary-trust">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 10V8a6 6 0 0 1 12 0v2M5 10h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
          <span>Secure checkout · Pay on delivery/pickup, by card, or via GCash, GoTyme Bank, or Maribank.</span>
        </div>
      </div>
    </div>
  `);
}

function parseLineKey(key){
  const [id, size] = String(key).split('::');
  return { id, size: size || null };
}

$(document).on('click', '[data-cart-action]', function(){
  const { id, size } = parseLineKey($(this).closest('[data-cart-qty]').data('cart-qty'));
  const item = cart.find(c => c.id === id && c.size === size);
  if(!item) return;
  if($(this).data('cart-action') === 'plus') item.qty++;
  else item.qty = Math.max(1, item.qty - 1);
  updateCartCount();
  renderCart();
});

$(document).on('click', '[data-cart-remove]', function(){
  const { id, size } = parseLineKey($(this).data('cart-remove'));
  cart = cart.filter(c => !(c.id === id && c.size === size));
  updateCartCount();
  renderCart();
});

$(document).on('click', '#cartClearBtn', function(){
  if(!cart.length) return;
  if(!window.confirm('Remove all items from your cart?')) return;
  cart = [];
  updateCartCount();
  renderCart();
});

/* ================= CHECKOUT ================= */
$(document).on('click', '[data-fulfillment]', function(){
  $('[data-fulfillment]').removeClass('active');
  $(this).addClass('active');
  fulfillment = $(this).data('fulfillment');
  $('#addressGroup').css('display', fulfillment === 'delivery' ? 'block' : 'none');
  renderCheckoutSummary();
});

/* Placeholder QR images per e-wallet/bank — swap these three files
   (qr-gcash.png, qr-gotyme.png, qr-maribank.png) for the real bank
   QR codes whenever they're ready; nothing else needs to change. */
const PAYMENT_QR = {
  gcash: { src: 'qr-gcash.png', label: 'GCash' },
  gotyme: { src: 'qr-gotyme.png', label: 'GoTyme Bank' },
  maribank: { src: 'qr-maribank.png', label: 'Maribank' }
};

$(document).on('click', '.pay-opt', function(){
  $('.pay-opt').removeClass('active');
  $(this).addClass('active');
  $(this).find('input').prop('checked', true);

  const qrKey = $(this).data('qr');
  const info = qrKey && PAYMENT_QR[qrKey];
  if(info){
    $('#qrDisplayImg').attr('src', info.src).attr('alt', `${info.label} QR code`);
    $('#qrDisplayLabel').text(`Scan this QR using your ${info.label} app to pay.`);
    $('#qrDisplay').addClass('active');
  } else {
    $('#qrDisplay').removeClass('active');
  }
});

/* Tapping the small checkout QR opens it centered and enlarged —
   big enough for a phone camera to scan comfortably, capped so it
   never takes over the whole screen. */
function openQrModal(){
  $('#qrModalImg').attr('src', $('#qrDisplayImg').attr('src')).attr('alt', $('#qrDisplayImg').attr('alt'));
  $('#qrModalLabel').text($('#qrDisplayLabel').text());
  $('#qrOverlay').addClass('open');
}
function closeQrModal(){
  $('#qrOverlay').removeClass('open');
}
$(document).on('click', '#qrDisplayImg', openQrModal);
$(document).on('click', '#qrModalClose', closeQrModal);
$(document).on('click', '#qrOverlay', function(e){
  if(e.target.id === 'qrOverlay') closeQrModal();
});
$(document).on('keydown', function(e){
  if(e.key === 'Escape' && $('#qrOverlay').hasClass('open')) closeQrModal();
});

function renderCheckoutSummary(){
  const subtotal = cartTotal();
  const delivery = fulfillment === 'delivery' && subtotal > 0 ? 60 : 0;
  const total = subtotal + delivery;
  const lines = cart.map(c=>{
    const p = findProduct(c.id);
    const label = p.name + (c.size ? ` (${c.size})` : '') + ` × ${c.qty}`;
    return `<div class="sum-row"><span>${label}</span><span>${peso(p.price*c.qty)}</span></div>`;
  }).join('') || '<div class="sum-row"><span>Your cart is empty</span><span></span></div>';

  $('#checkoutSummary').html(`
    <h3>Order Summary</h3>
    ${lines}
    <div class="sum-row"><span>${fulfillment==='delivery' ? 'Delivery fee' : 'Pickup fee'}</span><span>${peso(delivery)}</span></div>
    <div class="sum-row total"><span>Total</span><span>${peso(total)}</span></div>
    <button class="btn btn-primary btn-full" style="margin-top:18px;" id="placeOrderBtn" ${cart.length===0?'disabled':''}>Place Order</button>
  `);
}

$(document).on('click', '#placeOrderBtn', placeOrder);

async function placeOrder(){
  if(cart.length === 0) return;

  const $form = $('.checkout-layout .form-card').first();
  const customer = {
    name: $form.find('input[type="text"]').val().trim(),
    phone: $form.find('input[type="tel"]').val().trim(),
    email: $form.find('input[type="email"]').val().trim(),
    address: fulfillment === 'delivery' ? $('#addressGroup input').val().trim() : ''
  };
  if(!customer.name || !customer.phone){
    showToast('Please fill in your name and phone number.');
    return;
  }

  const subtotal = cartTotal();
  const deliveryFee = fulfillment === 'delivery' ? 60 : 0;
  const total = subtotal + deliveryFee;
  const items = cart.map(c => {
    const p = findProduct(c.id);
    return { id: p.id, name: p.name, price: p.price, qty: c.qty, size: c.size || null };
  });
  const paymentMethod = $('.pay-opt.active').text().trim();

  const $btn = $('#placeOrderBtn');
  $btn.prop('disabled', true).text('Placing order...');

  try{
    await window.CCAuth.ensureSignedIn();
    const orderPayload = {
      items, totals: { subtotal, deliveryFee, total },
      fulfillment, customer, paymentMethod
    };
    const orderId = await window.CCOrders.createOrder(orderPayload);
    $('#confOrderNum').text('#CC-' + orderId.slice(0,6).toUpperCase());
    $('#confFulfillment').text(fulfillment === 'delivery' ? 'Delivery' : 'Store Pickup');
    $('#confTotal').text(peso(total));
    cart = [];
    updateCartCount();
    navigate('confirmation');
    // Best-effort — the order is already placed at this point, so an
    // email hiccup shouldn't show as a checkout failure to the customer.
    if(customer.email){
      sendOrderConfirmationEmail(orderPayload, orderId);
    }
  } catch(err){
    console.error(err);
    if(String(err.code).includes('admin-restricted-operation') || String(err.code).includes('operation-not-allowed')){
      showToast('Guest checkout isn\'t enabled yet — turn on "Anonymous" sign-in in the Firebase Console.');
    } else {
      showToast('Could not place order. Please try again.');
    }
    $btn.prop('disabled', false).text('Place Order');
  }
}

/* ================= PASSWORD SHOW/HIDE TOGGLE ================= */
/* Swaps type="password" <-> type="text" and keeps focus + cursor
   position intact across the swap — losing those is what usually
   makes a show/hide toggle feel glitchy (cursor jumping to the start,
   or the field losing focus entirely after the type changes). */
$(document).on('click', '[data-password-toggle]', function(){
  const $btn = $(this);
  const input = document.getElementById($btn.data('password-toggle'));
  if(!input) return;

  const wasPassword = input.type === 'password';
  const selStart = input.selectionStart;
  const selEnd = input.selectionEnd;

  input.type = wasPassword ? 'text' : 'password';
  input.focus();
  try { input.setSelectionRange(selStart, selEnd); } catch(err) { /* ignore if unsupported */ }

  $btn.find('.eye-open').toggle(!wasPassword);
  $btn.find('.eye-closed').toggle(wasPassword);
  $btn.attr('aria-pressed', String(wasPassword)).attr('aria-label', wasPassword ? 'Hide password' : 'Show password');
});

/* ================= AUTH FORMS (real Firebase Auth) ================= */
$('#loginForm').on('submit', async function(e){
  e.preventDefault();
  const $btn = $(this).find('button[type="submit"]');
  const email = $(this).find('input[type="email"]').val().trim();
  const password = $('#loginPassword').val();
  $btn.prop('disabled', true).text('Logging in...');
  try{
    const user = await window.CCAuth.loginUser(email, password);
    showToast('Welcome back! Logged in successfully.');
    const verified = await window.CCAuth.isOtpVerified();
    if(!verified){
      goToVerifyEmail(user.email);
    } else {
      navigate('home');
    }
  } catch(err){
    showToast(friendlyAuthError(err));
  } finally {
    $btn.prop('disabled', false).text('Login');
  }
});

$('#registerForm').on('submit', async function(e){
  e.preventDefault();
  const $form = $(this);
  const $btn = $form.find('button[type="submit"]');
  const fullName = $form.find('input[type="text"]').val().trim();
  const email = $form.find('input[type="email"]').val().trim();
  const phone = $form.find('input[type="tel"]').val().trim();
  const password = $('#regPassword').val();
  const confirm = $('#regPasswordConfirm').val();

  if(password !== confirm){
    showToast("Passwords don't match.");
    return;
  }
  $btn.prop('disabled', true).text('Creating account...');
  try{
    const user = await window.CCAuth.registerUser(fullName, email, phone, password);
    showToast(user.otpEmailSent
      ? 'Account created! Check your email for a verification code.'
      : "Account created — but we couldn't send the verification email just now. Tap \"Resend code\" on the next screen to try again.");
    goToVerifyEmail(email, user.otpEmailSent);
  } catch(err){
    showToast(friendlyAuthError(err));
  } finally {
    $btn.prop('disabled', false).text('Create Account');
  }
});

function friendlyAuthError(err){
  const code = err && err.code || '';
  if(code === 'profile-write-failed') return 'Account created, but a browser extension (ad blocker / privacy shield) blocked the connection to the database. Please disable it for this site and try logging in.';
  if(code.includes('email-already-in-use')) return 'That email is already registered.';
  if(code.includes('invalid-email')) return 'Please enter a valid email address.';
  if(code.includes('weak-password')) return 'Password should be at least 6 characters.';
  if(code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) return 'Incorrect email or password.';
  if(code.includes('too-many-requests')) return 'Too many attempts — please wait a moment and try again.';
  return 'Something went wrong. Please try again.';
}

/* ================= OTP VERIFICATION ================= */
let verifyResendCooldown = null;

function goToVerifyEmail(email, justSent){
  $('#verifyEmailAddress').text(email);
  $('#otpError').hide();
  $('.otp-digit').val('').removeClass('otp-error-state');
  navigate('verify-email');
  $('.otp-digit').first().trigger('focus');
  // Only impose the brief "just sent it" cooldown when a code actually
  // went out. If the send failed, let them tap Resend immediately
  // instead of forcing a wait for an email that never arrived.
  startVerifyResendCooldown(justSent === false ? 0 : 30);
}

function startVerifyResendCooldown(seconds){
  const $btn = $('#verifyResendBtn');
  clearInterval(verifyResendCooldown);
  if(seconds <= 0){
    $btn.prop('disabled', false).text('Resend code');
    return;
  }
  let remaining = seconds;
  $btn.prop('disabled', true).text(`Resend code (${remaining}s)`);
  verifyResendCooldown = setInterval(() => {
    remaining--;
    if(remaining <= 0){
      clearInterval(verifyResendCooldown);
      $btn.prop('disabled', false).text('Resend code');
    } else {
      $btn.text(`Resend code (${remaining}s)`);
    }
  }, 1000);
}

/* 6-box code entry: type advances to the next box, backspace on an
   empty box jumps back, and pasting a full code fills every box. */
$(document).on('input', '.otp-digit', function(){
  this.value = this.value.replace(/[^0-9]/g, '').slice(0, 1);
  $('#otpError').hide();
  $('.otp-digit').removeClass('otp-error-state');
  if(this.value) $(this).next('.otp-digit').trigger('focus');
});
$(document).on('keydown', '.otp-digit', function(e){
  if(e.key === 'Backspace' && !this.value) $(this).prev('.otp-digit').trigger('focus');
});
$(document).on('paste', '.otp-digit', function(e){
  const pasted = (e.originalEvent.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
  if(!pasted) return;
  e.preventDefault();
  const $digits = $('.otp-digit');
  pasted.slice(0, $digits.length).split('').forEach((digit, i) => $digits.eq(i).val(digit));
  $digits.eq(Math.min(pasted.length, $digits.length) - 1).trigger('focus');
});

function otpErrorMessage(reason, attemptsLeft){
  switch(reason){
    case 'expired': return 'That code expired. Tap "Resend code" for a new one.';
    case 'too-many-attempts': return 'Too many incorrect attempts. Tap "Resend code" for a new one.';
    case 'incorrect': return `Incorrect code — ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.`;
    case 'no-code': return 'No code on file yet. Tap "Resend code".';
    case 'not-signed-in': return 'Your session needs a moment to reconnect — please try again in a few seconds.';
    default: return 'Something went wrong. Please try again.';
  }
}

$(document).on('click', '#verifyResendBtn', async function(){
  const $btn = $(this);
  $btn.prop('disabled', true).text('Sending...');
  try{
    const { emailSent } = await window.CCAuth.resendOtp();
    $('#otpError').hide();
    $('.otp-digit').val('').removeClass('otp-error-state').first().trigger('focus');
    if(emailSent){
      showToast('New code sent — check your inbox.');
      startVerifyResendCooldown(45);
    } else {
      // Be honest: the code was regenerated in Firestore, but the email
      // itself didn't go out, so don't tell them to go check their inbox.
      showToast("New code generated, but the email didn't go out. Check your connection and tap Resend again in a moment.");
      startVerifyResendCooldown(10); // short cooldown, not the usual 45s, since nothing was actually sent
    }
  } catch(err){
    console.error(err);
    const message = (err && err.message === 'not-signed-in')
      ? 'Your session needs a moment to reconnect — please try again in a few seconds.'
      : 'Could not resend right now. Please try again shortly.';
    showToast(message);
    $btn.prop('disabled', false).text('Resend code');
  }
});

$(document).on('click', '#verifyContinueBtn', async function(){
  const code = $('.otp-digit').map(function(){ return this.value; }).get().join('');
  if(code.length < 6){
    $('#otpError').text('Enter all 6 digits.').show();
    $('.otp-digit').addClass('otp-error-state');
    return;
  }
  const $btn = $(this);
  $btn.prop('disabled', true).text('Verifying...');
  try{
    const result = await window.CCAuth.verifyOtp(code);
    if(result.ok){
      showToast("Email verified — you're all set!");
      // verifyOtp() only updates Firestore — it doesn't touch the nav
      // dot/dropdown, which only refresh on the auth.js onAuthStateChanged
      // listener (login/logout/page load). Re-firing authRoleReady here
      // updates them immediately instead of waiting for the next reload.
      document.dispatchEvent(new CustomEvent("authRoleReady", {
        detail: { user: window.currentUser, role: window.currentRole, otpVerified: true }
      }));
      navigate('home');
    } else {
      $('#otpError').text(otpErrorMessage(result.reason, result.attemptsLeft)).show();
      $('.otp-digit').addClass('otp-error-state');
    }
  } catch(err){
    console.error(err);
    showToast('Could not verify right now. Please try again.');
  } finally {
    $btn.prop('disabled', false).text('Verify & Continue');
  }
});

$(document).on('click', '#verifySkipBtn', function(){
  navigate('home');
});

$(document).on('click', '#accountDdVerifyBtn', function(){
  $('#accountDropdownWrap').removeClass('open');
  goToVerifyEmail(window.currentUser ? window.currentUser.email : '');
});

/* Reflect sign-in state in the nav: show an Admin link for admins,
   and swap the account icon's behavior once we know who's signed in. */
document.addEventListener('authStateReady', function(e){
  const { user } = e.detail;
  const realUser = user && !user.isAnonymous ? user : null;
  $('#accountStatusDot').toggle(!!realUser);
  $('#accountBtn').attr('title', realUser ? `Signed in as ${realUser.displayName || realUser.email}` : 'Not signed in — click to log in')
    .toggleClass('signed-in', !!realUser);
});

/* Verification status arrives slightly later than the base auth state
   (it needs a Firestore read), so the dot/dropdown update here once
   authRoleReady fires rather than in authStateReady above. */
document.addEventListener('authRoleReady', function(e){
  const { user, otpVerified } = e.detail;
  const realUser = user && !user.isAnonymous ? user : null;
  $('#accountStatusDot').toggleClass('unverified', !!(realUser && !otpVerified));
  renderAccountDropdown(realUser, otpVerified);
});

function renderAccountDropdown(user, otpVerified){
  const $content = $('#accountDropdownContent');
  if(!user){ $content.html(''); return; }
  $content.html(`
    <div class="account-dd-name">${user.displayName || 'My Account'}</div>
    <div class="account-dd-email">${user.email}</div>
    ${!otpVerified ? `<button type="button" class="account-dd-unverified" id="accountDdVerifyBtn">Email not verified — tap to verify</button>` : ''}
    <div class="account-dd-divider"></div>
    <button class="btn btn-outline account-dd-logout" id="accountLogoutBtn">Log Out</button>
  `);
}

$(document).on('click', '#accountBtn', function(e){
  e.stopPropagation();
  if(window.currentUser && !window.currentUser.isAnonymous){
    $('#accountDropdownWrap').toggleClass('open');
  } else {
    navigate('login');
  }
});

$(document).on('click', '#accountLogoutBtn', async function(){
  await window.CCAuth.logoutUser();
  $('#accountDropdownWrap').removeClass('open');
  showToast('Logged out.');
  navigate('home');
});

// Click anywhere outside the account dropdown closes it
$(document).on('click', function(e){
  const $wrap = $('#accountDropdownWrap');
  if($wrap.hasClass('open') && !$(e.target).closest('#accountDropdownWrap').length){
    $wrap.removeClass('open');
  }
});

/* ================= CONFIRM DIALOG (replaces window.confirm) ================= */
let confirmResolve = null;

/* Usage: const ok = await showConfirm({ title, message, confirmText, danger });
   Resolves true/false depending on which button was pressed (or false if
   dismissed via backdrop click / Escape). */
function showConfirm({ title = 'Are you sure?', message = "This action can't be undone.", confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}){
  $('#confirmDialogTitle').text(title);
  $('#confirmDialogMsg').text(message);
  $('#confirmDialogOk').text(confirmText).toggleClass('btn-danger', danger).toggleClass('btn-primary', !danger);
  $('#confirmDialogCancel').text(cancelText);
  $('#confirmDialogIcon').toggleClass('danger', danger);
  $('#confirmOverlay').addClass('open');
  return new Promise((resolve) => { confirmResolve = resolve; });
}

function closeConfirm(result){
  $('#confirmOverlay').removeClass('open');
  if(confirmResolve){
    confirmResolve(result);
    confirmResolve = null;
  }
}

$(document).on('click', '#confirmDialogOk', () => closeConfirm(true));
$(document).on('click', '#confirmDialogCancel', () => closeConfirm(false));
$(document).on('click', '#confirmOverlay', function(e){
  if(e.target.id === 'confirmOverlay') closeConfirm(false);
});
$(document).on('keydown', function(e){
  if(e.key === 'Escape' && $('#confirmOverlay').hasClass('open')) closeConfirm(false);
});

/* ================= RESET PASSWORD MODAL ================= */
$(document).on('click', '#forgotPasswordLink', function(){
  $('#resetPasswordEmail').val($('#loginEmail').val().trim());
  $('#resetPasswordOverlay').addClass('open');
  $('#resetPasswordEmail').trigger('focus');
});

function closeResetPasswordModal(){
  $('#resetPasswordOverlay').removeClass('open');
  $('#resetPasswordForm')[0].reset();
}

$(document).on('click', '#resetPasswordCancel', closeResetPasswordModal);
$(document).on('click', '#resetPasswordOverlay', function(e){
  if(e.target.id === 'resetPasswordOverlay') closeResetPasswordModal();
});
$(document).on('keydown', function(e){
  if(e.key === 'Escape' && $('#resetPasswordOverlay').hasClass('open')) closeResetPasswordModal();
});

$(document).on('submit', '#resetPasswordForm', async function(e){
  e.preventDefault();
  const email = $('#resetPasswordEmail').val().trim();
  const $btn = $('#resetPasswordSubmit');
  $btn.prop('disabled', true).text('Sending...');
  try{
    await window.CCAuth.sendResetPasswordEmail(email);
    showToast("If that email has an account, we've sent a reset link.");
    closeResetPasswordModal();
  } catch(err){
    console.error(err);
    showToast('Could not send the reset link right now. Please try again.');
  } finally {
    $btn.prop('disabled', false).text('Send Link');
  }
});

/* ================= SCROLL PROGRESS BAR ================= */
function initScrollProgress(){
  const bar = document.getElementById('scrollProgress');
  if(!bar) return;
  window.addEventListener('scroll', ()=>{
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? scrollTop / docHeight : 0;
    bar.style.transform = `scaleX(${pct})`;
  });
}

/* ================= NAV: SHRINK + SHADOW ON SCROLL ================= */
function initNavScroll(){
  const header = document.querySelector('header.site-nav');
  if(!header) return;
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive:true });
  onScroll();
}

/* ================= PRODUCT CARD: SUBTLE 3D TILT ================= */
/* Only .product-card gets the tilt — .cat-card is deliberately flat/
   editorial by design (see its CSS comment), so it's left alone. */
function initCardTilt(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(window.matchMedia('(hover: none)').matches) return; // skip on touch devices
  const maxTilt = 6;
  $(document).on('mouseenter', '.product-card', function(){
    this.style.transition = 'transform 0.1s ease-out, box-shadow 0.4s var(--ease-premium), border-color 0.4s ease';
  });
  $(document).on('mousemove', '.product-card', function(e){
    const rect = this.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    this.style.transform = `perspective(800px) rotateX(${(-py*maxTilt).toFixed(2)}deg) rotateY(${(px*maxTilt).toFixed(2)}deg) translateY(-4px)`;
  });
  $(document).on('mouseleave', '.product-card', function(){
    this.style.transition = '';
    this.style.transform = '';
  });
}

/* ================= ABOUT SECTION: ANIMATED STAT COUNTERS ================= */
/* Counts up any "<strong>" inside .about-stats from 0 to its printed
   value once it scrolls into view. Reads the number out of the existing
   text so it keeps whatever prefix/suffix is already there (e.g. "12k+"). */
function initStatCounters(){
  const nodes = document.querySelectorAll('.about-stats strong:not([data-counted])');
  if(!nodes.length) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting) return;
      const el = entry.target;
      obs.unobserve(el);
      el.setAttribute('data-counted', '1');
      const raw = el.textContent;
      const match = raw.match(/[\d.,]+/);
      if(!match || reduceMotion) return;
      const numStr = match[0];
      const target = parseFloat(numStr.replace(/,/g, ''));
      if(isNaN(target)) return;
      const prefix = raw.slice(0, match.index);
      const suffix = raw.slice(match.index + numStr.length);
      const hasComma = numStr.includes(',');
      const duration = 1100;
      const start = performance.now();
      function tick(now){
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        const val = Math.round(target * eased);
        el.textContent = prefix + (hasComma ? val.toLocaleString('en-US') : val) + suffix;
        if(t < 1) requestAnimationFrame(tick);
        else el.textContent = raw;
      }
      requestAnimationFrame(tick);
    });
  }, { threshold:0.4 });
  nodes.forEach(n => obs.observe(n));
}

/* ================= ADD TO CART: FLY-TO-CART MICRO-INTERACTION ================= */
/* Clones the product image and animates it flying into the cart icon,
   then gives the cart icon a little bounce — a small, tactile confirmation
   that something was actually added, instead of just a toast. */
function flyToCart(sourceImgEl){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cartBtn = document.getElementById('cartBtn');
  if(!cartBtn || !sourceImgEl) return;
  const srcRect = sourceImgEl.getBoundingClientRect();
  const dstRect = cartBtn.getBoundingClientRect();
  if(srcRect.width === 0 || srcRect.height === 0) return;

  const clone = sourceImgEl.cloneNode(true);
  clone.classList.add('fly-to-cart-clone');
  Object.assign(clone.style, {
    position:'fixed',
    left: srcRect.left + 'px',
    top: srcRect.top + 'px',
    width: srcRect.width + 'px',
    height: srcRect.height + 'px',
    margin:0,
    zIndex:999,
    pointerEvents:'none',
    borderRadius:'12px',
    objectFit:'cover',
    boxShadow:'var(--shadow-lift)'
  });
  document.body.appendChild(clone);

  const dx = (dstRect.left + dstRect.width/2) - (srcRect.left + srcRect.width/2);
  const dy = (dstRect.top + dstRect.height/2) - (srcRect.top + srcRect.height/2);

  requestAnimationFrame(()=>{
    clone.style.transition = 'transform 0.6s cubic-bezier(0.16,1,0.3,1), opacity 0.6s ease';
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.1)`;
    clone.style.opacity = '0.3';
  });

  const cleanup = () => {
    clone.remove();
    cartBtn.classList.add('cart-bump');
    setTimeout(()=> cartBtn.classList.remove('cart-bump'), 400);
  };
  clone.addEventListener('transitionend', cleanup, { once:true });
  setTimeout(cleanup, 700); // safety net in case transitionend never fires
}

/* ================= TERMS & PRIVACY MODAL ================= */
function openLegalModal(which){
  $('.legal-tab').removeClass('active');
  $(`.legal-tab[data-legal-tab="${which}"]`).addClass('active');
  $('.legal-panel').removeClass('active');
  $(`.legal-panel[data-legal-panel="${which}"]`).addClass('active');
  $('#legalBody').scrollTop(0);
  $('#legalOverlay').addClass('open');
  $('body').css('overflow', 'hidden');
}

function closeLegalModal(){
  if(!$('#legalOverlay').hasClass('open')) return;
  $('#legalOverlay').removeClass('open');
  $('body').css('overflow', '');
}

$(document).on('click', '[data-legal]', function(e){
  e.preventDefault();
  openLegalModal($(this).data('legal'));
});

$(document).on('click', '.legal-tab', function(){
  const which = $(this).data('legal-tab');
  $('.legal-tab').removeClass('active');
  $(this).addClass('active');
  $('.legal-panel').removeClass('active');
  $(`.legal-panel[data-legal-panel="${which}"]`).addClass('active');
  $('#legalBody').scrollTop(0);
});

$(document).on('click', '#legalClose, #legalAccept', closeLegalModal);

// Clicking the dimmed backdrop (not the card itself) closes it
$(document).on('click', '#legalOverlay', function(e){
  if(e.target === this) closeLegalModal();
});

/* ================= FAQ ACCORDION ================= */
$(document).on('click', '.faq-question', function(){
  $(this).closest('.faq-item').toggleClass('open');
});

/* ================= CONTACT FORM ================= */
$(document).on('submit', '#contactForm', async function(e){
  e.preventDefault();
  const $form = $(this);
  const $btn = $form.find('button[type="submit"]');
  const payload = {
    name: $('#cName').val().trim(),
    email: $('#cEmail').val().trim(),
    subject: $('#cSubject').val().trim(),
    message: $('#cMessage').val().trim()
  };
  console.log('Contact form submitted:', payload);
  showToast('Message received — we\'ll get back to you soon.');
  this.reset();
});

/* ================= SCROLL REVEAL ================= */
function initReveal(){
  const items = document.querySelectorAll('.page.active .reveal:not(.in)');
  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('in');
        obs.unobserve(entry.target);
      }
    });
  }, {threshold:0.12});
  items.forEach(i => obs.observe(i));
}

/* ================= INIT ================= */
/* Renders every PRODUCTS-dependent section. Called once with cached/seed
   data (instant paint) and again once the live Firestore fetch resolves
   (so prices/stock/new items stay accurate) — cheap enough to re-run. */
function renderAll(){
  renderBestSellers();
  renderMenuPage();
  renderMerchPage();
}

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

$(async function(){
  // Categories, reviews, cart count, and scroll effects don't depend on
  // Firestore data at all — render them immediately instead of waiting
  // on a network round trip. This is what previously made the whole
  // page look blank for a few seconds.
  renderCategories();
  renderReviews();
  updateCartCount();
  initReveal();
  initScrollProgress();

  // If we have a cached product list from a previous visit, paint with
  // it right away so the product grids aren't blank while we wait on
  // the network — then quietly refresh once live data arrives.
  const cached = window.CCProducts.getCachedProducts();
  if(cached && cached.length){
    PRODUCTS = cached;
    renderAll();
  }

  await loadProductsFromFirestore();
  renderAll();
});
