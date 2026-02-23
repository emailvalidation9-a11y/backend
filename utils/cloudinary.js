const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// Configure Cloudinary from environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer to Cloudinary.
 * Works for images, CSVs, PDFs, and any raw file type.
 *
 * @param {Buffer} buffer - The file buffer
 * @param {Object} options
 * @param {string} options.folder - Cloudinary folder (e.g. 'avatars', 'blog', 'results')
 * @param {string} [options.publicId] - Custom public ID (optional)
 * @param {string} [options.resourceType='auto'] - 'image', 'raw', 'video', or 'auto'
 * @param {string} [options.format] - Force a specific format (e.g. 'csv', 'png')
 * @param {Object} [options.transformation] - Image transformation options
 * @returns {Promise<{url: string, secureUrl: string, publicId: string, format: string, bytes: number}>}
 */
const uploadBuffer = (buffer, options = {}) => {
    return new Promise((resolve, reject) => {
        const {
            folder = 'uploads',
            publicId,
            resourceType = 'auto',
            format,
            transformation,
        } = options;

        const uploadOptions = {
            folder: `kimi/${folder}`,
            resource_type: resourceType,
            use_filename: true,
            unique_filename: true,
        };

        if (publicId) uploadOptions.public_id = publicId;
        if (format) uploadOptions.format = format;
        if (transformation) uploadOptions.transformation = transformation;

        const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
                if (error) return reject(error);
                resolve({
                    url: result.url,
                    secureUrl: result.secure_url,
                    publicId: result.public_id,
                    format: result.format,
                    bytes: result.bytes,
                    resourceType: result.resource_type,
                    width: result.width || null,
                    height: result.height || null,
                });
            }
        );

        // Pipe the buffer into the upload stream
        const readable = new Readable();
        readable.push(buffer);
        readable.push(null);
        readable.pipe(uploadStream);
    });
};

/**
 * Upload an image buffer with automatic optimization.
 * Applies quality auto, format auto, and optional resize.
 */
const uploadImage = async (buffer, options = {}) => {
    const {
        folder = 'images',
        publicId,
        maxWidth = 1920,
        maxHeight = 1080,
    } = options;

    return uploadBuffer(buffer, {
        folder,
        publicId,
        resourceType: 'image',
        transformation: [
            { quality: 'auto', fetch_format: 'auto' },
            { width: maxWidth, height: maxHeight, crop: 'limit' },
        ],
    });
};

/**
 * Upload a user avatar with circular crop and small dimensions.
 */
const uploadAvatar = async (buffer, userId) => {
    return uploadBuffer(buffer, {
        folder: 'avatars',
        publicId: `user_${userId}`,
        resourceType: 'image',
        transformation: [
            { width: 256, height: 256, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' },
        ],
    });
};

/**
 * Upload a raw file (CSV, XLSX, TXT, PDF, etc.)
 */
const uploadRawFile = async (buffer, options = {}) => {
    const {
        folder = 'files',
        publicId,
        originalFilename,
    } = options;

    return uploadBuffer(buffer, {
        folder,
        publicId: publicId || (originalFilename ? originalFilename.replace(/\.[^.]+$/, '') : undefined),
        resourceType: 'raw',
    });
};

/**
 * Upload CSV validation results to Cloudinary.
 * Returns a permanent download URL.
 */
const uploadValidationResults = async (csvBuffer, jobId) => {
    return uploadBuffer(csvBuffer, {
        folder: 'results',
        publicId: `job_${jobId}`,
        resourceType: 'raw',
        format: 'csv',
    });
};

/**
 * Upload a blog cover image with optimized dimensions.
 */
const uploadBlogImage = async (buffer, slug) => {
    return uploadBuffer(buffer, {
        folder: 'blog',
        publicId: slug,
        resourceType: 'image',
        transformation: [
            { width: 1200, height: 630, crop: 'fill' },
            { quality: 'auto', fetch_format: 'auto' },
        ],
    });
};

/**
 * Delete a file from Cloudinary by public ID.
 */
const deleteFile = async (publicId, resourceType = 'image') => {
    try {
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
        });
        return result;
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        throw error;
    }
};

/**
 * Generate a signed download URL for a raw file (CSV results, etc.)
 * with an expiry time.
 */
const getSignedUrl = (publicId, options = {}) => {
    const { expiresInSeconds = 3600, resourceType = 'raw' } = options;

    return cloudinary.utils.private_download_url(publicId, '', {
        resource_type: resourceType,
        expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
    });
};

module.exports = {
    cloudinary,
    uploadBuffer,
    uploadImage,
    uploadAvatar,
    uploadRawFile,
    uploadValidationResults,
    uploadBlogImage,
    deleteFile,
    getSignedUrl,
};
