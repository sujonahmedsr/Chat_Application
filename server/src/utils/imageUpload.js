const cloudinary = require('cloudinary').v2;
const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = require('../config/config');

// Initialize Cloudinary if credentials exist
if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Upload an image (base64 string or url) to Cloudinary or return as data URL
 * @param {string} fileStr base64 data string (e.g. data:image/png;base64,...)
 * @param {string} folder optional folder in cloudinary
 * @returns {Promise<string>} public image URL
 */
const uploadImage = async (fileStr, folder = 'shofi_chat_avatars') => {
  if (!fileStr) return '';

  // If already a hosted URL (http/https), return as is
  if (fileStr.startsWith('http://') || fileStr.startsWith('https://')) {
    return fileStr;
  }

  // If Cloudinary is configured, upload to Cloudinary
  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    try {
      const uploadResponse = await cloudinary.uploader.upload(fileStr, {
        folder,
        resource_type: 'image',
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      });
      return uploadResponse.secure_url;
    } catch (err) {
      console.error('[Cloudinary Upload Error]', err);
      // Fallback to storing raw base64 data URL if upload fails
      return fileStr;
    }
  }

  // Fallback: return base64 string directly
  return fileStr;
};

module.exports = {
  uploadImage,
};
