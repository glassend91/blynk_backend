const Package = require('../models/Package');
const PackageSelection = require('../models/PackageSelection');
const { validationResult } = require('express-validator');

// Helper function to update package statistics
const updatePackageStats = async (packageId) => {
    const totalUsage = await PackageSelection.aggregate([
        { $match: { packageId: packageId, status: 'active' } },
        { $group: { _id: null, total: { $sum: '$usedData' } } }
    ]);

    const customerCount = await PackageSelection.countDocuments({
        packageId: packageId,
        status: 'active'
    });

    const totalUsedData = totalUsage.length > 0 ? totalUsage[0].total : 0;

    await Package.findByIdAndUpdate(packageId, {
        totalUsedData,
        customerCount
    });

    return { totalUsedData, customerCount };
};

// Get all available packages (for customers to browse)
const getAllAvailablePackages = async (req, res) => {
    try {
        const {
            planType,
            minPrice,
            maxPrice,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            page = 1,
            limit = 10
        } = req.query;

        const filter = {
            isActive: true,
            isAvailable: true
        };

        // Apply filters
        if (planType) filter.planType = planType;
        if (minPrice) filter.price = { ...filter.price, $gte: parseFloat(minPrice) };
        if (maxPrice) filter.price = { ...filter.price, $lte: parseFloat(maxPrice) };

        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const packages = await Package.find(filter)
            .populate('providerId', 'name email')
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Package.countDocuments(filter);

        res.status(200).json({
            success: true,
            count: packages.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: packages
        });
    } catch (error) {
        console.error('Error fetching available packages:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching available packages',
            error: error.message
        });
    }
};

// Get packages created by current user (for providers)
const getMyPackages = async (req, res) => {
    try {
        const userId = req.user.id;

        const packages = await Package.find({
            providerId: userId,
            isActive: true
        }).sort({ createdAt: -1 });

        // Get statistics for each package
        const packagesWithStats = await Promise.all(
            packages.map(async (pkg) => {
                const stats = await updatePackageStats(pkg._id);
                const packageObj = pkg.toObject();
                packageObj.stats = stats;
                return packageObj;
            })
        );

        res.status(200).json({
            success: true,
            count: packagesWithStats.length,
            data: packagesWithStats
        });
    } catch (error) {
        console.error('Error fetching my packages:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching my packages',
            error: error.message
        });
    }
};

// Check if user has already selected a specific package
const checkPackageSelection = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Check for active selection first
        const activeSelection = await PackageSelection.findOne({
            packageId: id,
            customerId: userId,
            status: 'active'
        });

        if (activeSelection) {
            return res.status(200).json({
                success: true,
                message: 'Package is currently active',
                selected: true,
                status: 'active',
                data: activeSelection
            });
        }

        // Check for any previous selections
        const previousSelection = await PackageSelection.findOne({
            packageId: id,
            customerId: userId
        }).sort({ selectedAt: -1 });

        if (previousSelection) {
            return res.status(200).json({
                success: true,
                message: `Package was previously ${previousSelection.status}`,
                selected: false,
                canReselect: true,
                status: previousSelection.status,
                data: previousSelection
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Package not selected by user',
            selected: false,
            canReselect: true
        });
    } catch (error) {
        console.error('Error checking package selection:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking package selection',
            error: error.message
        });
    }
};

// Get packages selected by current user (for customers)
const getMySelectedPackages = async (req, res) => {
    try {
        const userId = req.user.id;
        const { showAll = 'false' } = req.query;

        // Build query based on showAll parameter
        const query = { customerId: userId };
        if (showAll === 'false') {
            query.status = 'active';
        }

        const selections = await PackageSelection.find(query)
            .populate('packageId')
            .populate('packageId.providerId', 'firstName lastName email')
            .sort({ selectedAt: -1 });

        res.status(200).json({
            success: true,
            count: selections.length,
            showAll: showAll === 'true',
            data: selections
        });
    } catch (error) {
        console.error('Error fetching my selected packages:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching my selected packages',
            error: error.message
        });
    }
};

// Get a single package by ID
const getPackageById = async (req, res) => {
    try {
        const { id } = req.params;

        const package = await Package.findOne({
            _id: id,
            isActive: true
        }).populate('providerId', 'name email');

        if (!package) {
            return res.status(404).json({
                success: false,
                message: 'Package not found'
            });
        }

        // Get package statistics
        const stats = await updatePackageStats(id);
        const packageObj = package.toObject();
        packageObj.stats = stats;

        res.status(200).json({
            success: true,
            data: packageObj
        });
    } catch (error) {
        console.error('Error fetching package:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching package',
            error: error.message
        });
    }
};

// Create a new package (for providers)
const createPackage = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }

        const userId = req.user.id;
        const {
            planTitle,
            planType,
            associatedNumber,
            totalData,
            resetDate,
            price,
            currency = 'USD',
            description,
            features = [],
            validityDays
        } = req.body;

        // Check if package with this number already exists
        const existingPackage = await Package.findOne({
            associatedNumber,
            isActive: true
        });

        if (existingPackage) {
            return res.status(400).json({
                success: false,
                message: 'A package with this number already exists'
            });
        }

        const newPackage = new Package({
            planTitle,
            planType,
            associatedNumber,
            totalData,
            resetDate: new Date(resetDate),
            providerId: userId,
            price,
            currency,
            description,
            features,
            validityDays
        });

        const savedPackage = await newPackage.save();

        res.status(201).json({
            success: true,
            message: 'Package created successfully',
            data: savedPackage
        });
    } catch (error) {
        console.error('Error creating package:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating package',
            error: error.message
        });
    }
};

// Select/Buy a package (for customers)
const selectPackage = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }

        const { id } = req.params;
        const userId = req.user.id;
        const {
            paymentMethod,
            customerNumber,
            paymentStatus = 'paid' // In real app, this would be handled by payment gateway
        } = req.body;

        const package = await Package.findById(id);

        if (!package) {
            return res.status(404).json({
                success: false,
                message: 'Package not found'
            });
        }

        if (!package.isAvailable) {
            return res.status(400).json({
                success: false,
                message: 'Package is not available for selection'
            });
        }

        // Check if customer already has an ACTIVE selection for this package
        const activeSelection = await PackageSelection.findOne({
            packageId: id,
            customerId: userId,
            status: 'active'
        });

        if (activeSelection) {
            return res.status(400).json({
                success: false,
                message: 'You have already selected this package and it is currently active',
                data: activeSelection
            });
        }

        // Check if there's any previous selection (cancelled, expired, etc.)
        const previousSelection = await PackageSelection.findOne({
            packageId: id,
            customerId: userId
        });

        // If there's a previous selection, we'll allow re-selection
        // This means user can select again after cancelling or if package expired

        // Calculate validity dates
        const validFrom = new Date();
        const validUntil = new Date(validFrom.getTime() + package.validityDays * 24 * 60 * 60 * 1000);

        const newSelection = new PackageSelection({
            packageId: id,
            customerId: userId,
            paymentMethod,
            amountPaid: package.price,
            currency: package.currency,
            validFrom,
            validUntil,
            customerNumber,
            paymentStatus
        });

        const savedSelection = await newSelection.save();

        // Update package customer count
        await updatePackageStats(id);

        res.status(201).json({
            success: true,
            message: 'Package selected successfully',
            data: savedSelection
        });
    } catch (error) {
        console.error('Error selecting package:', error);

        // Handle duplicate key error specifically
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'You have already selected this package',
                error: 'Duplicate selection detected'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error selecting package',
            error: error.message
        });
    }
};

// Update package (provider only)
const updatePackage = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }

        const { id } = req.params;
        const userId = req.user.id;
        const updateData = req.body;

        const package = await Package.findById(id);

        if (!package) {
            return res.status(404).json({
                success: false,
                message: 'Package not found'
            });
        }

        if (package.providerId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only package provider can update package details'
            });
        }

        // If resetDate is being updated, convert to Date object
        if (updateData.resetDate) {
            updateData.resetDate = new Date(updateData.resetDate);
        }

        const updatedPackage = await Package.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Package updated successfully',
            data: updatedPackage
        });
    } catch (error) {
        console.error('Error updating package:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating package',
            error: error.message
        });
    }
};

// Update customer's usage for a selected package
const updatePackageUsage = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { usedData, action = 'set', note = '' } = req.body;

        const selection = await PackageSelection.findOne({
            packageId: id,
            customerId: userId,
            status: 'active'
        });

        if (!selection) {
            return res.status(404).json({
                success: false,
                message: 'Package selection not found or not active'
            });
        }

        // Update usage based on action
        switch (action) {
            case 'add':
                await selection.addUsage(usedData, note);
                break;
            case 'subtract':
                await selection.subtractUsage(usedData, note);
                break;
            case 'set':
            default:
                await selection.setUsage(usedData, note);
                break;
        }

        // Update package total usage
        await updatePackageStats(id);

        res.status(200).json({
            success: true,
            message: 'Package usage updated successfully',
            data: selection
        });
    } catch (error) {
        console.error('Error updating package usage:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating package usage',
            error: error.message
        });
    }
};

// Get usage statistics for a package (provider only)
const getPackageUsageStats = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const package = await Package.findById(id);

        if (!package) {
            return res.status(404).json({
                success: false,
                message: 'Package not found'
            });
        }

        if (package.providerId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only package provider can view usage statistics'
            });
        }

        // Get all selections for this package
        const selections = await PackageSelection.find({
            packageId: id,
            status: 'active'
        })
            .populate('customerId', 'name email')
            .sort({ selectedAt: -1 });

        const stats = {
            package: {
                totalData: package.totalData,
                totalUsedData: package.totalUsedData,
                percentageUsed: package.percentageUsed,
                remainingData: package.remainingData,
                customerCount: package.customerCount
            },
            customers: selections.map(selection => ({
                customerId: selection.customerId,
                usedData: selection.usedData,
                percentageUsed: selection.percentageUsed,
                remainingData: selection.remainingData,
                lastUsageUpdate: selection.lastUsageUpdate,
                validUntil: selection.validUntil
            }))
        };

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching package usage stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching package usage statistics',
            error: error.message
        });
    }
};

// Cancel package selection (customer only)
const cancelPackageSelection = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const selection = await PackageSelection.findOne({
            packageId: id,
            customerId: userId,
            status: 'active'
        });

        if (!selection) {
            return res.status(404).json({
                success: false,
                message: 'Package selection not found or not active'
            });
        }

        // Update selection status
        selection.status = 'cancelled';
        await selection.save();

        // Update package statistics
        await updatePackageStats(id);

        res.status(200).json({
            success: true,
            message: 'Package selection cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling package selection:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling package selection',
            error: error.message
        });
    }
};

// Delete package (provider only)
const deletePackage = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const package = await Package.findById(id);

        if (!package) {
            return res.status(404).json({
                success: false,
                message: 'Package not found'
            });
        }

        if (package.providerId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only package provider can delete packages'
            });
        }

        // Soft delete the package
        await Package.findByIdAndUpdate(id, { isActive: false });

        res.status(200).json({
            success: true,
            message: 'Package deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting package:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting package',
            error: error.message
        });
    }
};

module.exports = {
    getAllAvailablePackages,
    getMyPackages,
    getMySelectedPackages,
    getPackageById,
    createPackage,
    selectPackage,
    checkPackageSelection,
    updatePackage,
    updatePackageUsage,
    getPackageUsageStats,
    cancelPackageSelection,
    deletePackage
};