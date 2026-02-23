const ValidationServer = require('../models/ValidationServer');
const User = require('../models/User');

// Weighted Round Robin load balancer
let serverIndex = -1;

async function getAvailableServers() {
    return await ValidationServer.find({ 
        isActive: true, 
        isHealthy: true 
    }).sort({ weight: -1 }); // Sort by weight descending
}

async function selectValidationServer() {
    const servers = await getAvailableServers();
    
    if (servers.length === 0) {
        // Fallback to environment variable if no servers configured
        return process.env.VALIDATION_ENGINE_URL || 'http://localhost:3000';
    }
    
    // Weighted round robin selection
    if (servers.length === 1) {
        return servers[0].url;
    }
    
    // Calculate total weight
    const totalWeight = servers.reduce((sum, server) => sum + server.weight, 0);
    
    // Select server based on weights
    let randomWeight = Math.random() * totalWeight;
    for (const server of servers) {
        randomWeight -= server.weight;
        if (randomWeight <= 0) {
            return server.url;
        }
    }
    
    // Fallback to first server
    return servers[0].url;
}

async function updateServerMetrics(serverUrl, success, responseTime) {
    try {
        const server = await ValidationServer.findOne({ url: serverUrl });
        if (server) {
            server.totalRequests += 1;
            
            // Update success rate (simple moving average)
            const newSuccessRate = ((server.successRate * (server.totalRequests - 1)) + (success ? 100 : 0)) / server.totalRequests;
            server.successRate = Math.round(newSuccessRate * 100) / 100;
            
            // Update average response time
            if (success) {
                server.avgResponseTime = ((server.avgResponseTime * (server.totalRequests - 1)) + responseTime) / server.totalRequests;
            }
            
            server.lastHealthCheck = new Date();
            await server.save();
        }
    } catch (error) {
        console.error('Error updating server metrics:', error);
    }
}

const validateEmail = async (email, options = { verifySMTP: true }) => {
    const start = Date.now();
    try {
        const serverUrl = await selectValidationServer();
        const fetchOptions = { skip_smtp: !options.verifySMTP };

        // Add timeout to fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const response = await fetch(`${serverUrl}/v1/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, options: fetchOptions }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const responseTime = Date.now() - start;
        
        if (!response.ok) {
            // Update server metrics for failed request
            await updateServerMetrics(serverUrl, false, responseTime);
            throw new Error(`Validation Engine responded with status: ${response.status}`);
        }

        const data = await response.json();

        // Update server metrics for successful request
        await updateServerMetrics(serverUrl, true, responseTime);

        const domain = email.includes('@') ? email.split('@')[1] : '';

        return {
            email: data.email,
            domain: domain,
            status: data.status,
            checks: {
                syntax_valid: data.syntax,
                mx_found: Array.isArray(data.mx) && data.mx.length > 0,
                smtp_valid: data.smtp ? data.smtp.ok : false,
                catch_all: data.catchall || false,
                disposable: data.disposable || false,
                role_based: data.role || false,
                free_provider: data.free_provider || false
            },
            score: data.score,
            mx_records: data.mx || [],
            smtp_response_code: data.smtp ? (data.smtp.code || '250') : null,
            smtp_response_message: data.smtp ? (data.smtp.response || data.smtp.error) : null,
            response_time_ms: responseTime,
            server_used: serverUrl // Include which server was used
        };
    } catch (error) {
        console.error('Validation Engine Error:', error);
        
        // Handle different types of errors
        if (error.name === 'AbortError') {
            throw new Error('Validation request timed out. Please try again.');
        }
        
        if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
            throw new Error('Validation service is currently unavailable. Please try again later.');
        }
        
        throw error;
    }
};

module.exports = {
    validateEmail
};
