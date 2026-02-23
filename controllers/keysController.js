const { AppError } = require('../utils/errorHandler');
const crypto = require('crypto');
const ApiKey = require('../models/ApiKey');

const getKeys = async (req, res, next) => {
    try {
        const queryList = await ApiKey.find({ user_id: req.user.id }).sort({ created_at: -1 });

        const mappedKeys = queryList.map(key => ({
            id: key._id,
            name: key.name,
            key: key.key_preview,
            created_at: key.created_at,
            last_used: key.last_used_at,
            status: key.is_active ? 'active' : 'inactive',
            usage_count: key.usage_count
        }));

        res.status(200).json({
            status: 'success',
            data: {
                keys: mappedKeys
            }
        });
    } catch (error) {
        next(error);
    }
};

const createKey = async (req, res, next) => {
    try {
        const { name } = req.body;

        // Generate random string for key
        const rawToken = crypto.randomBytes(32).toString('hex');
        const apiToken = `ev_${rawToken}`;

        // Hash it for db
        const hashedKey = crypto.createHash('sha256').update(apiToken).digest('hex');

        // Generate preview
        const preview = `ev_${rawToken.substring(0, 4)}****************${rawToken.substring(rawToken.length - 4)}`;

        const newKey = await ApiKey.create({
            user_id: req.user.id,
            name: name || 'Default API Key',
            key_hash: hashedKey,
            key_preview: preview,
            rate_limit_per_minute: req.user.plan.name === 'Growth' ? 1000 : (req.user.plan.name === 'Starter' ? 300 : 60)
        });

        res.status(201).json({
            status: 'success',
            data: {
                key: apiToken, // THIS IS THE ONLY TIME THEY GET THE RAW TOKEN
                id: newKey._id,
                name: newKey.name,
                created_at: newKey.created_at
            }
        });

    } catch (error) {
        next(error);
    }
};

const deleteKey = async (req, res, next) => {
    try {
        const key = await ApiKey.findOneAndDelete({ _id: req.params.id, user_id: req.user.id });

        if (!key) {
            return next(new AppError('No API key found with that ID', 404));
        }

        res.status(204).json({
            status: 'success',
            data: null
        });
    } catch (error) {
        next(error);
    }
};

const updateKey = async (req, res, next) => {
    try {
        const { is_active } = req.body;

        const key = await ApiKey.findOneAndUpdate(
            { _id: req.params.id, user_id: req.user.id },
            { is_active },
            { new: true, runValidators: true }
        );

        if (!key) {
            return next(new AppError('No API key found', 404));
        }

        res.status(200).json({
            status: 'success',
            data: {
                key: {
                    id: key._id,
                    is_active: key.is_active
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getKeys,
    createKey,
    deleteKey,
    updateKey
};
