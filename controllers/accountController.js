const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const UsageStat = require('../models/UsageStat');
const Transaction = require('../models/Transaction');
const ValidationJob = require('../models/ValidationJob');
const ApiKey = require('../models/ApiKey');
const { AppError } = require('../utils/errorHandler');
const sendEmail = require('../utils/email');
const emailTemplates = require('../utils/emailTemplates');

// ─── ACTIVITY LOG ────────────────────────────────────────────

// Helper to log activity
const logActivity = async (userId, action, details = {}, req = null) => {
    try {
        await ActivityLog.create({
            user_id: userId,
            action,
            details,
            ip_address: req ? (req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '') : '',
            user_agent: req ? (req.headers['user-agent'] || '') : ''
        });
    } catch (err) {
        console.log('Error logging activity:', err.message);
    }
};

// @desc    Get activity log for current user
// @route   GET /api/account/activity
// @access  Private
const getActivityLog = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const logs = await ActivityLog.find({ user_id: req.user.id })
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit);

        const total = await ActivityLog.countDocuments({ user_id: req.user.id });

        res.status(200).json({
            status: 'success',
            data: {
                activities: logs,
                pagination: { total, page, pages: Math.ceil(total / limit) }
            }
        });
    } catch (error) {
        next(error);
    }
};

// ─── USAGE ANALYTICS ────────────────────────────────────────

// Helper to record daily usage
const recordUsage = async (userId, type = 'single', creditsUsed = 1) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const update = {
            $inc: {
                'validations.total': 1,
                [`validations.${type}`]: 1,
                credits_used: creditsUsed
            }
        };

        await UsageStat.findOneAndUpdate(
            { user_id: userId, date: today },
            update,
            { upsert: true, new: true }
        );
    } catch (err) {
        console.log('Error recording usage:', err.message);
    }
};

// @desc    Get usage analytics for current user
// @route   GET /api/account/usage
// @access  Private
const getUsageStats = async (req, res, next) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        const stats = await UsageStat.find({
            user_id: req.user.id,
            date: { $gte: startDate }
        }).sort({ date: 1 });

        // Aggregate totals
        const totals = stats.reduce((acc, day) => {
            acc.totalValidations += day.validations.total;
            acc.singleValidations += day.validations.single;
            acc.bulkValidations += day.validations.bulk;
            acc.creditsUsed += day.credits_used;
            acc.valid += day.results.valid;
            acc.invalid += day.results.invalid;
            acc.risky += day.results.risky;
            return acc;
        }, { totalValidations: 0, singleValidations: 0, bulkValidations: 0, creditsUsed: 0, valid: 0, invalid: 0, risky: 0 });

        res.status(200).json({
            status: 'success',
            data: {
                period: { days, start: startDate, end: new Date() },
                daily: stats,
                totals
            }
        });
    } catch (error) {
        next(error);
    }
};

// ─── LOW CREDIT ALERTS ─────────────────────────────────────

// Helper to check and send low credit alert
const checkLowCredits = async (user) => {
    try {
        if (!user || !user.plan?.credits_limit) return;

        const threshold = Math.floor(user.plan.credits_limit * 0.2); // 20%
        if (user.credits <= threshold && user.credits > 0) {
            await sendEmail({
                email: user.email,
                subject: 'SpamGuard - Low Credit Alert',
                message: `Your credits are running low! You have ${user.credits} credits remaining out of ${user.plan.credits_limit}.`,
                html: emailTemplates.lowCredits({
                    name: user.name,
                    credits: user.credits,
                    creditsLimit: user.plan.credits_limit,
                    billingUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing`,
                }),
            });
        }
    } catch (err) {
        console.log('Error sending low credit alert:', err.message);
    }
};

// ─── CSV EXPORT ─────────────────────────────────────────────

// @desc    Export validation job results as CSV
// @route   GET /api/account/export/:jobId
// @access  Private
const exportResultsCSV = async (req, res, next) => {
    try {
        const job = await ValidationJob.findById(req.params.jobId);
        if (!job) return next(new AppError('Job not found', 404));
        if (job.user_id.toString() !== req.user.id) return next(new AppError('Not authorized', 403));

        if (!job.engine_job_id) {
            return next(new AppError('No results available for export', 404));
        }

        // Fetch results from engine
        const ValidationServer = require('../models/ValidationServer');
        let engineUrl;
        if (job.server_used) {
            const jobServer = await ValidationServer.findOne({ url: job.server_used, isActive: true, isHealthy: true });
            if (jobServer) engineUrl = jobServer.url;
        }
        if (!engineUrl) {
            const servers = await ValidationServer.find({ isActive: true, isHealthy: true }).sort({ weight: -1 });
            engineUrl = servers.length > 0 ? servers[0].url : (process.env.VALIDATION_ENGINE_URL || 'http://localhost:3000');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(`${engineUrl}/v1/jobs/${job.engine_job_id}/results`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            return next(new AppError('Failed to fetch results from engine', 502));
        }

        const engineData = await response.json();
        const results = engineData.results || [];

        // Build CSV
        const headers = ['email', 'status', 'score', 'reason', 'is_disposable', 'is_role_based', 'mx_found', 'smtp_check'];
        const csvRows = [headers.join(',')];

        results.forEach(r => {
            const row = [
                r.email || '',
                r.status || r.result || '',
                r.score ?? r.confidence ?? '',
                (r.reason || r.sub_status || '').replace(/,/g, ';'),
                r.is_disposable ?? '',
                r.is_role_based ?? r.is_role ?? '',
                r.mx_found ?? r.has_mx ?? '',
                r.smtp_check ?? ''
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');

        // Log export activity
        await logActivity(req.user.id, 'export_results', { jobId: req.params.jobId, count: results.length }, req);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="validation-results-${req.params.jobId}.csv"`);
        res.status(200).send(csvContent);
    } catch (error) {
        if (error.name === 'AbortError') {
            return next(new AppError('Engine timeout during export', 408));
        }
        next(error);
    }
};

// ─── ACCOUNT DELETION (GDPR) ────────────────────────────────

// @desc    Delete user account and all associated data
// @route   DELETE /api/account
// @access  Private
const deleteAccount = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);
        if (!user) return next(new AppError('User not found', 404));

        // Delete all user data
        await Promise.all([
            ActivityLog.deleteMany({ user_id: userId }),
            UsageStat.deleteMany({ user_id: userId }),
            Transaction.deleteMany({ user_id: userId }),
            ValidationJob.deleteMany({ user_id: userId }),
            ApiKey.deleteMany({ user_id: userId }),
        ]);

        // Send goodbye email before deleting
        try {
            await sendEmail({
                email: user.email,
                subject: 'SpamGuard - Account Deleted',
                message: `Your SpamGuard account has been successfully deleted. We're sorry to see you go.`,
                html: emailTemplates.accountDeleted({ name: user.name }),
            });
        } catch (err) {
            console.log('Error sending account deletion email:', err.message);
        }

        // Finally, delete the user
        await User.findByIdAndDelete(userId);

        res.status(200).json({
            status: 'success',
            message: 'Account and all associated data deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// ─── WEBHOOK NOTIFICATIONS ──────────────────────────────────

// Helper to send webhook notification
const sendWebhook = async (webhookUrl, payload) => {
    if (!webhookUrl) return;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
    } catch (err) {
        console.log('Webhook delivery failed:', err.message);
    }
};

module.exports = {
    logActivity,
    recordUsage,
    checkLowCredits,
    sendWebhook,
    getActivityLog,
    getUsageStats,
    exportResultsCSV,
    deleteAccount
};
