const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Ensure the directory exists
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up storage engine
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Safe filename replacement
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + safeName);
    }
});

const upload = multer({ storage: storage });

/**
 * POST /api/upload
 */
router.post('/', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        // Return the static path so the frontend can hit it based on server configuration
        // e.g., if the server is example.com, they can hit example.com/uploads/filename
        return res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            filename: req.file.filename,
            url: `/uploads/${req.file.filename}`
        });

    } catch (error) {
        console.error('File Upload Error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during file upload',
            error: error.message
        });
    }
});

module.exports = router;
