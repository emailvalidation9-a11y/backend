const ValidationServer = require('../models/ValidationServer');
const { AppError } = require('../utils/errorHandler');

// Get all validation servers
const getServers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const { search, isActive } = req.query;

        const filter = {};
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { url: { $regex: search, $options: 'i' } }
            ];
        }
        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        const [servers, total] = await Promise.all([
            ValidationServer.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ValidationServer.countDocuments(filter)
        ]);

        res.status(200).json({
            status: 'success',
            data: {
                servers,
                pagination: {
                    total,
                    page,
                    limit,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error in getServers:', error);
        next(error);
    }
};

// Get a single validation server
const getServer = async (req, res, next) => {
    try {
        const server = await ValidationServer.findById(req.params.id)
            .populate('createdBy', 'name email');

        if (!server) {
            return next(new AppError('Validation server not found', 404));
        }

        res.status(200).json({
            status: 'success',
            data: { server }
        });
    } catch (error) {
        next(error);
    }
};

// Create a new validation server
const createServer = async (req, res, next) => {
    try {
        const { name, url, weight } = req.body;

        // Validate required fields
        if (!name || !url) {
            return next(new AppError('Name and URL are required', 400));
        }

        // Check if URL already exists
        const existingServer = await ValidationServer.findOne({ url });
        if (existingServer) {
            return next(new AppError('A server with this URL already exists', 400));
        }

        // Test the server connection before adding
        try {
            const testResponse = await fetch(`${url}/health`);
            if (!testResponse.ok) {
                return next(new AppError('Cannot connect to the validation server. Please check the URL and ensure the server is running.', 400));
            }
        } catch (error) {
            return next(new AppError('Cannot connect to the validation server. Please check the URL and ensure the server is running.', 400));
        }

        const server = await ValidationServer.create({
            name,
            url,
            weight: weight || 1,
            createdBy: req.user.id
        });

        res.status(201).json({
            status: 'success',
            data: { server }
        });
    } catch (error) {
        next(error);
    }
};

// Update a validation server
const updateServer = async (req, res, next) => {
    try {
        const { name, url, weight, isActive } = req.body;

        const server = await ValidationServer.findById(req.params.id);
        if (!server) {
            return next(new AppError('Validation server not found', 404));
        }

        // If URL is being updated, test the connection
        if (url && url !== server.url) {
            try {
                const testResponse = await fetch(`${url}/health`);
                if (!testResponse.ok) {
                    return next(new AppError('Cannot connect to the validation server. Please check the URL and ensure the server is running.', 400));
                }
            } catch (error) {
                return next(new AppError('Cannot connect to the validation server. Please check the URL and ensure the server is running.', 400));
            }
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (url) updateData.url = url;
        if (weight !== undefined) updateData.weight = weight;
        if (isActive !== undefined) updateData.isActive = isActive;

        const updatedServer = await ValidationServer.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('createdBy', 'name email');

        res.status(200).json({
            status: 'success',
            data: { server: updatedServer }
        });
    } catch (error) {
        next(error);
    }
};

// Delete a validation server
const deleteServer = async (req, res, next) => {
    try {
        const server = await ValidationServer.findByIdAndDelete(req.params.id);

        if (!server) {
            return next(new AppError('Validation server not found', 404));
        }

        res.status(200).json({
            status: 'success',
            message: 'Validation server deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Test a validation server connection
const testServer = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { url } = req.body; // Allow testing a URL without saving

        let testUrl = url;
        if (!testUrl && id) {
            const server = await ValidationServer.findById(id);
            if (!server) {
                return next(new AppError('Validation server not found', 404));
            }
            testUrl = server.url;
        } else if (!testUrl && !id) {
            return next(new AppError('Either server ID or URL must be provided', 400));
        }

        const startTime = Date.now();
        const response = await fetch(`${testUrl}/health`);
        const responseTime = Date.now() - startTime;

        if (response.ok) {
            const healthData = await response.json();
            res.status(200).json({
                status: 'success',
                data: {
                    isHealthy: true,
                    responseTime,
                    healthData
                }
            });
        } else {
            res.status(200).json({
                status: 'success',
                data: {
                    isHealthy: false,
                    responseTime,
                    statusCode: response.status
                }
            });
        }
    } catch (error) {
        res.status(200).json({
            status: 'success',
            data: {
                isHealthy: false,
                error: error.message
            }
        });
    }
};

// Update server health status
const updateHealthStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { isHealthy } = req.body;

        const server = await ValidationServer.findByIdAndUpdate(
            id,
            {
                isHealthy,
                lastHealthCheck: new Date()
            },
            { new: true }
        );

        if (!server) {
            return next(new AppError('Validation server not found', 404));
        }

        res.status(200).json({
            status: 'success',
            data: { server }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getServers,
    getServer,
    createServer,
    updateServer,
    deleteServer,
    testServer,
    updateHealthStatus
};