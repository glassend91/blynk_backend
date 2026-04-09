const express = require('express');
const mongoose = require('mongoose');

// We use text parser so the user can send raw JavaScript in the body
const router = express.Router();
router.use(express.text({ type: '*/*' })); 

const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

/**
 * POST /api/dev-query
 * Payload structure: Raw Javascript text
 * Example 1: `return await db.collection("users").find({}).toArray();`
 * Example 2: `return await db.dropDatabase();`
 */
router.post('/', async (req, res) => {
    try {
        const scriptBody = req.body;

        if (!scriptBody || typeof scriptBody !== 'string') {
            return res.status(400).json({ 
                success: false, 
                message: "Request body must be a raw javascript string." 
            });
        }

        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                success: false,
                message: "Database connection is not ready."
            });
        }

        const db = mongoose.connection.db;

        // Create an asynchronous function from the raw string payload
        // We pass `db` and `mongoose` as arguments so they are available in scope.
        const dynamicQueryFn = new AsyncFunction('db', 'mongoose', scriptBody);

        // Execute the dynamically built function
        const result = await dynamicQueryFn(db, mongoose);

        return res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error("Raw query execution error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to execute raw query script.",
            error: error.message,
            stack: error.stack
        });
    }
});

module.exports = router;
