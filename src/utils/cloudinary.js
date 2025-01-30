import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    console.log('Uploading file to Cloudinary:', localFilePath);

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: 'auto', // auto-detect file type
    });

    console.log('File uploaded to Cloudinary:', response.url);

    // Delete temp file after successful upload
    fs.unlinkSync(localFilePath);

    return response;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    console.error('Cloudinary error message:', error.message); // Log Cloudinary-specific error message

    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath); // Delete temp file if upload fails
    }

    return null;
  }
};

export { uploadOnCloudinary };
