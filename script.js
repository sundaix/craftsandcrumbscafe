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
// Flat delivery fee, admin-configurable (Admin > Settings). Starts at the
// same value that used to be hardcoded here, and is overwritten by the
// cached/live value from settings-service.js during init below.
let DELIVERY_FEE = 60;
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
let cartOwnerUid = null; // uid whose cart is currently loaded into `cart` — null while signed out

/* Raw combo records from Firestore (name, desc, img, drinkId, pastryId,
   discountPercent, active) and the "product-shaped" versions derived
   from them — see buildComboProducts() further down. Kept as separate
   arrays from PRODUCTS/PRODUCTS-derived state rather than merged in,
   so the Menu/Merch grids and the admin Products table never
   accidentally pick up a combo as if it were a real catalog item. */
let COMBOS = [];
let COMBO_PRODUCTS = [];

function persistCart(){
  if(!cartOwnerUid) return;
  window.CCCart.saveCart(cartOwnerUid, cart);
}

function mergeCarts(base, incoming){
  const merged = base.map(c => ({ ...c }));
  incoming.forEach(line => {
    const match = merged.find(c => c.id === line.id && c.size === line.size);
    if(match){ match.qty += line.qty; } else { merged.push({ ...line }); }
  });
  return merged;
}

function rerenderActiveCartPage(){
  const activePage = $('.page.active').data('page');
  if(activePage === 'cart') renderCart();
  if(activePage === 'checkout') renderCheckoutSummary();
}

/* Called from authStateReady on every login/logout/page load. Cart
   now lives in Firestore (cart-service.js) instead of localStorage,
   so the same cart shows up on web and mobile. */
async function syncCartToAccount(realUser){
  if(realUser){
    if(cartOwnerUid === realUser.uid) return; // already this account's cart, nothing to do
    const saved = await window.CCCart.fetchCart(realUser.uid);
    cart = mergeCarts(saved, cart); // keep anything just added as a guest, add back what was saved
    cartOwnerUid = realUser.uid;
    persistCart();
    updateCartCount();
    rerenderActiveCartPage();
    return;
  }
  // No real (non-anonymous) user right now. Only clear the cart if an
  // account was actually just signed OUT of — guest checkout also
  // triggers this listener via ensureSignedIn()'s anonymous sign-in,
  // and that must NOT wipe items a guest already added.
  if(cartOwnerUid === null) return;
  cartOwnerUid = null;
  cart = [];
  updateCartCount();
  rerenderActiveCartPage();
}
let currentProductId = SEED_PRODUCTS[0].id;
let pdQty = 1;
let pdSize = null;
let menuFilter = 'Coffee';
let menuSearch = '';
let menuSort = 'featured';
let merchFilter = 'Shirts';
let merchSearch = '';
let merchSort = 'featured';
let fulfillment = 'delivery';

let wishlist = []; // array of product ids
let wishlistOwnerUid = null; // uid whose wishlist is currently loaded — null while signed out

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

/* Wearable categories that price flat but track stock per size (see
   the seed data above, where each has a `sizes: ['XS','S',...]`
   array). Used by the admin Add/Edit form's stock-per-size UI and by
   the "Flatten Size Pricing" legacy cleanup tool — it does NOT include
   Coffee/Non-Coffee/Tea, which intentionally DO price per size
   (12oz/16oz/20oz) and must never be "flattened" back to one price. */
const SIZED_CATEGORIES = ['Shirts', 'Caps', 'Shorts', 'Socks'];
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
const findProduct = id => PRODUCTS.find(p => p.id === id) || COMBO_PRODUCTS.find(p => p.id === id);
const escapeHtml = str => $('<div>').text(str == null ? '' : str).html();

/* Normalizes a product's `sizes` field to `[{size, price, stock}, ...]`
   no matter which shape it's actually in:
   - plain string ('S') — legacy/seed data, flat price, no stock tracked
   - {size, price} — drinks (Coffee/Non-Coffee/Tea): 12oz/16oz/20oz each
     priced independently; stock isn't tracked per size for these
   - {size, stock} — wearables (Shirts/Caps/Shorts/Socks): one flat
     price, stock tracked per size
   `stock: null` means stock isn't tracked for that size at all, which
   the storefront treats as always available (never crossed out). */
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

/* True when a specific size is out of stock — only ever true when
   that size actually has stock tracked (stock isn't null) and it's
   down to zero or below. A size with no stock tracking at all is
   always treated as available. */
function isSizeOutOfStock(p, sizeLabel){
  const opts = getSizeOptions(p);
  const match = opts.find(o => o.size === sizeLabel);
  return !!match && match.stock !== null && match.stock <= 0;
}

/* Single source of truth for "is this product out of stock", shared by
   every customer-facing surface (grid cards, quick add, product detail
   page) so they always agree with each other AND with the admin
   dashboard's stock badge (admin.js), which is built from these same
   two stock shapes:
   - Per-size tracked (wearables — Shirts/Caps/Shorts/Socks): out of
     stock only once every size that actually tracks stock is at 0 or
     below. Sizes with stock:null (untracked) don't count either way.
   - Flat top-level stock (drinks, food, ToteBags/Bracelets/Keychains):
     out of stock when p.stock is a tracked number <= 0.
   A product with no stock tracked anywhere (p.stock is null/undefined
   and no sizes track stock) is always treated as available — same as
   the admin table's "—" badge. */
function isProductOutOfStock(p){
  const trackedSizes = getSizeOptions(p).filter(o => o.stock !== null);
  if(trackedSizes.length) return trackedSizes.every(o => o.stock <= 0);
  return typeof p.stock === 'number' && p.stock <= 0;
}

function getPriceForSize(p, sizeLabel){
  const opts = getSizeOptions(p);
  if(!opts.length) return p.price;
  const match = opts.find(o => o.size === sizeLabel);
  return match ? match.price : opts[0].price;
}

/* The price to show before a size is picked — the lowest of the
   available sizes, e.g. a latte that runs ₱139–₱179 just shows ₱139. */
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

/* Drinks show a range across their three sizes (e.g. "₱139–₱179");
   everything else (one flat price, sized or not) shows a single
   number. */
function priceLabel(p){
  if(hasVariablePricing(p)){
    const opts = getSizeOptions(p);
    const min = Math.min(...opts.map(o => o.price));
    const max = Math.max(...opts.map(o => o.price));
    return `${peso(min)}–${peso(max)}`;
  }
  return peso(getDisplayPrice(p));
}

/* Shared by the Menu and Merchandise grids. "Featured" keeps the
   catalog's natural order but pulls best sellers to the front — it's
   the closest thing this app has to a popularity signal without a real
   sales-analytics pipeline behind it. "Newest" relies on createdAt,
   which only admin-added products have (see products-services.js /
   admin.js) — older seed products fall back to the end of that sort. */
function sortProducts(items, sortValue){
  const list = [...items];
  const toMs = (val) => {
    if(!val) return 0;
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed;
  };
  switch(sortValue){
    case 'price-asc': return list.sort((a,b) => a.price - b.price);
    case 'price-desc': return list.sort((a,b) => b.price - a.price);
    case 'name-asc': return list.sort((a,b) => a.name.localeCompare(b.name));
    case 'newest': return list.sort((a,b) => toMs(b.createdAt) - toMs(a.createdAt));
    case 'featured':
    default:
      return list.sort((a,b) => {
        const ai = BEST_SELLER_IDS.indexOf(a.id), bi = BEST_SELLER_IDS.indexOf(b.id);
        if(ai === -1 && bi === -1) return 0;
        if(ai === -1) return 1;
        if(bi === -1) return -1;
        return ai - bi;
      });
  }
}

/* ================= WISHLIST ================= */
function isWishlisted(id){
  return wishlist.includes(id);
}

function persistWishlist(){
  if(!wishlistOwnerUid) return;
  window.CCWishlist.saveWishlist(wishlistOwnerUid, wishlist);
}

/* Wishlisting requires a real account (not guest/anonymous) since it's
   saved per-user in Firestore — unlike the cart, there's no local-first
   guest version of this, so signed-out taps just prompt a login. */
function toggleWishlist(id){
  if(!window.currentUser || window.currentUser.isAnonymous){
    showToast('Please log in to save favorites.', 'warning');
    navigate('login');
    return;
  }
  const adding = !wishlist.includes(id);
  if(adding){
    wishlist.push(id);
  } else {
    wishlist = wishlist.filter(x => x !== id);
  }
  persistWishlist();
  $(`[data-wishlist-toggle="${id}"]`).toggleClass('active', wishlist.includes(id))
    .find('svg').attr('fill', wishlist.includes(id) ? 'currentColor' : 'none');
  if($('.page[data-page="wishlist"]').hasClass('active')) renderWishlistPage();
  // Confirms the tap actually did something — the heart icon fills in,
  // but that's easy to miss on a quick tap, especially on mobile.
  const label = findProduct(id) ? findProduct(id).name : 'Item';
  showToast(adding ? `Added to favorites · ${label}` : `Removed from favorites · ${label}`, 'cart');
}

/* Called from authStateReady alongside syncCartToAccount. */
async function syncWishlistToAccount(realUser){
  if(realUser){
    if(wishlistOwnerUid === realUser.uid) return;
    wishlist = await window.CCWishlist.fetchWishlist(realUser.uid);
    wishlistOwnerUid = realUser.uid;
    if($('.page[data-page="wishlist"]').hasClass('active')) renderWishlistPage();
    return;
  }
  if(wishlistOwnerUid === null) return;
  wishlistOwnerUid = null;
  wishlist = [];
}

function renderWishlistPage(){
  const $grid = $('#wishlistGrid');
  const items = [...PRODUCTS, ...COMBO_PRODUCTS].filter(p => wishlist.includes(p.id));
  if(!items.length){
    $('#wishlistCount').text('');
    $('#wishlistClearBtn').hide();
    $grid.html(`
      <div class="empty-favorites">
        <div class="empty-favorites-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 21s-7.5-4.6-10-9.3C.6 8.1 2.4 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.6.5 5.4 4.1 4 7.7C19.5 16.4 12 21 12 21z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </div>
        <h3>No favorites yet</h3>
        <p>Tap the heart on anything you love and it'll be saved here for next time.</p>
        <div class="empty-favorites-actions">
          <button class="btn btn-primary" data-nav="menu">Browse Menu</button>
          <button class="btn btn-outline" data-nav="merchandise">Browse Merchandise</button>
        </div>
      </div>
    `);
    return;
  }
  $('#wishlistCount').text(`${items.length} item${items.length === 1 ? '' : 's'} saved`);
  $('#wishlistClearBtn').show();
  $grid.html(items.map(p => p.comboMeta ? comboCard(p) : productCard(p)).join(''));
  initReveal();
}

/* ================= COMBOS ================= */
/* Turns each raw combo doc (name, desc, img, drinkId, pastryId,
   discountPercent, active) into a "product" — same {sizes, price,
   stock} shape a real drink already has — so every piece of storefront
   machinery that already knows how to handle a sized product (price
   display, size picker, add to cart, stock checks, cart line items,
   checkout, order history) works on a combo completely unmodified.
   The one addition is `comboMeta`, read in exactly two places: the
   home page combo card (to show the discount + original price) and
   placeOrder (to expand a combo line into its two real stock
   decrements at checkout — see placeOrder below).

   Only combos whose linked drink AND pastry both still exist end up
   in COMBO_PRODUCTS — if either product was deleted from the catalog,
   the combo silently drops off the storefront rather than crashing or
   showing a broken card. Re-run whenever PRODUCTS or COMBOS changes
   (product prices/stock updated, or a combo added/edited/toggled). */
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

async function loadCombosFromFirestore(){
  try{
    COMBOS = await window.CCCombos.fetchAllCombos();
  } catch(err){
    console.error('Could not load combos from Firestore.', err);
    COMBOS = [];
  }
  buildComboProducts();
}

/* The struck-through "before discount" price shown next to a combo's
   discounted price — mirrors priceLabel()'s single-value-vs-range
   logic, just built from comboMeta.originalSizes instead of p.sizes. */
function comboOriginalPriceLabel(p){
  const sizes = p.comboMeta && p.comboMeta.originalSizes;
  if(!sizes || !sizes.length) return '';
  const min = Math.min(...sizes.map(s => s.price));
  const max = Math.max(...sizes.map(s => s.price));
  return min === max ? peso(min) : `${peso(min)}–${peso(max)}`;
}

/* Same struck-through original price, but for one specific chosen
   size — used once a drink size is actually picked on the combo's
   product detail page, instead of showing the full range. */
function comboOriginalPriceForSize(p, size){
  const sizes = p.comboMeta && p.comboMeta.originalSizes;
  if(!sizes || !sizes.length) return '';
  const match = sizes.find(s => s.size === size);
  return match ? peso(match.price) : comboOriginalPriceLabel(p);
}

function comboCard(p, i=0){
  const saved = isWishlisted(p.id);
  const oos = isProductOutOfStock(p);
  return `
    <div class="product-card combo-card reveal${oos ? ' oos' : ''}" style="--i:${i}">
      <div class="product-img" data-open-product="${p.id}">
        <img src="${p.img}" alt="${p.name}">
        <span class="combo-discount-badge">${p.comboMeta.discountPercent}% off</span>
        ${oos ? '<span class="oos-badge">Out of Stock</span>' : ''}
        <button type="button" class="wishlist-btn ${saved ? 'active' : ''}" data-wishlist-toggle="${p.id}" aria-label="${saved ? 'Remove from favorites' : 'Save to favorites'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${saved ? 'currentColor' : 'none'}"><path d="M12 21s-7.5-4.6-10-9.3C.6 8.1 2.4 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.6.5 5.4 4.1 4 7.7C19.5 16.4 12 21 12 21z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="product-info">
        <div class="product-name" data-open-product="${p.id}">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-footer">
          <span class="combo-price-group">
            <span class="combo-price-original">${comboOriginalPriceLabel(p)}</span>
            <span class="price">${priceLabel(p)}</span>
          </span>
          <button class="add-btn" data-quick-add="${p.id}" aria-label="${oos ? 'Out of stock' : 'Add to cart'}" ${oos ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderFeaturedCombos(){
  const $section = $('#featuredCombosSection');
  if(!$section.length) return;
  if(!COMBO_PRODUCTS.length){
    $section.hide();
    return;
  }
  $section.show();
  $('#featuredCombosGrid').html(COMBO_PRODUCTS.map(comboCard).join(''));
  initReveal();
}

$(document).on('click', '#wishlistClearBtn', function(){
  if(!window.confirm('Remove all favorites?')) return;
  wishlist = [];
  persistWishlist();
  renderWishlistPage();
});

$(document).on('click', '[data-wishlist-toggle]', function(e){
  e.stopPropagation();
  toggleWishlist($(this).data('wishlist-toggle'));
});

/* Centered, temporary notification dialog used across the whole site
   (customer pages + admin dashboard both call this same function).
   type controls the icon glyph + accent color:
     'success' (default) — sage check, completed positive actions
     'cart'    — caramel cup, added-to-cart/wishlist confirmations
     'warning' — caramel alert, "please do X" prompts
     'error'   — red alert, something failed
     'info'    — dusty-blue info, neutral status updates
   duration is how long it stays up (ms) before auto-dismissing. */
const TOAST_ICONS = {
  success: '<path d="M4 12l5 5L20 6"/>',
  cart:    '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v7a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/>',
  warning: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.42 0z"/>',
  error:   '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5l5 5"/><path d="M14.5 9.5l-5 5"/>',
  info:    '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>'
};

function showToast(msg, type='success', duration=2400){
  const $t = $('#toast');
  const $veil = $('#toastVeil');
  const iconType = TOAST_ICONS[type] ? type : 'success';

  $('#toastMsg').text(msg);
  $t.attr('class', 'toast show type-' + iconType);
  $('#toastIconSvg').html(TOAST_ICONS[iconType]);
  $veil.addClass('show');

  // Restart the depletion-bar animation from scratch even if a toast
  // is already showing — without the reflow trick the browser just
  // keeps the previous run's animation going instead of resetting it.
  const $bar = $('#toastTimerBar');
  $bar.css('animation', 'none');
  $bar[0].offsetHeight;
  $bar.css('animation', `toastTimerShrink ${duration}ms linear forwards`);

  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    $t.removeClass('show').addClass('hide');
    $veil.removeClass('show');
  }, duration);
}

function addToCart(id, qty=1, size=null){
  const existing = cart.find(c => c.id === id && c.size === size);
  if(existing){ existing.qty += qty; } else { cart.push({id, qty, size}); }
  updateCartCount();
  const label = findProduct(id).name + (size ? ` (${size})` : '');
  showToast('Added to cart · ' + label, 'cart');
}

function updateCartCount(){
  persistCart();
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
            <span>${c.qty} × ${peso(getPriceForSize(p, c.size))}</span>
            <span style="display:flex; align-items:center; gap:8px;">
              ${peso(getPriceForSize(p, c.size)*c.qty)}
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
  return cart.reduce((s,c)=> s + getPriceForSize(findProduct(c.id), c.size) * c.qty, 0);
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

  /* The header search box is only meant for Home — Menu and
     Merchandise already have their own inline "Looking for..."
     search, and it has no real job on FAQs, Contact, the account
     pages, or the Admin dashboard, so hide it everywhere except
     Home. */
  $('.header-search').toggleClass('is-hidden', pageName !== 'home');

  if(pageName === 'admin' && window.currentRole !== 'admin'){
    showToast('Admin access only. Please log in as an admin.', 'warning');
    $('.page').removeClass('active');
    $('.page[data-page="home"]').addClass('active');
    return;
  }
  if(pageName === 'admin' && typeof renderAdminDashboard === 'function'){
    renderAdminDashboard();
  }
  if(pageName === 'checkout' && !window.currentUser){
    showToast('Please log in to check out.', 'warning');
    $('.page').removeClass('active');
    $('.page[data-page="login"]').addClass('active');
    return;
  }
  if(pageName === 'order-history' && (!window.currentUser || window.currentUser.isAnonymous)){
    showToast('Please log in to view your orders.', 'warning');
    $('.page').removeClass('active');
    $('.page[data-page="login"]').addClass('active');
    return;
  }
  if(pageName === 'wishlist' && (!window.currentUser || window.currentUser.isAnonymous)){
    showToast('Please log in to view your favorites.', 'warning');
    $('.page').removeClass('active');
    $('.page[data-page="login"]').addClass('active');
    return;
  }
  if(pageName === 'product') renderProductDetail();
  if(pageName === 'cart') renderCart();
  if(pageName === 'checkout') renderCheckoutSummary();
  if(pageName === 'order-history') renderOrderHistory();
  if(pageName === 'wishlist') renderWishlistPage();
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
  buildComboProducts();
  if(!$(`.page[data-page="${pageName}"]`).hasClass('active')) return; // user already navigated away
  if(pageName === 'cart') renderCart();
  if(pageName === 'checkout') renderCheckoutSummary();
}

async function renderOrderHistory(){
  const $list = $('#orderHistoryList');
  $list.html('<p class="order-history-empty">Loading your orders...</p>');
  if(!window.currentUser) return;

  let orders;
  try{
    orders = await window.CCOrders.fetchMyOrders(window.currentUser.uid);
  } catch(err){
    console.error(err);
    $list.html('<p class="order-history-empty">Could not load your orders. Please try again.</p>');
    return;
  }

  if(!orders.length){
    $list.html('<p class="order-history-empty">No orders yet — once you place one, it\'ll show up here.</p>');
    return;
  }

  const toDate = (val) => {
    if(!val) return '';
    const ms = typeof val.seconds === 'number' ? val.seconds * 1000 : new Date(val).getTime();
    return isNaN(ms) ? '' : new Date(ms).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' });
  };

  const rows = orders.map(o => {
    const status = o.status || 'pending';
    const itemsText = (o.items || []).map(it => `${it.name}${it.size ? ` (${it.size})` : ''} × ${it.qty}`).join(', ');
    return `
      <div class="order-card">
        <div class="order-card-head">
          <span class="order-card-num">#${o.id.slice(0,6).toUpperCase()}</span>
          <span class="order-status-badge order-status-${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
        </div>
        <p class="order-card-items">${itemsText}</p>
        ${orderStatusTracker(status)}
        <div class="order-card-foot">
          <span>${toDate(o.createdAt)} · ${o.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}</span>
          <span class="order-card-total">${peso(o.totals?.total || 0)}</span>
        </div>
      </div>
    `;
  }).join('');
  $list.html(rows);
}

/* Visual step tracker for order history — mirrors the status values the
   admin dashboard's dropdown writes (pending/preparing/ready/completed/
   cancelled, see orders-service.js + admin.js). Cancelled breaks out of
   the linear flow entirely rather than showing a "stuck" progress bar. */
const ORDER_STAGES = [
  { key:'pending', label:'Pending' },
  { key:'preparing', label:'Preparing' },
  { key:'ready', label:'Ready' },
  { key:'completed', label:'Completed' }
];

function orderStatusTracker(status){
  if(status === 'cancelled'){
    return `<div class="order-tracker-cancelled">This order was cancelled.</div>`;
  }
  const idx = Math.max(0, ORDER_STAGES.findIndex(s => s.key === status));
  return `
    <div class="order-tracker">
      ${ORDER_STAGES.map((s,i) => `
        <div class="order-tracker-step ${i <= idx ? 'done' : ''} ${i === idx ? 'current' : ''}">
          <span class="order-tracker-dot"></span>
          <span class="order-tracker-label">${s.label}</span>
        </div>
      `).join('')}
    </div>
  `;
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
  const saved = isWishlisted(p.id);
  const oos = isProductOutOfStock(p);
  return `
    <div class="product-card reveal${oos ? ' oos' : ''}" style="--i:${i}">
      <div class="product-img" data-open-product="${p.id}">
        <img src="${p.img}" alt="${p.name}">
        ${oos ? '<span class="oos-badge">Out of Stock</span>' : ''}
        <button type="button" class="wishlist-btn ${saved ? 'active' : ''}" data-wishlist-toggle="${p.id}" aria-label="${saved ? 'Remove from favorites' : 'Save to favorites'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${saved ? 'currentColor' : 'none'}"><path d="M12 21s-7.5-4.6-10-9.3C.6 8.1 2.4 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.6.5 5.4 4.1 4 7.7C19.5 16.4 12 21 12 21z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="product-info">
        <div class="product-name" data-open-product="${p.id}">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-footer">
          <span class="price">${priceLabel(p)}</span>
          <button class="add-btn" data-quick-add="${p.id}" aria-label="${oos ? 'Out of stock' : 'Add to cart'}" ${oos ? 'disabled' : ''}>
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
  const oos = isProductOutOfStock(p);
  return `
    <div class="product-card best-card${oos ? ' oos' : ''}" style="--i:${i}">
      <div class="product-img" data-open-product="${p.id}">
        <span class="bestseller-tag">${String(i+1).padStart(2,'0')}</span>
        <img src="${p.img}" alt="${p.name}">
        ${oos ? '<span class="oos-badge">Out of Stock</span>' : ''}
        <div class="best-card-shade"></div>
      </div>
      <div class="product-info">
        <span class="eyebrow best-eyebrow">${p.cat}</span>
        <div class="product-name" data-open-product="${p.id}">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-footer">
          <span class="price">${priceLabel(p)}</span>
          <button class="add-btn" data-quick-add="${p.id}" aria-label="${oos ? 'Out of stock' : 'Add to cart'}" ${oos ? 'disabled' : ''}>
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
  if(isProductOutOfStock(p)){
    showToast('This item is out of stock.', 'warning');
    return;
  }
  const opts = getSizeOptions(p);
  if(opts.length > 1){
    currentProductId = id;
    navigate('product');
    showToast('Please select a size', 'warning');
    return;
  }
  addToCart(id, 1, opts.length === 1 ? opts[0].size : null);
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
      <div class="sidebar-group-items">
        ${g.items.map(it => `<a class="sidebar-link ${menuFilter===it.cat?'active':''}" data-menu-cat="${it.cat}">${it.label}</a>`).join('')}
      </div>
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
  items = sortProducts(items, menuSort);
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
  $('#menuSort').val(menuSort);
}

$(document).on('input', '#menuSearch', function(){
  menuSearch = $(this).val();
  renderMenuGrid();
});

$(document).on('change', '#menuSort', function(){
  menuSort = $(this).val();
  renderMenuGrid();
});

/* ================= RENDER: MERCHANDISE ================= */
function renderMerchSidebar(){
  const html = MERCH_SIDEBAR.map(g => `
    <div class="sidebar-group${g.group ? '' : ' sidebar-group-untitled'}">
      ${g.group ? `<div class="sidebar-group-title">${g.group}</div>` : ''}
      <div class="sidebar-group-items">
        ${g.items.map(it => `<a class="sidebar-link ${merchFilter===it.cat?'active':''}" data-merch-cat="${it.cat}">${it.label}</a>`).join('')}
      </div>
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
  items = sortProducts(items, merchSort);
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
  $('#merchSort').val(merchSort);
}

$(document).on('input', '#merchSearch', function(){
  merchSearch = $(this).val();
  renderMerchGrid();
});

$(document).on('change', '#merchSort', function(){
  merchSort = $(this).val();
  renderMerchGrid();
});

/* ================= RENDER: PRODUCT DETAIL ================= */
/* Renders the size selector (any product with a `sizes` array — both
   wearables with a SIZE_CHARTS fit guide and drinks with plain
   12oz/16oz/20oz pricing), the ingredients/allergens block (any
   product with `ingredients` — food AND drinks), or both together for
   a sized drink. Other merch (totes, bracelets, keychains) gets
   neither. */
function renderPdSecondary(p){
  const chart = SIZE_CHARTS[p.cat];
  let sizingHtml = '';
  if(p.sizes && p.sizes.length){
    const opts = getSizeOptions(p);
    const singleSize = opts.length === 1;
    const variable = hasVariablePricing(p);
    sizingHtml = `
      <div class="pd-sizing">
        <div class="pd-sizing-head">
          <h4>${singleSize ? 'Size' : 'Select Size'}</h4>
          ${p.fit ? `<span class="pd-fit-tag">${p.fit}</span>` : ''}
        </div>
        ${singleSize ? `
          <div class="size-chip active${opts[0].stock !== null && opts[0].stock <= 0 ? ' size-chip-oos' : ''}" data-pd-size="${opts[0].size}">
            <span class="size-chip-label">${opts[0].size}</span>
            ${opts[0].stock !== null && opts[0].stock <= 0 ? '<span class="size-chip-oos-label">Out of stock</span>' : ''}
          </div>
        ` : `
          <div class="size-chip-row" id="pdSizeRow">
            ${opts.map(o => {
              const oos = o.stock !== null && o.stock <= 0;
              return `<button type="button" class="size-chip${oos ? ' size-chip-oos' : ''}" data-pd-size="${o.size}" ${oos ? 'disabled' : ''}>
                <span class="size-chip-label">${o.size}</span>${variable ? `<span class="size-chip-price">${peso(o.price)}</span>` : ''}
                ${oos ? '<span class="size-chip-oos-label">Out of stock</span>' : ''}
              </button>`;
            }).join('')}
          </div>
        `}
        ${chart ? `
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
        ` : ''}
      </div>
    `;
  }
  let infoHtml = '';
  if(p.ingredients){
    infoHtml = `
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
  return sizingHtml + infoHtml;
}

function renderProductDetail(){
  const p = findProduct(currentProductId);
  pdQty = 1;
  const pdOpts = getSizeOptions(p);
  pdSize = pdOpts.length === 1 ? pdOpts[0].size : null;
  $('#pdCrumb').text(p.name);
  const isMerch = ['Shirts','Caps','Shorts','Socks','ToteBags','Bracelets','Keychains'].includes(p.cat);
  const isCombo = p.cat === 'Combo';
  $('#pdSectionLink').text(isCombo ? 'Home' : isMerch ? 'Merchandise' : 'Menu')
    .attr('data-nav', isCombo ? 'home' : isMerch ? 'merchandise' : 'menu')
    .data('nav', isCombo ? 'home' : isMerch ? 'merchandise' : 'menu');
  const startPrice = pdSize ? getPriceForSize(p, pdSize) : getDisplayPrice(p);
  // Sized products: judge the currently-selected size. Unsized products,
  // and sized products where every size is out of stock (so nothing was
  // pre-selected), fall back to isProductOutOfStock — same check the
  // grid cards and admin dashboard use, so this page never disagrees.
  const startOos = pdSize ? isSizeOutOfStock(p, pdSize) : isProductOutOfStock(p);
  $('#pdContent').html(`
    <div>
      <div class="pd-main-img"><img id="pdMainImg" src="${p.imgs[0]}" alt="${p.name}"></div>
      <div class="pd-thumbs">
        ${p.imgs.map((im,i)=>`<img src="${im}" class="${i===0?'active':''}" data-thumb="${im}" alt="${p.name} view ${i+1}">`).join('')}
      </div>
    </div>
    <div>
      <div class="eyebrow">${isCombo ? `Combo · ${p.comboMeta.discountPercent}% off` : p.cat}</div>
      <h1 style="margin:10px 0 4px;">${p.name}</h1>
      <div class="pd-price" id="pdPriceDisplay">
        ${isCombo ? `<span class="combo-price-original combo-price-original-pd">${comboOriginalPriceLabel(p)}</span>` : ''}
        <span id="pdPriceDisplayValue">${peso(startPrice)}</span>
      </div>
      <p class="pd-desc">${p.desc}${p.ingredients ? ' Made in small batches at our counter, using seasonal ingredients whenever we can.' : ''}</p>
      ${renderPdSecondary(p)}
      <div class="pd-actions">
        <div class="qty-select" id="pdQtySelect">
          <button data-qty-action="minus">−</button>
          <span id="pdQtyVal">1</span>
          <button data-qty-action="plus">+</button>
        </div>
        <button class="btn btn-primary" id="pdAddBtn" data-pd-add="${p.id}" ${startOos ? 'disabled' : ''}>${startOos ? 'Out of Stock' : `Add to Cart · ${peso(startPrice)}`}</button>
        <button type="button" class="wishlist-btn pd-wishlist-btn ${isWishlisted(p.id) ? 'active' : ''}" data-wishlist-toggle="${p.id}" aria-label="Save to favorites">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${isWishlisted(p.id) ? 'currentColor' : 'none'}"><path d="M12 21s-7.5-4.6-10-9.3C.6 8.1 2.4 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.6.5 5.4 4.1 4 7.7C19.5 16.4 12 21 12 21z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>
  `);

  // A combo's "you may also like" is the two real products it's made
  // of — showing random catalog items here instead would be confusing
  // (PRODUCTS never contains combo docs, so the normal same-category
  // lookup below would just return unrelated items).
  let related, fill;
  if(isCombo){
    related = [p.comboMeta.drinkId, p.comboMeta.pastryId].map(findProduct).filter(Boolean);
    fill = [];
  } else {
    related = PRODUCTS.filter(x => x.cat === p.cat && x.id !== p.id).slice(0,4);
    fill = related.length < 4 ? PRODUCTS.filter(x=>x.id!==p.id && !related.includes(x)).slice(0, 4-related.length) : [];
  }
  $('#relatedHeading').text(isCombo ? "What's in this combo" : 'You might also like');
  $('#relatedGrid').html([...related, ...fill].map(productCard).join(''));
  initReveal();
  loadAndRenderReviews(p.id);
}

/* ================= RATINGS & REVIEWS ================= */
function starString(rating){
  const r = Math.round(rating);
  return '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r);
}

/* State for the currently-open product's reviews, kept in memory so
   switching the sort order re-sorts instantly instead of re-fetching
   from Firestore every time. Reset whenever a new product's reviews load. */
let reviewsState = { productId: null, reviews: [], purchased: false, sort: 'recent' };

/* Deterministic avatar color from the reviewer's name, picked from
   the site's own palette so avatars never look out of place. */
const AVATAR_PALETTE = ['var(--sage)', 'var(--cta)', 'var(--dusk)', 'var(--cta-dark)'];
function avatarColor(name){
  let hash = 0;
  for(let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
function avatarInitials(name){
  const parts = (name || 'Customer').trim().split(/\s+/);
  const initials = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);
  return initials.toUpperCase();
}

function formatReviewDate(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function sortReviews(reviews, mode){
  const list = [...reviews];
  if(mode === 'highest') list.sort((a,b) => b.rating - a.rating || new Date(b.createdAt) - new Date(a.createdAt));
  else if(mode === 'lowest') list.sort((a,b) => a.rating - b.rating || new Date(b.createdAt) - new Date(a.createdAt));
  else list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  return list;
}

/* "Purchased" = at least one of the account's own orders (any status
   except cancelled — a cancelled order was never actually fulfilled)
   contains this product id. Run alongside the reviews fetch so both
   are ready before the section paints — no extra loading flicker. */
async function hasPurchasedProduct(uid, productId){
  try{
    const orders = await window.CCOrders.fetchMyOrders(uid);
    return orders.some(o => o.status !== 'cancelled' && (o.items || []).some(it => it.id === productId));
  } catch(err){
    console.error(err);
    return false; // can't confirm the purchase — default to not allowing the form
  }
}

async function loadAndRenderReviews(productId){
  const $wrap = $('#productReviews');
  $wrap.html('<p class="reviews-loading">Loading reviews...</p>');
  const realUser = window.currentUser && !window.currentUser.isAnonymous ? window.currentUser : null;
  let reviews, purchased = false;
  try{
    const results = await Promise.all([
      window.CCReviews.fetchReviewsForProduct(productId),
      realUser ? hasPurchasedProduct(realUser.uid, productId) : Promise.resolve(false)
    ]);
    reviews = results[0];
    purchased = results[1];
  } catch(err){
    console.error(err);
    $wrap.html('<p class="reviews-loading">Could not load reviews right now.</p>');
    return;
  }
  // Bail if the person has already navigated to a different product by
  // the time this resolves — don't paint stale reviews over a new page.
  if(currentProductId !== productId) return;
  reviewsState = { productId, reviews, purchased, sort: 'recent' };
  renderReviewsSection();
}

function renderReviewsSection(){
  const { productId, reviews, purchased, sort } = reviewsState;
  const total = reviews.length;
  const avg = total ? reviews.reduce((s,r) => s + r.rating, 0) / total : 0;

  // 5→1 breakdown, used for the distribution bars next to the score.
  const counts = [0,0,0,0,0]; // index 0 = 5-star ... index 4 = 1-star
  reviews.forEach(r => { const i = 5 - Math.round(r.rating); if(counts[i] !== undefined) counts[i]++; });
  const barsHtml = counts.map((c, i) => {
    const star = 5 - i;
    const pct = total ? Math.round((c / total) * 100) : 0;
    return `
      <div class="rating-bar-row">
        <span class="rating-bar-label">${star}<span class="rating-bar-star">★</span></span>
        <div class="rating-bar-track"><div class="rating-bar-fill" style="width:${pct}%"></div></div>
        <span class="rating-bar-pct">${pct}%</span>
      </div>
    `;
  }).join('');

  const summaryHtml = `
    <div class="reviews-summary-card">
      <div class="review-summary-score">${avg ? avg.toFixed(1) : '—'}</div>
      <div class="stars stars-lg">${starString(avg)}</div>
      <div class="review-summary-count">${total} review${total === 1 ? '' : 's'}</div>
      ${total ? `<div class="rating-bars">${barsHtml}</div>` : ''}
    </div>
  `;

  const realUser = window.currentUser && !window.currentUser.isAnonymous ? window.currentUser : null;
  const myReview = realUser ? reviews.find(r => r.uid === realUser.uid) : null;

  const sorted = sortReviews(reviews, sort);
  const listHtml = sorted.length
    ? sorted.map(r => {
        const name = r.userName || 'Customer';
        const mine = realUser && r.uid === realUser.uid;
        return `
      <div class="review-card real-review${mine ? ' review-card-mine' : ''}">
        <div class="review-top">
          <div class="review-avatar" style="background:${avatarColor(name)}">${avatarInitials(name)}</div>
          <div class="review-meta">
            <div class="review-name-row">
              <span class="review-name">${escapeHtml(name)}</span>
              ${r.verified ? `<span class="verified-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Verified Purchase</span>` : ''}
            </div>
            <div class="review-stars-row">
              <span class="stars">${starString(r.rating)}</span>
              <span class="review-date">${formatReviewDate(r.createdAt)}</span>
            </div>
          </div>
          ${mine ? `<button class="review-delete-btn" data-review-delete="${productId}" title="Delete your review">Delete</button>` : ''}
        </div>
        ${r.text ? `<p class="review-text">${escapeHtml(r.text)}</p>` : ''}
      </div>
    `;
      }).join('')
    : `<div class="reviews-empty">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M12 17.3l-5.8 3 1.1-6.5-4.7-4.6 6.5-1 2.9-5.9 2.9 5.9 6.5 1-4.7 4.6 1.1 6.5z" stroke="var(--line-strong)" stroke-width="1.4" stroke-linejoin="round"/></svg>
        <p>No reviews yet — be the first to share what you thought.</p>
      </div>`;

  // Gate the form on having actually bought the item — but an existing
  // reviewer can still edit/delete their own review even if that order
  // later got cancelled, rather than getting locked out of it.
  const canReview = realUser && (purchased || myReview);

  const formHtml = !realUser
    ? `<p class="reviews-login-hint"><a data-nav="login">Log in</a> to leave a review.</p>`
    : canReview ? `
    <div class="review-form">
      <h4>${myReview ? 'Edit your review' : 'Write a review'}</h4>
      <div class="review-star-input" id="reviewStarInput" data-value="${myReview ? myReview.rating : 0}">
        ${[1,2,3,4,5].map(n => `<span data-star="${n}" class="${myReview && n <= myReview.rating ? 'active' : ''}">★</span>`).join('')}
      </div>
      <textarea id="reviewTextInput" placeholder="Optional — what did you think?" maxlength="600">${myReview ? escapeHtml(myReview.text || '') : ''}</textarea>
      <div class="review-form-footer">
        <span class="review-form-hint">${purchased ? 'You purchased this item' : 'Verified from a past order'}</span>
        <button class="btn btn-primary" id="submitReviewBtn" data-product-id="${productId}">${myReview ? 'Update Review' : 'Submit Review'}</button>
      </div>
    </div>
  ` : `<p class="reviews-login-hint">Only customers who've purchased this item can leave a review.</p>`;

  const sortHtml = total > 1 ? `
    <label class="sort-select-wrap reviews-sort-wrap">
      <span class="sort-select-label">Sort</span>
      <select id="reviewSort" class="sort-select">
        <option value="recent" ${sort === 'recent' ? 'selected' : ''}>Most Recent</option>
        <option value="highest" ${sort === 'highest' ? 'selected' : ''}>Highest Rated</option>
        <option value="lowest" ${sort === 'lowest' ? 'selected' : ''}>Lowest Rated</option>
      </select>
    </label>
  ` : '';

  const mainHtml = `
    <div class="reviews-main">
      <div class="reviews-main-head">
        <h4 class="reviews-main-title">${total ? `Customer Reviews (${total})` : 'Customer Reviews'}</h4>
        ${sortHtml}
      </div>
      <div class="review-list">${listHtml}</div>
      ${formHtml}
    </div>
  `;

  $('#productReviews').html(`<div class="reviews-panel">${summaryHtml}${mainHtml}</div>`);
}

$(document).on('change', '#reviewSort', function(){
  reviewsState.sort = $(this).val();
  renderReviewsSection();
});

$(document).on('click', '#reviewStarInput span', function(){
  const val = Number($(this).data('star'));
  $('#reviewStarInput').attr('data-value', val)
    .find('span').each(function(){ $(this).toggleClass('active', Number($(this).data('star')) <= val); });
});

$(document).on('click', '#submitReviewBtn', async function(){
  const productId = $(this).data('product-id');
  const rating = Number($('#reviewStarInput').attr('data-value')) || 0;
  const text = $('#reviewTextInput').val().trim();
  if(!rating){
    showToast('Please select a star rating.', 'warning');
    return;
  }
  const $btn = $(this);
  const originalText = $btn.text();
  $btn.prop('disabled', true).text('Saving...');
  try{
    const myExisting = reviewsState.reviews.find(r => r.uid === window.currentUser.uid);
    const verified = reviewsState.purchased || (myExisting ? myExisting.verified : false);
    await window.CCReviews.submitReview(productId, window.currentUser.uid, window.currentUser.displayName || 'Customer', rating, text, verified);
    showToast('Thanks for the review!', 'success');
    loadAndRenderReviews(productId);
  } catch(err){
    console.error(err);
    showToast('Could not save your review. Please try again.', 'error');
    $btn.prop('disabled', false).text(originalText);
  }
});

$(document).on('click', '[data-review-delete]', async function(){
  const productId = $(this).data('review-delete');
  const ok = await showConfirm({
    title: 'Delete your review?',
    message: "This will remove your rating and comment from this product. This can't be undone.",
    confirmText: 'Delete',
    danger: true
  });
  if(!ok) return;
  try{
    await window.CCReviews.deleteReview(productId, window.currentUser.uid);
    showToast('Your review was deleted.', 'success');
    loadAndRenderReviews(productId);
  } catch(err){
    console.error(err);
    showToast('Could not delete your review. Please try again.', 'error');
  }
});

$(document).on('click', '[data-pd-size]:not([disabled])', function(){
  pdSize = $(this).data('pd-size');
  $('#pdSizeRow .size-chip').removeClass('active');
  $(this).addClass('active');
  const p = findProduct(currentProductId);
  const unitPrice = getPriceForSize(p, pdSize);
  const oos = isSizeOutOfStock(p, pdSize);
  $('#pdPriceDisplayValue').text(peso(unitPrice));
  if(p.comboMeta) $('.combo-price-original-pd').text(comboOriginalPriceForSize(p, pdSize));
  $('#pdAddBtn').prop('disabled', oos).text(oos ? 'Out of Stock' : `Add to Cart · ${peso(unitPrice * pdQty)}`);
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
  const unitPrice = pdSize ? getPriceForSize(p, pdSize) : getDisplayPrice(p);
  const oos = pdSize ? isSizeOutOfStock(p, pdSize) : false;
  if(!oos) $('#pdAddBtn').text(`Add to Cart · ${peso(unitPrice * pdQty)}`);
});

$(document).on('click', '[data-pd-add]', function(){
  const p = findProduct($(this).data('pd-add'));
  // Unsized products (flat stock) and sized products where every size
  // is out of stock never get a pdSize selected, so neither check below
  // would catch them — guard with the same product-level check the
  // grid cards and admin dashboard use.
  if(!pdSize && isProductOutOfStock(p)){
    showToast('This item is out of stock.', 'warning');
    return;
  }
  if(p.sizes && p.sizes.length > 1 && !pdSize){
    showToast('Please select a size first', 'warning');
    return;
  }
  if(pdSize && isSizeOutOfStock(p, pdSize)){
    showToast('That size is out of stock.', 'warning');
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
          <div class="cart-item-meta">${p.cat}${c.size ? ` · Size: ${c.size}` : ''} · ${peso(getPriceForSize(p, c.size))} each</div>
        </div>
        <div class="qty-select" data-cart-qty="${lineKey}">
          <button data-cart-action="minus">−</button>
          <span>${c.qty}</span>
          <button data-cart-action="plus">+</button>
        </div>
        <div style="display:flex; align-items:center; gap:14px;">
          <span class="price cart-item-price">${peso(getPriceForSize(p, c.size)*c.qty)}</span>
          <button class="remove-btn" data-cart-remove="${lineKey}" aria-label="Remove item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  const totalQty = cart.reduce((s,c)=>s+c.qty,0);
  const subtotal = cartTotal();
  const delivery = subtotal > 0 ? DELIVERY_FEE : 0;
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
  persistCart();
  updateCartCount();
  renderCart();
});

$(document).on('click', '[data-cart-remove]', function(){
  const { id, size } = parseLineKey($(this).data('cart-remove'));
  cart = cart.filter(c => !(c.id === id && c.size === size));
  persistCart();
  updateCartCount();
  renderCart();
});

$(document).on('click', '#cartClearBtn', function(){
  if(!cart.length) return;
  if(!window.confirm('Remove all items from your cart?')) return;
  cart = [];
  persistCart();
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

// clean label text for a pay-opt, ignoring the "Tap to show QR" hint
function payOptLabel($opt){
  const $clone = $opt.clone();
  $clone.find('.pay-qr-hint').remove();
  return $clone.text().trim().replace(/\s+/g, ' ');
}

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
  const delivery = fulfillment === 'delivery' && subtotal > 0 ? DELIVERY_FEE : 0;
  const total = subtotal + delivery;
  const lines = cart.map(c=>{
    const p = findProduct(c.id);
    const label = p.name + (c.size ? ` (${c.size})` : '') + ` × ${c.qty}`;
    return `<div class="sum-row"><span>${label}</span><span>${peso(getPriceForSize(p, c.size)*c.qty)}</span></div>`;
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
    showToast('Please fill in your name and phone number.', 'warning');
    return;
  }

  const subtotal = cartTotal();
  const deliveryFee = fulfillment === 'delivery' ? DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee;
  const items = cart.map(c => {
    const p = findProduct(c.id);
    return { id: p.id, name: p.name, price: getPriceForSize(p, c.size), qty: c.qty, size: c.size || null };
  });
  const paymentMethod = payOptLabel($('.pay-opt.active'));

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
    persistCart();
    updateCartCount();
    navigate('confirmation');
    // Best-effort — the order is already placed at this point, so an
    // email hiccup shouldn't show as a checkout failure to the customer.
    if(customer.email){
      sendOrderConfirmationEmail(orderPayload, orderId);
    }
    // Only decrement products that actually track stock (merch items
    // without a stock field are skipped by decrementStock's caller here).
    // Sized products (Shirts/Caps/Shorts/Socks) carry the size along so
    // the per-size stock count gets decremented instead of the flat total.
    // A combo line isn't a real product doc in Firestore — it expands
    // into its two real component decrements instead (see comboMeta,
    // set in buildComboProducts): the drink (with its chosen size) and
    // the pastry (unsized), each decremented exactly like a normal
    // order for that product would be.
    const stockUpdates = [];
    items.forEach(it => {
      const p = findProduct(it.id);
      if(!p) return;
      if(p.comboMeta){
        stockUpdates.push({ id: p.comboMeta.drinkId, qty: it.qty, size: it.size || null });
        stockUpdates.push({ id: p.comboMeta.pastryId, qty: it.qty, size: null });
      } else if(typeof p.stock === 'number'){
        stockUpdates.push({ id: it.id, qty: it.qty, size: it.size || null });
      }
    });
    if(stockUpdates.length){
      window.CCProducts.decrementStock(stockUpdates).catch(err => console.error('Stock decrement failed:', err));
    }
  } catch(err){
    console.error(err);
    if(String(err.code).includes('admin-restricted-operation') || String(err.code).includes('operation-not-allowed')){
      showToast('Guest checkout isn\'t enabled yet — turn on "Anonymous" sign-in in the Firebase Console.', 'error');
    } else {
      showToast('Could not place order. Please try again.', 'error');
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
    showToast('Welcome back! Logged in successfully.', 'success');
    const verified = await window.CCAuth.isOtpVerified();
    if(!verified){
      goToVerifyEmail(user.email);
    } else {
      navigate('home');
    }
  } catch(err){
    showToast(friendlyAuthError(err), 'error');
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
    showToast("Passwords don't match.", 'warning');
    return;
  }
  $btn.prop('disabled', true).text('Creating account...');
  try{
    const user = await window.CCAuth.registerUser(fullName, email, phone, password);
    showToast(user.otpEmailSent
      ? 'Account created! Check your email for a verification code.'
      : "Account created — but we couldn't send the verification email just now. Tap \"Resend code\" on the next screen to try again.",
      user.otpEmailSent ? 'success' : 'warning');
    goToVerifyEmail(email, user.otpEmailSent);
  } catch(err){
    showToast(friendlyAuthError(err), 'error');
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
      showToast('New code sent — check your inbox.', 'success');
      startVerifyResendCooldown(45);
    } else {
      // Be honest: the code was regenerated in Firestore, but the email
      // itself didn't go out, so don't tell them to go check their inbox.
      showToast("New code generated, but the email didn't go out. Check your connection and tap Resend again in a moment.", 'warning');
      startVerifyResendCooldown(10); // short cooldown, not the usual 45s, since nothing was actually sent
    }
  } catch(err){
    console.error(err);
    const message = (err && err.message === 'not-signed-in')
      ? 'Your session needs a moment to reconnect — please try again in a few seconds.'
      : 'Could not resend right now. Please try again shortly.';
    showToast(message, 'error');
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
      showToast("Email verified — you're all set!", 'success');
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
    showToast('Could not verify right now. Please try again.', 'error');
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
  syncCartToAccount(realUser);
  syncWishlistToAccount(realUser);
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
    <button type="button" class="account-dd-link" id="accountDdOrdersBtn">Order History</button>
    <button type="button" class="account-dd-link" id="accountDdWishlistBtn">Favorites</button>
    <button class="btn btn-outline account-dd-logout" id="accountLogoutBtn">Log Out</button>
  `);
}

$(document).on('click', '#accountDdOrdersBtn', function(){
  $('#accountDropdownWrap').removeClass('open');
  navigate('order-history');
});

$(document).on('click', '#accountDdWishlistBtn', function(){
  $('#accountDropdownWrap').removeClass('open');
  navigate('wishlist');
});

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
  showToast('Logged out.', 'info');
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
    showToast("If that email has an account, we've sent a reset link.", 'success');
    closeResetPasswordModal();
  } catch(err){
    console.error(err);
    showToast('Could not send the reset link right now. Please try again.', 'error');
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
  showToast('Message received — we\'ll get back to you soon.', 'success');
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

function renderAll(){
  renderBestSellers();
  renderMenuPage();
  renderMerchPage();
  buildComboProducts();
  renderFeaturedCombos();
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

async function loadSettingsFromFirestore(){
  try{
    const settings = await window.CCSettings.fetchSettings();
    DELIVERY_FEE = settings.deliveryFee;
  } catch(err){
    console.error('Could not load settings from Firestore, using the default delivery fee instead.', err);
  }
}

$(async function(){

  renderCategories();
  renderReviews();
  updateCartCount();
  initReveal();
  initScrollProgress();


  const cached = window.CCProducts.getCachedProducts();
  if(cached && cached.length){
    PRODUCTS = cached;
    renderAll();
  }
  const cachedSettings = window.CCSettings.getCachedSettings();
  if(cachedSettings){
    DELIVERY_FEE = cachedSettings.deliveryFee;
  }

  await loadProductsFromFirestore();
  await loadSettingsFromFirestore();
  await loadCombosFromFirestore();
  renderAll();
});
/* ================= PROMO LAUNCH BANNER ================= */
/* Fancy "New" popup shown once per browser session on page load.
   sessionStorage (not localStorage) so it reappears on a fresh visit/tab
   but doesn't nag on every reload within the same session. */
(function initPromoOverlay(){
  const PROMO_KEY = 'cc_promo_seen_v1';
  const $overlay = $('#promoOverlay');
  if(!$overlay.length) return;

  function closePromo(){
    $overlay.removeClass('open');
    sessionStorage.setItem(PROMO_KEY, '1');
  }

  let seen = false;
  try{ seen = sessionStorage.getItem(PROMO_KEY) === '1'; } catch(err){ /* private mode — just show it */ }

  if(!seen){
    // Slight delay so it arrives after the hero's own entrance animation
    // has had a moment to breathe, rather than competing with it.
    setTimeout(() => $overlay.addClass('open'), 900);
  }

  $('#promoModalClose, #promoModalDismiss').on('click', closePromo);
  $('#promoModalCta').on('click', closePromo);
  $overlay.on('click', function(e){
    if(e.target === this) closePromo();
  });
  $(document).on('keydown', function(e){
    if(e.key === 'Escape' && $overlay.hasClass('open')) closePromo();
  });
})();