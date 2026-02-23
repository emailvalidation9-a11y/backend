const PricingPlan = require('../models/PricingPlan');
const Transaction = require('../models/Transaction');
const { AppError } = require('../utils/errorHandler');
const sendEmail = require('../utils/email');

const getPlans = async (req, res, next) => {
    try {
        const plans = await PricingPlan.find({ is_active: true, type: 'subscription' })
            .sort({ sort_order: 1 });
        const creditPackages = await PricingPlan.find({ is_active: true, type: 'credit_package' })
            .sort({ sort_order: 1 });

        // If no plans in DB, return legacy hardcoded data as fallback
        if (plans.length === 0) {
            return res.status(200).json({
                status: 'success',
                data: {
                    plans: {
                        free: { name: 'Free', price: 0, credits: 100, features: ['100 validations/month', 'Community support', 'Standard speed'] },
                        starter: { name: 'Starter', price: 9.99, credits: 5000, features: ['5,000 validations/month', 'Basic support', 'Standard speed'] },
                        growth: { name: 'Growth', price: 29.99, credits: 20000, features: ['20,000 validations/month', 'Priority support', 'Fast speed'] }
                    },
                    credit_packages: {
                        basic: { price: 15, credits: 10000 },
                        pro: { price: 50, credits: 50000 }
                    }
                }
            });
        }

        // Formatter for frontend consistency
        const plansObj = {};
        plans.forEach(p => plansObj[p.slug] = p);

        const creditsObj = {};
        creditPackages.forEach(p => creditsObj[p.slug] = p);

        res.status(200).json({
            status: 'success',
            data: { plans: plansObj, credit_packages: creditsObj }
        });
    } catch (error) {
        next(error);
    }
};

const createCheckout = async (req, res, next) => {
    try {
        const { plan, success_url, cancel_url } = req.body;

        // Simulating payment gateway logic
        const existingPlan = await PricingPlan.findOne({ slug: plan });
        if (!existingPlan && plan !== 'free') {
            return next(new AppError('Plan not found', 404));
        }

        // Test payment complete -> Update User
        const creditsLimit = existingPlan ? existingPlan.credits : 100;
        req.user.plan = {
            name: plan,
            status: 'active',
            credits_limit: creditsLimit,
            renewal_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        };
        req.user.credits = creditsLimit;

        if (!req.user.stripe) {
            req.user.stripe = {};
        }
        req.user.stripe.subscription_id = 'test_sub_' + Date.now();
        req.user.stripe.status = 'active';
        await req.user.save();

        await Transaction.create({
            user_id: req.user._id,
            type: 'subscription',
            amount: { paid: existingPlan ? existingPlan.price * 100 : 0, currency: 'usd' },
            credits: { added: creditsLimit, deducted: 0, before: 0, after: creditsLimit },
            description: `Subscribed to ${existingPlan ? existingPlan.name : plan} Plan (Test Gateway)`,
            status: 'success'
        });

        // Send Purchase Email
        try {
            await sendEmail({
                email: req.user.email,
                subject: `Subscription Confirmed: ${existingPlan ? existingPlan.name : plan} Plan`,
                message: `Thank you for subscribing to the ${existingPlan ? existingPlan.name : plan} plan.`,
                html: `<h1>Subscription Confirmed</h1><p>Thank you for subscribing to the <strong>${existingPlan ? existingPlan.name : plan}</strong> plan. Your account has been credited with ${creditsLimit} nodes.</p>`
            });
        } catch (err) {
            console.log('Error sending subscription email', err);
        }

        res.status(200).json({
            status: 'success',
            data: { checkout_url: success_url || `${process.env.FRONTEND_URL}/dashboard` }
        });
    } catch (error) {
        next(error);
    }
};

const purchaseCredits = async (req, res, next) => {
    try {
        const packageName = req.body.package;
        const { success_url, cancel_url } = req.body;

        const creditPack = await PricingPlan.findOne({ slug: packageName, type: 'credit_package' });
        if (!creditPack) {
            return next(new AppError('Credit package not found', 404));
        }

        const addedCredits = creditPack.credits;
        const currentCredits = req.user.credits || 0;
        req.user.credits = currentCredits + addedCredits;
        await req.user.save();

        await Transaction.create({
            user_id: req.user._id,
            type: 'one_time',
            amount: { paid: creditPack.price * 100, currency: 'usd' },
            credits: { added: addedCredits, deducted: 0, before: currentCredits, after: currentCredits + addedCredits },
            description: `Purchased ${creditPack.name} (Test Gateway)`,
            status: 'success'
        });

        // Send Purchase Email
        try {
            await sendEmail({
                email: req.user.email,
                subject: `Credit Purchase Confirmed: ${creditPack.name}`,
                message: `Thank you for purchasing the ${creditPack.name} package.`,
                html: `<h1>Purchase Confirmed</h1><p>Thank you for purchasing the <strong>${creditPack.name}</strong> package! ${addedCredits} nodes have been added to your account.</p>`
            });
        } catch (err) {
            console.log('Error sending credit purchase email', err);
        }

        res.status(200).json({
            status: 'success',
            data: { checkout_url: success_url || `${process.env.FRONTEND_URL}/dashboard` }
        });
    } catch (error) {
        next(error);
    }
};

const getTransactions = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const [transactions, total] = await Promise.all([
            Transaction.find({ user_id: req.user.id })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Transaction.countDocuments({ user_id: req.user.id })
        ]);

        res.status(200).json({
            status: 'success',
            data: {
                transactions,
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getPlans,
    getTransactions,
    createCheckout,
    purchaseCredits
};
