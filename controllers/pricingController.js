const PricingPlan = require('../models/PricingPlan');
const Coupon = require('../models/Coupon');
const { AppError } = require('../utils/errorHandler');

// ─── PUBLIC: Get active plans ─────────────────────────────────
const getPublicPlans = async (req, res, next) => {
    try {
        const plans = await PricingPlan.find({ is_active: true, type: 'subscription' })
            .sort({ sort_order: 1 });
        const creditPackages = await PricingPlan.find({ is_active: true, type: 'credit_package' })
            .sort({ sort_order: 1 });

        res.status(200).json({
            status: 'success',
            data: { plans, creditPackages }
        });
    } catch (error) {
        next(error);
    }
};

// ─── PUBLIC: Validate coupon ──────────────────────────────────
const validateCoupon = async (req, res, next) => {
    try {
        const { code, planId } = req.body;
        if (!code) return next(new AppError('Coupon code is required', 400));

        const coupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (!coupon) return next(new AppError('Invalid coupon code', 404));
        if (!coupon.isValid()) return next(new AppError('This coupon is expired or no longer valid', 400));

        // Check if applicable to the given plan
        if (coupon.applicable_plans.length > 0 && planId) {
            if (!coupon.applicable_plans.some(p => p.toString() === planId)) {
                return next(new AppError('This coupon is not applicable to the selected plan', 400));
            }
        }

        // Check per-user usage
        if (req.user) {
            const userUsage = coupon.used_by.filter(u => u.user_id.toString() === req.user.id.toString());
            if (userUsage.length >= coupon.max_uses_per_user) {
                return next(new AppError('You have already used this coupon the maximum number of times', 400));
            }
        }

        res.status(200).json({
            status: 'success',
            data: {
                coupon: {
                    code: coupon.code,
                    discount_type: coupon.discount_type,
                    discount_value: coupon.discount_value,
                    max_discount: coupon.max_discount,
                    bonus_credits: coupon.bonus_credits,
                    description: coupon.description
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// ─── ADMIN: Get all plans ─────────────────────────────────────
const getPlans = async (req, res, next) => {
    try {
        const { type } = req.query;
        const filter = {};
        if (type) filter.type = type;

        const plans = await PricingPlan.find(filter).sort({ type: 1, sort_order: 1 });

        res.status(200).json({
            status: 'success',
            data: { plans }
        });
    } catch (error) {
        next(error);
    }
};

// ─── ADMIN: Create plan ───────────────────────────────────────
const createPlan = async (req, res, next) => {
    try {
        const { name, price, interval, credits, features, is_popular, type, description, cta_text, sort_order, per_credit_cost } = req.body;
        if (!name) return next(new AppError('Plan name is required', 400));

        // Auto-generate slug
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        // Check for duplicate slug
        const existing = await PricingPlan.findOne({ slug });
        if (existing) return next(new AppError('A plan with this name already exists', 400));

        const plan = await PricingPlan.create({
            name, slug, price: price || 0, interval, credits: credits || 0,
            features: features || [], is_popular: is_popular || false,
            type: type || 'subscription', description, cta_text,
            sort_order: sort_order || 0, per_credit_cost: per_credit_cost || 0
        });

        res.status(201).json({ status: 'success', data: { plan } });
    } catch (error) {
        next(error);
    }
};

// ─── ADMIN: Update plan ───────────────────────────────────────
const updatePlan = async (req, res, next) => {
    try {
        const plan = await PricingPlan.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!plan) return next(new AppError('Plan not found', 404));

        res.status(200).json({ status: 'success', data: { plan } });
    } catch (error) {
        next(error);
    }
};

// ─── ADMIN: Delete plan ───────────────────────────────────────
const deletePlan = async (req, res, next) => {
    try {
        const plan = await PricingPlan.findByIdAndDelete(req.params.id);
        if (!plan) return next(new AppError('Plan not found', 404));

        res.status(200).json({ status: 'success', message: 'Plan deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// ─── ADMIN: Seed default plans ────────────────────────────────
const seedPlans = async (req, res, next) => {
    try {
        const count = await PricingPlan.countDocuments();
        if (count > 0) return next(new AppError('Plans already exist. Delete all plans first to re-seed.', 400));

        const defaultPlans = [
            {
                name: 'Free', slug: 'free', price: 0, interval: 'month', credits: 100,
                features: ['100 validations/month', 'API access', 'Community support'],
                type: 'subscription', sort_order: 0, cta_text: 'Start Free',
                description: 'Perfect for trying out our service'
            },
            {
                name: 'Starter', slug: 'starter', price: 19, interval: 'month', credits: 5000,
                features: ['5,000 validations/month', 'Bulk list validation', 'SMTP verification', 'Email support'],
                type: 'subscription', is_popular: true, sort_order: 1, cta_text: 'Get Starter Plan',
                description: 'Great for small businesses'
            },
            {
                name: 'Pro', slug: 'pro', price: 79, interval: 'month', credits: 50000,
                features: ['50,000 validations/month', 'Priority processing', 'Priority ticket support'],
                type: 'subscription', sort_order: 2, cta_text: 'Get Pro Plan',
                description: 'For growing teams and high volumes'
            },
            {
                name: '1,000 Credits', slug: '1000-credits', price: 9, credits: 1000,
                type: 'credit_package', sort_order: 0, per_credit_cost: 0.009,
                description: 'Small pack'
            },
            {
                name: '10,000 Credits', slug: '10000-credits', price: 49, credits: 10000,
                type: 'credit_package', sort_order: 1, per_credit_cost: 0.0049,
                description: 'Medium pack'
            },
            {
                name: '100,000 Credits', slug: '100000-credits', price: 299, credits: 100000,
                type: 'credit_package', sort_order: 2, per_credit_cost: 0.00299,
                description: 'Enterprise pack'
            }
        ];

        await PricingPlan.insertMany(defaultPlans);

        res.status(201).json({
            status: 'success',
            message: `Seeded ${defaultPlans.length} default plans`,
            data: { count: defaultPlans.length }
        });
    } catch (error) {
        next(error);
    }
};

// ═══════════════════════════════════════════════════════════════
// COUPONS
// ═══════════════════════════════════════════════════════════════

// ─── ADMIN: Get all coupons ───────────────────────────────────
const getCoupons = async (req, res, next) => {
    try {
        const { search, is_active } = req.query;
        const filter = {};
        if (search) filter.code = { $regex: search, $options: 'i' };
        if (is_active !== undefined) filter.is_active = is_active === 'true';

        const coupons = await Coupon.find(filter)
            .populate('applicable_plans', 'name slug type')
            .sort({ createdAt: -1 });

        res.status(200).json({ status: 'success', data: { coupons } });
    } catch (error) {
        next(error);
    }
};

// ─── ADMIN: Create coupon ─────────────────────────────────────
const createCoupon = async (req, res, next) => {
    try {
        const { code, description, discount_type, discount_value, max_discount,
            bonus_credits, applicable_plans, min_purchase_amount,
            max_uses, max_uses_per_user, starts_at, expires_at } = req.body;

        if (!code || !discount_type || discount_value === undefined) {
            return next(new AppError('Code, discount type, and discount value are required', 400));
        }

        const existing = await Coupon.findOne({ code: code.toUpperCase() });
        if (existing) return next(new AppError('A coupon with this code already exists', 400));

        const coupon = await Coupon.create({
            code: code.toUpperCase(),
            description, discount_type, discount_value,
            max_discount, bonus_credits,
            applicable_plans: applicable_plans || [],
            min_purchase_amount: min_purchase_amount || 0,
            max_uses: max_uses || null,
            max_uses_per_user: max_uses_per_user || 1,
            starts_at: starts_at || new Date(),
            expires_at: expires_at || null
        });

        res.status(201).json({ status: 'success', data: { coupon } });
    } catch (error) {
        next(error);
    }
};

// ─── ADMIN: Update coupon ─────────────────────────────────────
const updateCoupon = async (req, res, next) => {
    try {
        // Don't allow changing the code
        if (req.body.code) delete req.body.code;

        const coupon = await Coupon.findByIdAndUpdate(
            req.params.id, req.body,
            { new: true, runValidators: true }
        ).populate('applicable_plans', 'name slug type');

        if (!coupon) return next(new AppError('Coupon not found', 404));

        res.status(200).json({ status: 'success', data: { coupon } });
    } catch (error) {
        next(error);
    }
};

// ─── ADMIN: Delete coupon ─────────────────────────────────────
const deleteCoupon = async (req, res, next) => {
    try {
        const coupon = await Coupon.findByIdAndDelete(req.params.id);
        if (!coupon) return next(new AppError('Coupon not found', 404));

        res.status(200).json({ status: 'success', message: 'Coupon deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// ─── ADMIN: Get system config (dynamic) ───────────────────────
const getSystemConfig = async (req, res, next) => {
    try {
        const mongoose = require('mongoose');
        const conn = mongoose.connection;

        const config = {
            server: {
                title: 'Server Environment',
                items: [
                    { label: 'Node Environment', value: process.env.NODE_ENV || 'development' },
                    { label: 'API Port', value: process.env.PORT || '5000' },
                    { label: 'Frontend URL', value: process.env.FRONTEND_URL || 'http://localhost:5173' },
                    { label: 'Node Version', value: process.version },
                ]
            },
            database: {
                title: 'Database',
                items: [
                    { label: 'Provider', value: 'MongoDB Atlas' },
                    { label: 'Connection', value: conn.readyState === 1 ? 'Connected' : 'Disconnected' },
                    { label: 'Database', value: conn.name || 'N/A' },
                    { label: 'Host', value: conn.host || 'N/A' },
                ]
            },
            auth: {
                title: 'Authentication',
                items: [
                    { label: 'JWT Expiry', value: process.env.JWT_EXPIRES_IN || '7d' },
                    { label: 'Token Type', value: 'Bearer (JWT)' },
                ]
            },
            rateLimiting: {
                title: 'Rate Limiting',
                items: [
                    { label: 'Window', value: `${(parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000) / 1000} seconds` },
                    { label: 'Max Requests', value: process.env.RATE_LIMIT_MAX_REQUESTS || '100' },
                ]
            },
            validation: {
                title: 'Validation Engine',
                items: [
                    { label: 'Default URL', value: process.env.VALIDATION_ENGINE_URL || 'http://localhost:3000' },
                ]
            }
        };

        res.status(200).json({ status: 'success', data: { config } });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    // Public
    getPublicPlans,
    validateCoupon,
    // Admin Plans
    getPlans,
    createPlan,
    updatePlan,
    deletePlan,
    seedPlans,
    // Admin Coupons
    getCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    // Admin Config
    getSystemConfig
};
