import multer from 'multer';

// Configure disk storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/temp'); // Temporary storage path
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`); // Unique filename
  },
});

// Create an `upload` instance for handling file uploads
export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limit file size to 10 MB
  },
});
