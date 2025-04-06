// ai_manager.js - Handles AI script execution for bots
export class AIManager {
    constructor(game) {
        this.game = game;
        this.aiWorkers = new Map(); // Map of bot ID -> Worker
    }
    
    processBots(dt) {
        for (const bot of this.game.bots) {
            // Skip inactive bots
            if (!bot.isActive) continue;
            
            // Skip manually controlled bot
            if (this.game.controlledBotId === bot.id) continue;
            
            try {
                // Create API for bot to interact with the game
                const api = this.createBotAPI(bot);
                
                // Execute AI code (safe approach)
                this.executeAICode(bot, api);
            } catch (error) {
                console.error(`Error executing AI for bot ${bot.name}:`, error);
                bot.aiError = error.message;
            }
        }
    }
    
    createBotAPI(bot) {
        // Create an API object with methods that the bot's AI can call
        return {
            thrust: (amount) => {
                if (bot.isShutdown) return false;
                
                // Clamp amount between 0 and 1
                const normalizedAmount = Math.max(0, Math.min(1, amount));
                
                // Scale by max speed (considering overburn)
                let maxSpeed = bot.max_speed;
                if (bot.isOverburn) {
                    maxSpeed *= bot.overburn_speed_multiplier;
                }
                
                bot.target_speed = normalizedAmount * maxSpeed;
                return true;
            },
            
            brake: () => {
                if (bot.isShutdown) return false;
                bot.target_speed = 0;
                return true;
            },
            
            turn: (targetAngleDegrees) => {
                if (bot.isShutdown) return false;
                
                // Convert degrees to radians
                const targetAngleRadians = targetAngleDegrees * Math.PI / 180;
                bot.target_angle = targetAngleRadians;
                return true;
            },
            
            turnTurret: (targetAngleDegrees) => {
                if (bot.isShutdown) return false;
                
                // Convert degrees to radians. Angle is always relative to the tank body.
                const targetRelativeAngleRadians = targetAngleDegrees * Math.PI / 180;
                bot.target_turret_angle = targetRelativeAngleRadians; // This is now the target *relative* angle
                return true;
            },
            
            // Updated scan method that directly returns results
            scan: (relativeAngleDegrees, arcDegrees) => {
                if (bot.isShutdown) return null;
                if (bot.scan_cooldown_remaining > 0) return null;
                
                // Convert to radians
                const relativeAngleRadians = relativeAngleDegrees * Math.PI / 180;
                
                // Perform the scan and get results directly - returns array of objects or empty array
                return this.game.performScanImmediate(bot, relativeAngleRadians, arcDegrees);
            },
            
            fire: () => {
                if (bot.isShutdown) return false;
                return this.game.fireProjectile(bot);
            },
            
            overburn: (enable) => {
                if (bot.isShutdown) return false;
                bot.isOverburn = enable;
                return true;
            },

            // Utility methods
            getAngleTo: (x, y) => {
                const dx = x - bot.x;
                const dy = y - bot.y;
                const angleRadians = Math.atan2(dy, dx);
                
                // Convert to degrees
                return angleRadians * 180 / Math.PI;
            },
            
            getDistanceTo: (x, y) => {
                const dx = x - bot.x;
                const dy = y - bot.y;
                return Math.hypot(dx, dy);
            },
            
            normalizeAngle: (angleDegrees) => {
                let angle = angleDegrees;
                while (angle > 180) angle -= 360;
                while (angle < -180) angle += 360;
                return angle;
            },
            
            getArenaSize: () => {
                return {
                    width: this.game.config.ARENA_WIDTH,
                    height: this.game.config.ARENA_HEIGHT
                };
            }
        };
    }
    
    executeAICode(bot, api) {
        // Skip execution if bot is inactive or no AI script provided
        if (!bot.isActive || !bot.aiScript) return;
        
        try {
            // For simplicity, we'll use Function constructor
            // In a production environment, consider using a Web Worker for better sandboxing
            const botInfo = bot.getInfo();
            const memory = bot.memory;
            
            // Wrap user code in a function that takes bot info, API, and memory
            const userFnBody = `
                "use strict";
                try {
                    ${bot.aiScript}
                    if (typeof runBotAI !== "function") {
                        throw new Error("AI script must define runBotAI function");
                    }
                    return runBotAI(botInfo, api, memory);
                } catch (e) {
                    return "ERROR: " + e.message;
                }
            `;
            
            // Execute the AI code
            const userFn = new Function('botInfo', 'api', 'memory', userFnBody);
            const result = userFn(botInfo, api, memory);
            
            // Check for error
            if (typeof result === 'string' && result.startsWith('ERROR:')) {
                bot.aiError = result.substring(7);
            } else {
                bot.aiError = null;
            }
        } catch (error) {
            bot.aiError = error.message;
            console.error(`Error in AI execution for bot ${bot.name}:`, error);
        }
    }
    
    // Advanced implementation would use Web Workers for better isolation
    // and performance, but simplified for this implementation
}
