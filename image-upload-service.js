/* =========================================================
   Crafts & Crumbs — image-upload-service.js
   Handles the admin dashboard's "upload an image" fields for
   products and combos.

   Uses Cloudinary's free plan instead of Firebase Storage —
   Firebase now requires a linked billing card (the pay-as-you-go
   "Blaze" plan) just to turn Storage on at all, even to stay
   completely within its free quota. Cloudinary's free plan needs
   no card, ever, and comfortably covers a catalog of product
   photos for a project like this.

   SETUP (one-time, no credit card required):
   1. Create a free account at https://cloudinary.com
   2. Copy your "Cloud name" from the dashboard — paste it below.
   3. Go to Settings > Upload > Upload presets > Add upload preset.
      Set "Signing Mode" to UNSIGNED (this is what lets the browser
      upload directly, with no server/API secret involved). Name it
      anything, then paste that name below too.
   Until both constants below are filled in, uploads will fail with
   a clear "not-configured" error rather than a confusing one.

   Every product/combo image in this app is displayed through
   several differently-shaped containers off the SAME single `img`
   field — a landscape-ish grid card, a 1:1 product detail hero, and
   a small admin table thumbnail — all using CSS object-fit:cover.
   Rather than asking the admin to prepare a different crop for each
   one, every upload here is center-cropped to a single 1000×1000
   square before it's sent: that exactly matches the most demanding
   container (the 1:1 detail hero shows the whole image, no
   cropping), while object-fit:cover still crops it in gracefully
   everywhere narrower. It also keeps the uploaded file small, which
   matters more here than with Firebase Storage since Cloudinary's
   free plan is a shared monthly credit pool across every image. */

const CLOUDINARY_CLOUD_NAME = 'tzowktf6';
const CLOUDINARY_UPLOAD_PRESET = 'jprqkzcf';

const SQUARE_SIZE = 1000;
const JPEG_QUALITY = 0.85;

function loadImageFromFile(file){
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image-load-failed'));
    img.src = url;
  });
}

/* Center-crops to a square (so a landscape or portrait source photo
   both come out consistent) and resizes to SQUARE_SIZE, returning a
   JPEG Blob ready to upload. Runs entirely in the browser — no
   backend needed for a straightforward crop-and-resize. */
async function resizeImageToSquare(file){
  const img = await loadImageFromFile(file);
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = SQUARE_SIZE;
  canvas.height = SQUARE_SIZE;
  canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, SQUARE_SIZE, SQUARE_SIZE);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('canvas-export-failed')),
      'image/jpeg',
      JPEG_QUALITY
    );
  });
}

async function uploadImage(blob, folder, id){
  if(CLOUDINARY_CLOUD_NAME === 'YOUR_CLOUD_NAME' || CLOUDINARY_UPLOAD_PRESET === 'YOUR_UNSIGNED_UPLOAD_PRESET'){
    throw new Error('cloudinary-not-configured');
  }
  const formData = new FormData();
  formData.append('file', blob, `${id}.jpg`);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('public_id', `${folder}/${id}`);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData
  });
  if(!res.ok) throw new Error('cloudinary-upload-failed');
  const data = await res.json();
  return data.secure_url;
}

window.CCImages = { resizeImageToSquare, uploadImage };