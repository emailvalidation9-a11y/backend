const ValidationServer = require('../models/ValidationServer');
const { AppError } = require('../utils/errorHandler');

// Helper: escape regex special characters to prevent ReDoS / NoSQL injection
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// SSRF protection: validate that a URL is a safe external URL (not internal/private)
const BLOCKED_HOSTNAMES = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', 'metadata.google.internal'];
const PRIVATE_IP_RANGES = [
    /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
    /^169\.254\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
    /^fd[0-9a-f]{2}:/i, /^fe80:/i,
];
const isSafeUrl = (urlStr) => {
    try {
        const parsed = new URL(urlStr);
        if (!['http:', 'https:'].includes(parsed.protocol)) return false;
        const hostname = parsed.hostname.toLowerCase();
        if (BLOCKED_HOSTNAMES.includes(hostname)) return false;
        if (PRIVATE_IP_RANGES.some(re => re.test(hostname))) return false;
        return true;
    } catch {
        return false;
    }
};

// Get all validation servers
const getServers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const { search, isActive } = req.query;

        const filter = {};
        if (search) {
            const s = escapeRegex(search);
            filter.$or = [
                { name: { $regex: s, $options: 'i' } },
                { url: { $regex: s, $options: 'i' } }
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

        // SSRF protection: block requests to internal/private addresses
        if (!isSafeUrl(url)) {
            return next(new AppError('Invalid server URL. Must be a public HTTP(S) URL.', 400));
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

        // If URL is being updated, validate and test the connection
        if (url && url !== server.url) {
            if (!isSafeUrl(url)) {
                return next(new AppError('Invalid server URL. Must be a public HTTP(S) URL.', 400));
            }
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

        // SSRF protection: block requests to internal/private addresses
        if (url && !isSafeUrl(testUrl)) {
            return next(new AppError('Invalid server URL. Must be a public HTTP(S) URL.', 400));
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