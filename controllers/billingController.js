const PricingPlan = require('../models/PricingPlan');
const Transaction = require('../models/Transaction');
const { AppError } = require('../utils/errorHandler');
const sendEmail = require('../utils/email');
const emailTemplates = require('../utils/emailTemplates');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const getRazorpayInstance = () => {
    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID || 'dummy_id',
        key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'
    });
};

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
        const { plan, success_url, cancel_url, currency } = req.body;

        const existingPlan = await PricingPlan.findOne({ slug: plan });
        if (!existingPlan && plan !== 'free') {
            return next(new AppError('Plan not found', 404));
        }

        // Handle free plan automatically
        if (plan === 'free' || (existingPlan && existingPlan.price === 0)) {
            const creditsLimit = existingPlan ? existingPlan.credits : 100;
            req.user.plan = {
                name: plan,
                status: 'active',
                credits_limit: creditsLimit,
                renewal_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            };
            req.user.credits = creditsLimit;
            await req.user.save();

            return res.status(200).json({
                status: 'success',
                data: { success: true, message: 'Free plan activated', isFree: true }
            });
        }

        const razorpay = getRazorpayInstance();

        const activeCurrency = currency === 'INR' ? 'INR' : 'USD';
        const exchangeRate = activeCurrency === 'INR' ? 83 : 1;

        const options = {
            amount: Math.round(existingPlan.price * exchangeRate * 100), // convert to smallest unit
            currency: activeCurrency,
            receipt: `r_${req.user._id.toString().slice(-6)}_${Date.now()}`,
            notes: {
                userId: req.user._id.toString(),
                type: 'subscription',
                planSlug: plan
            }
        };

        const order = await razorpay.orders.create(options);

        res.status(200).json({
            status: 'success',
            data: {
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                key: process.env.RAZORPAY_KEY_ID || 'dummy_id'
            }
        });
    } catch (error) {
        next(error);
    }
};

const purchaseCredits = async (req, res, next) => {
    try {
        const { package: packageName, currency } = req.body;

        const creditPack = await PricingPlan.findOne({ slug: packageName, type: 'credit_package' });
        if (!creditPack) {
            return next(new AppError('Credit package not found', 404));
        }

        const razorpay = getRazorpayInstance();

        const activeCurrency = currency === 'INR' ? 'INR' : 'USD';
        const exchangeRate = activeCurrency === 'INR' ? 83 : 1;

        const options = {
            amount: Math.round(creditPack.price * exchangeRate * 100),
            currency: activeCurrency,
            receipt: `r_${req.user._id.toString().slice(-6)}_${Date.now()}`,
            notes: {
                userId: req.user._id.toString(),
                type: 'credit_package',
                packageSlug: packageName
            }
        };

        const order = await razorpay.orders.create(options);

        res.status(200).json({
            status: 'success',
            data: {
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                key: process.env.RAZORPAY_KEY_ID || 'dummy_id'
            }
        });
    } catch (error) {
        next(error);
    }
};

const verifyPayment = async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, type, slug, currency } = req.body;

        const activeCurrency = currency === 'INR' ? 'INR' : 'USD';
        const exchangeRate = activeCurrency === 'INR' ? 83 : 1;

        const generated_signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'dummy_secret')
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            return next(new AppError('Payment verification failed', 400));
        }

        if (type === 'subscription') {
            const existingPlan = await PricingPlan.findOne({ slug: slug });
            const creditsLimit = existingPlan ? existingPlan.credits : 100;
            req.user.plan = {
                name: slug,
                status: 'active',
                credits_limit: creditsLimit,
                renewal_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            };
            req.user.credits = creditsLimit;

            if (!req.user.razorpay) {
                req.user.razorpay = {};
            }
            req.user.razorpay.subscriptionId = razorpay_order_id;
            req.user.razorpay.status = 'active';
            await req.user.save();

            await Transaction.create({
                user_id: req.user._id,
                type: 'subscription',
                amount: { paid: existingPlan ? existingPlan.price * exchangeRate * 100 : 0, currency: activeCurrency },
                credits: { added: creditsLimit, deducted: 0, before: 0, after: creditsLimit },
                description: `Subscribed to ${existingPlan ? existingPlan.name : slug} Plan`,
                status: 'success',
                razorpay: {
                    order_id: razorpay_order_id,
                    payment_id: razorpay_payment_id,
                    signature: razorpay_signature
                }
            });

            try {
                await sendEmail({
                    email: req.user.email,
                    subject: `TrueValidator - Subscription Confirmed: ${existingPlan ? existingPlan.name : slug} Plan`,
                    message: `Thank you for subscribing to the ${existingPlan ? existingPlan.name : slug} plan.`,
                    html: emailTemplates.subscriptionConfirmed({
                        planName: existingPlan ? existingPlan.name : slug,
                        creditsLimit,
                    }),
                });
            } catch (err) { }

        } else if (type === 'credit_package') {
            const creditPack = await PricingPlan.findOne({ slug: slug, type: 'credit_package' });
            const addedCredits = creditPack ? creditPack.credits : 0;
            const currentCredits = req.user.credits || 0;
            req.user.credits = currentCredits + addedCredits;
            await req.user.save();

            await Transaction.create({
                user_id: req.user._id,
                type: 'one_time',
                amount: { paid: creditPack ? creditPack.price * exchangeRate * 100 : 0, currency: activeCurrency },
                credits: { added: addedCredits, deducted: 0, before: currentCredits, after: currentCredits + addedCredits },
                description: `Purchased ${creditPack ? creditPack.name : slug} Batch`,
                status: 'success',
                razorpay: {
                    order_id: razorpay_order_id,
                    payment_id: razorpay_payment_id,
                    signature: razorpay_signature
                }
            });

            try {
                await sendEmail({
                    email: req.user.email,
                    subject: `TrueValidator - Credit Purchase Confirmed: ${creditPack ? creditPack.name : slug}`,
                    message: `Thank you for purchasing the ${creditPack ? creditPack.name : slug} package.`,
                    html: emailTemplates.creditPurchaseConfirmed({
                        packName: creditPack ? creditPack.name : slug,
                        addedCredits,
                    }),
                });
            } catch (err) { }
        }

        res.status(200).json({ status: 'success', message: 'Payment verified successfully' });
    } catch (err) {
        next(err);
    }
}

const getTransactions = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
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
    purchaseCredits,
    verifyPayment
};
