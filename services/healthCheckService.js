const ValidationServer = require('../models/ValidationServer');

class HealthCheckService {
    constructor() {
        this.checkInterval = 300000; // 5 minutes
        this.running = false;
    }

    async checkServerHealth(server) {
        try {
            const startTime = Date.now();
            const response = await fetch(`${server.url}/health`, {
                timeout: 10000 // 10 second timeout
            });

            const responseTime = Date.now() - startTime;

            const healthData = response.ok ? await response.json() : null;

            // Update server health status
            server.isHealthy = response.ok;
            server.lastHealthCheck = new Date();
            server.avgResponseTime = responseTime;

            // Update success rate (simple approach)
            if (response.ok) {
                server.successRate = Math.min(100, server.successRate + 1);
            } else {
                server.successRate = Math.max(0, server.successRate - 5);
            }

            await server.save();

            console.log(`Health check for ${server.name} (${server.url}): ${response.ok ? 'HEALTHY' : 'UNHEALTHY'} - ${responseTime}ms`);

            return {
                serverId: server._id,
                isHealthy: response.ok,
                responseTime,
                healthData
            };
        } catch (error) {
            console.error(`Health check failed for ${server.name} (${server.url}):`, error.message);

            // Mark as unhealthy
            server.isHealthy = false;
            server.lastHealthCheck = new Date();

            // Decrease success rate
            server.successRate = Math.max(0, server.successRate - 5);

            await server.save();

            return {
                serverId: server._id,
                isHealthy: false,
                error: error.message
            };
        }
    }

    async checkAllServers() {
        try {
            const servers = await ValidationServer.find({ isActive: true });
            const results = [];

            for (const server of servers) {
                const result = await this.checkServerHealth(server);
                results.push(result);
            }

            return results;
        } catch (error) {
            console.error('Error checking all servers:', error);
            return [];
        }
    }

    async start() {
        if (this.running) {
            console.log('Health check service is already running');
            return;
        }

        console.log('Starting validation server health check service...');
        this.running = true;

        // Run initial check
        await this.checkAllServers();

        // Set up interval
        this.interval = setInterval(async () => {
            await this.checkAllServers();
        }, this.checkInterval);

        console.log(`Health check service started. Checking every ${this.checkInterval / 1000} seconds.`);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.running = false;
        console.log('Health check service stopped.');
    }
}

// Singleton instance
const healthCheckService = new HealthCheckService();

module.exports = healthCheckService;