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

/* Resizes WITHOUT cropping — keeps the whole photo, just scales it so its
   longest side is at most `maxSide`. Used for delivery-proof photos (the
   rider app), where cropping to a square could cut off the very thing
   being photographed (the parcel at the door, the house number...). */
async function resizeImageToMax(file, maxSide = 1280){
  const img = await loadImageFromFile(file);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
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

window.CCImages = { resizeImageToSquare, resizeImageToMax, uploadImage };
