const { AppError } = require('../utils/errorHandler');
const ValidationJob = require('../models/ValidationJob');
const ValidationResult = require('../models/ValidationResult');
const User = require('../models/User');
const validationService = require('../services/validationService');
const FormData = require('form-data');
const sendEmail = require('../utils/email');
const emailTemplates = require('../utils/emailTemplates');
const { logActivity, recordUsage, checkLowCredits, sendWebhook } = require('./accountController');
const { uploadValidationResults } = require('../utils/cloudinary');

const getJobs = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const jobs = await ValidationJob.find({ user_id: req.user.id })
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit);

        const total = await ValidationJob.countDocuments({ user_id: req.user.id });

        res.status(200).json({
            status: 'success',
            data: {
                jobs,
                pagination: {
                    total,
                    page,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

const validateSingle = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return next(new AppError('Please provide an email address', 400));
        }

        const user = await User.findById(req.user.id);
        if (user.credits < 1) {
            return next(new AppError('Insufficient credits', 402));
        }

        // Deduct credit
        user.credits -= 1;
        user.total_validations += 1;
        await user.save();

        const resultPayload = await validationService.validateEmail(email, { verifySMTP: true });

        // Create a ValidationJob so it shows in history
        const statusValue = resultPayload.status || 'unknown';
        const isValid = statusValue === 'valid' ? 1 : 0;
        const isInvalid = statusValue === 'invalid' ? 1 : 0;
        const isCatchAll = statusValue === 'catch_all' ? 1 : 0;
        const isDisposable = resultPayload.checks?.disposable ? 1 : 0;
        const isRoleBased = resultPayload.checks?.role_based ? 1 : 0;

        await ValidationJob.create({
            user_id: req.user.id,
            type: 'single',
            source: 'dashboard',
            total_emails: 1,
            processed_emails: 1,
            progress_percentage: 100,
            valid_count: isValid,
            invalid_count: isInvalid,
            catch_all_count: isCatchAll,
            disposable_count: isDisposable,
            role_based_count: isRoleBased,
            unknown_count: (!isValid && !isInvalid) ? 1 : 0,
            status: 'completed',
            completed_at: new Date(),
            input_data: { email }
        });

        // Record usage and check credits
        await recordUsage(req.user.id, 'single', 1);
        await logActivity(req.user.id, 'validation_single', { email }, req);
        await checkLowCredits(user);

        res.status(200).json({
            status: 'success',
            data: resultPayload,
            user: {
                credits: user.credits,
                total_validations: user.total_validations
            }
        });

    } catch (error) {
        next(error);
    }
};

const validateBulk = async (req, res, next) => {
    try {
        if (!req.file) {
            return next(new AppError('Please provide a file', 400));
        }

        const user = await User.findById(req.user.id);
        const webhookUrl = req.body.webhook_url;

        // Note: For large files, doing it entirely through buffer is okay for ~50MB.
        const ValidationServer = require('../models/ValidationServer');

        // Select a validation server for bulk processing
        const servers = await ValidationServer.find({ isActive: true, isHealthy: true }).sort({ weight: -1 });
        let engineUrl;

        if (servers.length === 0) {
            engineUrl = process.env.VALIDATION_ENGINE_URL || 'http://localhost:3000';
        } else {
            // Use weighted round-robin selection for bulk processing
            const totalWeight = servers.reduce((sum, server) => sum + server.weight, 0);
            let randomWeight = Math.random() * totalWeight;

            for (const server of servers) {
                randomWeight -= server.weight;
                if (randomWeight <= 0) {
                    engineUrl = server.url;
                    break;
                }
            }

            // Fallback to first server if selection fails
            if (!engineUrl) {
                engineUrl = servers[0].url;
            }
        }

        const form = new FormData();
        form.append('csvFile', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
        });

        // Add timeout for bulk validation
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for bulk

        const response = await fetch(`${engineUrl}/v1/validate/bulk/csv`, {
            method: 'POST',
            body: form,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Validation Engine Bulk API Error: ${response.status}`);
        }

        const data = await response.json(); // returns { jobId, status }

        const job = await ValidationJob.create({
            user_id: req.user.id,
            engine_job_id: data.jobId,
            type: 'bulk',
            source: 'dashboard', // Changed from 'app' to match enum values
            total_emails: 0,
            status: 'queued',
            server_used: engineUrl, // Track which server processed the job
            webhook_url: webhookUrl,
            file_info: {
                original_filename: req.file.originalname,
                file_size: req.file.size
            }
        });

        // Use standard structure for response
        res.status(200).json({
            status: 'success',
            data: {
                job_id: job._id,
                total_emails: job.total_emails,
                status: data.status,
                estimated_time_seconds: 60
            }
        });

    } catch (error) {
        console.error('Bulk validation error:', error);

        // Handle specific error types
        if (error.name === 'AbortError') {
            return next(new AppError('Bulk validation request timed out. Please try again with a smaller file.', 408));
        }

        if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
            return next(new AppError('Validation service is currently unavailable. Please try again later.', 503));
        }

        next(error);
    }
};

const getJob = async (req, res, next) => {
    try {
        const localJob = await ValidationJob.findById(req.params.id);
        if (!localJob) return next(new AppError('Job not found locally', 404));
        if (localJob.user_id.toString() !== req.user.id) return next(new AppError('Not authorized', 403));

        if (!localJob.engine_job_id) {
            return res.status(200).json({
                status: 'success',
                data: localJob
            });
        }

        // Fetch from engine with timeout
        const ValidationServer = require('../models/ValidationServer');

        // Find the server that processed this job (if known)
        let engineUrl;
        if (localJob.server_used) {
            // If we know which server processed the job, use that one
            const jobServer = await ValidationServer.findOne({ url: localJob.server_used, isActive: true, isHealthy: true });
            if (jobServer) {
                engineUrl = jobServer.url;
            }
        }

        // If no specific server found or it's not available, pick any healthy server
        if (!engineUrl) {
            const servers = await ValidationServer.find({ isActive: true, isHealthy: true }).sort({ weight: -1 });
            if (servers.length > 0) {
                engineUrl = servers[0].url; // Use first available server
            } else {
                engineUrl = process.env.VALIDATION_ENGINE_URL || 'http://localhost:3000';
            }
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(`${engineUrl}/v1/jobs/${localJob.engine_job_id}`, {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const engineData = await response.json();
            const wasCompleted = localJob.status === 'completed';

            localJob.status = engineData.status;
            localJob.processed_emails = engineData.completed;
            localJob.total_emails = engineData.total;

            if (engineData.status === 'completed' && !localJob.completed_at && !wasCompleted) {
                localJob.completed_at = Date.now();
                // Deduct credits async
                const user = await User.findById(localJob.user_id);
                user.credits = Math.max(0, user.credits - engineData.total);
                user.total_validations += engineData.total;
                await user.save();

                // Record usage & analytics
                await recordUsage(localJob.user_id, 'bulk', engineData.total);
                await logActivity(localJob.user_id, 'validation_bulk', { jobId: localJob._id, total: engineData.total });
                await checkLowCredits(user);

                // Upload results CSV to Cloudinary
                try {
                    const csvResponse = await fetch(`${engineUrl}/v1/jobs/${localJob.engine_job_id}/results/csv`);
                    if (csvResponse.ok) {
                        const csvBuffer = Buffer.from(await csvResponse.arrayBuffer());
                        const uploadResult = await uploadValidationResults(csvBuffer, localJob._id);
                        localJob.result_file = {
                            path: uploadResult.publicId,
                            download_url: uploadResult.secureUrl,
                            expires_at: null, // Cloudinary URLs don't expire
                        };
                    }
                } catch (uploadErr) {
                    console.log('CSV upload to Cloudinary failed (non-critical):', uploadErr.message);
                }

                // Send webhook if configured
                if (localJob.webhook_url) {
                    await sendWebhook(localJob.webhook_url, {
                        event: 'job.completed',
                        job_id: localJob._id,
                        total_emails: engineData.total,
                        status: 'completed',
                        completed_at: localJob.completed_at
                    });
                    await logActivity(localJob.user_id, 'webhook_triggered', { url: localJob.webhook_url, jobId: localJob._id });
                }

                // Send completion email
                try {
                    const downloadUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/history`;
                    await sendEmail({
                        email: user.email,
                        subject: 'SpamGuard - Bulk Validation Job Completed',
                        message: `Your bulk validation job has finished. It processed ${engineData.total} emails. Download results here: ${downloadUrl}`,
                        html: emailTemplates.bulkJobCompleted({ name: user.name, total: engineData.total, downloadUrl }),
                    });
                } catch (err) {
                    console.log('Error sending job completion email', err);
                }
            }
            await localJob.save();
        }

        res.status(200).json({
            status: 'success',
            data: localJob
        });

    } catch (error) {
        console.error('Get job error:', error);

        // Handle connection errors gracefully
        if (error.name === 'AbortError' ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('ENOTFOUND')) {
            // Return local job data if engine is unavailable
            const localJob = await ValidationJob.findById(req.params.id);
            if (localJob) {
                return res.status(200).json({
                    status: 'success',
                    data: localJob,
                    message: 'Validation engine temporarily unavailable, showing local data'
                });
            }
        }

        next(error);
    }
};

const getJobResults = async (req, res, next) => {
    try {
        const localJob = await ValidationJob.findById(req.params.id);
        if (!localJob) return next(new AppError('Job not found locally', 404));
        if (localJob.user_id.toString() !== req.user.id) return next(new AppError('Not authorized', 403));

        if (!localJob.engine_job_id) {
            return res.status(200).json({ status: 'success', data: [] });
        }

        const ValidationServer = require('../models/ValidationServer');

        // Find the server that processed this job (if known)
        let engineUrl;
        if (localJob.server_used) {
            // If we know which server processed the job, use that one
            const jobServer = await ValidationServer.findOne({ url: localJob.server_used, isActive: true, isHealthy: true });
            if (jobServer) {
                engineUrl = jobServer.url;
            }
        }

        // If no specific server found or it's not available, pick any healthy server
        if (!engineUrl) {
            const servers = await ValidationServer.find({ isActive: true, isHealthy: true }).sort({ weight: -1 });
            if (servers.length > 0) {
                engineUrl = servers[0].url; // Use first available server
            } else {
                engineUrl = process.env.VALIDATION_ENGINE_URL || 'http://localhost:3000';
            }
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for results

        const response = await fetch(`${engineUrl}/v1/jobs/${localJob.engine_job_id}/results`, {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return res.status(200).json({ status: 'success', data: [] });
        }

        const engineData = await response.json(); // { jobId: string, results: [] }

        res.status(200).json({
            status: 'success',
            data: {
                jobId: localJob._id,
                results: engineData.results || []
            }
        });
    } catch (error) {
        console.error('Get job results error:', error);

        // Handle connection errors gracefully
        if (error.name === 'AbortError' ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('ENOTFOUND')) {
            return res.status(200).json({
                status: 'success',
                data: [],
                message: 'Validation engine temporarily unavailable, results not available'
            });
        }

        next(error);
    }
};

const cancelJob = async (req, res, next) => {
    try {
        const localJob = await ValidationJob.findById(req.params.id);
        if (!localJob) return next(new AppError('Job not found locally', 404));
        if (localJob.user_id.toString() !== req.user.id) return next(new AppError('Not authorized', 403));

        localJob.status = 'cancelled';
        await localJob.save();

        res.status(200).json({ status: 'success', message: 'Job Cancelled' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getJobs,
    validateSingle,
    validateBulk,
    getJob,
    getJobResults,
    cancelJob
};
