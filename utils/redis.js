const { createClient } = require('redis');

const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://default:DBuNrwPtPyCD4I2L2s2qkKGClPgy5Zm3@redis-16149.crce263.ap-south-1-1.ec2.cloud.redislabs.com:16149'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis connected successfully'));

(async () => {
    try {
        await redisClient.connect();
    } catch (err) {
        console.error('Initial Redis connection failed', err);
    }
})();

module.exports = redisClient;
