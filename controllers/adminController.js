const User = require('../models/User');
const ValidationJob = require('../models/ValidationJob');
const Transaction = require('../models/Transaction');
const ApiKey = require('../models/ApiKey');
const AdminActivity = require('../models/AdminActivity');
const { AppError } = require('../utils/errorHandler');

// ─── Helper: log admin action ─────────────────────────────────
const logAction = async (adminId, action, targetType, targetId, targetLabel, details, req) => {
    try {
        await AdminActivity.create({
            admin: adminId,
            action,
            target_type: targetType,
            target_id: targetId,
            target_label: targetLabel,
            details,
            ip: req?.ip || req?.connection?.remoteAddress
        });
    } catch (err) {
        console.error('Failed to log admin action:', err);
    }
};

// ─── Dashboard Stats ──────────────────────────────────────────
const getStats = async (req, res, next) => {
    try {
        const [
            totalUsers, activeUsers, adminUsers,
            totalJobs, completedJobs,
            totalTransactions, revenueAgg, planCounts,
            recentUsers, recentJobs,
            newUsersToday, newUsersThisWeek,
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ is_active: true }),
            User.countDocuments({ role: 'admin' }),
            ValidationJob.countDocuments(),
            ValidationJob.countDocuments({ status: 'completed' }),
            Transaction.countDocuments(),
            Transaction.aggregate([{ $group: { _id: null, total: { $sum: '$amount.paid' } } }]),
            User.aggregate([{ $group: { _id: '$plan.name', count: { $sum: 1 } } }]),
            User.find().sort({ createdAt: -1 }).limit(5).select('name email plan role createdAt is_active'),
            ValidationJob.find().sort({ createdAt: -1 }).limit(5).populate('user', 'name email'),
            User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
            User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
        ]);

        const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;
        const planDistribution = {};
        planCounts.forEach((p) => { planDistribution[p._id || 'Unknown'] = p.count; });

        res.status(200).json({
            status: 'success',
            data: {
                overview: {
                    totalUsers, activeUsers, adminUsers,
                    totalJobs, completedJobs, totalTransactions, totalRevenue,
                    newUsersToday, newUsersThisWeek,
                },
                planDistribution, recentUsers, recentJobs,
            },
        });
    } catch (error) { next(error); }
};

// ─── List Users ───────────────────────────────────────────────
const getUsers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const skip = (page - 1) * limit;
        const { search, role, plan, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

        const filter = {};
        if (search) { filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }]; }
        if (role) filter.role = role;
        if (plan) filter['plan.name'] = plan;
        if (status === 'active') filter.is_active = true;
        if (status === 'inactive') filter.is_active = false;

        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

        const [users, total] = await Promise.all([
            User.find(filter).sort(sort).skip(skip).limit(limit),
            User.countDocuments(filter),
        ]);

        res.status(200).json({
            status: 'success',
            data: { users, pagination: { total, page, limit, pages: Math.ceil(total / limit) } },
        });
    } catch (error) { next(error); }
};

// ─── Export Users CSV ─────────────────────────────────────────
const exportUsers = async (req, res, next) => {
    try {
        const { search, role, plan, status } = req.query;
        const filter = {};
        if (search) { filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }]; }
        if (role) filter.role = role;
        if (plan) filter['plan.name'] = plan;
        if (status === 'active') filter.is_active = true;
        if (status === 'inactive') filter.is_active = false;

        const users = await User.find(filter).sort({ createdAt: -1 });

        const header = 'ID,Name,Email,Role,Plan,Credits,Validations,Active,Joined\n';
        const rows = users.map(u =>
            `"${u._id}","${u.name}","${u.email}","${u.role}","${u.plan.name}","${u.credits}","${u.total_validations}","${u.is_active}","${u.createdAt?.toISOString()}"`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
        res.send(header + rows);
    } catch (error) { next(error); }
};

// ─── Get Single User ──────────────────────────────────────────
const getUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return next(new AppError('User not found', 404));

        const [apiKeys, jobs, transactions] = await Promise.all([
            ApiKey.find({ user_id: user._id }).sort({ created_at: -1 }).limit(10),
            ValidationJob.find({ user: user._id }).sort({ createdAt: -1 }).limit(10),
            Transaction.find({ user_id: user._id }).sort({ created_at: -1 }).limit(10),
        ]);

        res.status(200).json({
            status: 'success',
            data: { user, apiKeys, jobs, transactions },
        });
    } catch (error) { next(error); }
};

// ─── Update User ──────────────────────────────────────────────
const updateUser = async (req, res, next) => {
    try {
        const { name, email, role, credits, plan, is_active } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return next(new AppError('User not found', 404));

        const before = { name: user.name, email: user.email, role: user.role, credits: user.credits, plan: user.plan.name, is_active: user.is_active };

        if (name) user.name = name;
        if (email) user.email = email;
        if (role) user.role = role;
        if (credits !== undefined) user.credits = credits;
        if (plan?.name) user.plan.name = plan.name;
        if (plan?.credits_limit !== undefined) user.plan.credits_limit = plan.credits_limit;
        if (is_active !== undefined) user.is_active = is_active;

        await user.save({ validateBeforeSave: false });

        await logAction(req.user._id, 'update_user', 'user', user._id, user.email, { before, after: req.body }, req);

        res.status(200).json({ status: 'success', data: { user } });
    } catch (error) { next(error); }
};

// ─── Delete User ──────────────────────────────────────────────
const deleteUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return next(new AppError('User not found', 404));
        if (user._id.toString() === req.user._id.toString()) return next(new AppError('You cannot delete your own account', 400));

        await User.findByIdAndDelete(req.params.id);
        await ApiKey.deleteMany({ user_id: req.params.id });

        await logAction(req.user._id, 'delete_user', 'user', user._id, user.email, { name: user.name, email: user.email }, req);

        res.status(200).json({ status: 'success', message: 'User deleted successfully' });
    } catch (error) { next(error); }
};

// ─── Adjust Credits (relative, signed amount) ─────────────────
const adjustCredits = async (req, res, next) => {
    try {
        const { amount, reason } = req.body;
        if (amount === undefined) return next(new AppError('Amount is required', 400));

        const user = await User.findById(req.params.id);
        if (!user) return next(new AppError('User not found', 404));

        const before = user.credits;
        user.credits = Math.max(0, user.credits + amount);
        await user.save({ validateBeforeSave: false });

        await logAction(req.user._id, 'adjust_credits', 'user', user._id, user.email, { before, after: user.credits, amount, reason }, req);

        res.status(200).json({
            status: 'success',
            data: { user, adjustment: { amount, reason, previousBalance: before, newBalance: user.credits } },
        });
    } catch (error) { next(error); }
};

// ─── Set Credits (absolute) ───────────────────────────────────
const setCredits = async (req, res, next) => {
    try {
        const { credits, reason } = req.body;
        if (credits === undefined || credits < 0) return next(new AppError('Valid credits value required', 400));

        const user = await User.findById(req.params.id);
        if (!user) return next(new AppError('User not found', 404));

        const before = user.credits;
        user.credits = parseInt(credits, 10);
        await user.save({ validateBeforeSave: false });

        await logAction(req.user._id, 'set_credits', 'user', user._id, user.email, { before, after: user.credits, reason }, req);

        res.status(200).json({
            status: 'success',
            data: { user, adjustment: { reason, previousBalance: before, newBalance: user.credits } },
        });
    } catch (error) { next(error); }
};

// ─── Reset Password for User ──────────────────────────────────
const resetUserPassword = async (req, res, next) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) return next(new AppError('Password must be at least 6 characters', 400));

        const user = await User.findById(req.params.id);
        if (!user) return next(new AppError('User not found', 404));

        user.password = newPassword;
        await user.save();

        await logAction(req.user._id, 'reset_password', 'user', user._id, user.email, {}, req);

        res.status(200).json({ status: 'success', message: 'Password reset successfully' });
    } catch (error) { next(error); }
};

// ─── Bulk Operations ──────────────────────────────────────────
const bulkOperation = async (req, res, next) => {
    try {
        const { ids, action, amount, plan } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) return next(new AppError('User IDs required', 400));

        // Remove self from bulk delete to avoid self-deletion
        const safeIds = ids.filter(id => id !== req.user._id.toString());

        let result = { affected: 0, action };

        switch (action) {
            case 'activate':
                await User.updateMany({ _id: { $in: safeIds } }, { is_active: true });
                result.affected = safeIds.length;
                break;
            case 'deactivate':
                await User.updateMany({ _id: { $in: safeIds } }, { is_active: false });
                result.affected = safeIds.length;
                break;
            case 'delete':
                await User.deleteMany({ _id: { $in: safeIds } });
                await ApiKey.deleteMany({ user_id: { $in: safeIds } });
                result.affected = safeIds.length;
                break;
            case 'add_credits':
                if (!amount || amount === 0) return next(new AppError('Amount required for credit operation', 400));
                await User.updateMany({ _id: { $in: ids } }, { $inc: { credits: parseInt(amount, 10) } });
                result.affected = ids.length;
                break;
            case 'set_plan':
                if (!plan) return next(new AppError('Plan required', 400));
                await User.updateMany({ _id: { $in: ids } }, { 'plan.name': plan });
                result.affected = ids.length;
                break;
            case 'make_admin':
                await User.updateMany({ _id: { $in: safeIds } }, { role: 'admin' });
                result.affected = safeIds.length;
                break;
            case 'remove_admin':
                await User.updateMany({ _id: { $in: safeIds } }, { role: 'user' });
                result.affected = safeIds.length;
                break;
            default:
                return next(new AppError('Invalid bulk action', 400));
        }

        await logAction(req.user._id, `bulk_${action}`, 'user', null, `${result.affected} users`, { ids, amount, plan }, req);

        res.status(200).json({ status: 'success', data: result });
    } catch (error) { next(error); }
};

// ─── API Keys Management ──────────────────────────────────────
const getApiKeys = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        const filter = {};
        if (req.query.status === 'active') filter.is_active = true;
        if (req.query.status === 'inactive') filter.is_active = false;

        const [keys, total] = await Promise.all([
            ApiKey.find(filter)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
                .populate('user_id', 'name email'),
            ApiKey.countDocuments(filter),
        ]);

        // Filter by user search after populate
        const filtered = search
            ? keys.filter(k => k.user_id?.name?.match(new RegExp(search, 'i')) || k.user_id?.email?.match(new RegExp(search, 'i')) || k.name?.match(new RegExp(search, 'i')))
            : keys;

        res.status(200).json({
            status: 'success',
            data: { keys: filtered, pagination: { total, page, limit, pages: Math.ceil(total / limit) } },
        });
    } catch (error) { next(error); }
};

const revokeApiKey = async (req, res, next) => {
    try {
        const key = await ApiKey.findById(req.params.id).populate('user_id', 'name email');
        if (!key) return next(new AppError('API key not found', 404));

        key.is_active = false;
        await key.save();

        await logAction(req.user._id, 'revoke_api_key', 'api_key', key._id, `${key.name} (${key.user_id?.email})`, {}, req);

        res.status(200).json({ status: 'success', message: 'API key revoked' });
    } catch (error) { next(error); }
};

const deleteApiKey = async (req, res, next) => {
    try {
        const key = await ApiKey.findByIdAndDelete(req.params.id).populate('user_id', 'email name');
        if (!key) return next(new AppError('API key not found', 404));

        await logAction(req.user._id, 'delete_api_key', 'api_key', key._id, `${key.name} (${key.user_id?.email})`, {}, req);

        res.status(200).json({ status: 'success', message: 'API key deleted' });
    } catch (error) { next(error); }
};

// ─── Admin Activity Log ───────────────────────────────────────
const getActivityLog = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 30;
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            AdminActivity.find()
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
                .populate('admin', 'name email'),
            AdminActivity.countDocuments(),
        ]);

        res.status(200).json({
            status: 'success',
            data: { logs, pagination: { total, page, limit, pages: Math.ceil(total / limit) } },
        });
    } catch (error) { next(error); }
};

// ─── Validation Jobs ──────────────────────────────────────────
const getJobs = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const skip = (page - 1) * limit;
        const statusFilter = req.query.status || '';

        const filter = {};
        if (statusFilter) filter.status = statusFilter;

        const [jobs, total] = await Promise.all([
            ValidationJob.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'name email'),
            ValidationJob.countDocuments(filter),
        ]);

        res.status(200).json({
            status: 'success',
            data: { jobs, pagination: { total, page, limit, pages: Math.ceil(total / limit) } },
        });
    } catch (error) { next(error); }
};

// ─── Transactions ─────────────────────────────────────────────
const getTransactions = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const skip = (page - 1) * limit;

        const [transactions, total] = await Promise.all([
            Transaction.find().sort({ created_at: -1 }).skip(skip).limit(limit).populate('user_id', 'name email'),
            Transaction.countDocuments(),
        ]);

        res.status(200).json({
            status: 'success',
            data: { transactions, pagination: { total, page, limit, pages: Math.ceil(total / limit) } },
        });
    } catch (error) { next(error); }
};

module.exports = {
    getStats, getUsers, exportUsers, getUser,
    updateUser, deleteUser,
    adjustCredits, setCredits, resetUserPassword,
    bulkOperation,
    getApiKeys, revokeApiKey, deleteApiKey,
    getActivityLog, getJobs, getTransactions,
};
