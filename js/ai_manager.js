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
                
                // Already using degrees, no need to convert
                bot.target_angle = targetAngleDegrees;
                return true;
            },
            
            turnTurret: (targetAngleDegrees) => {
                if (bot.isShutdown) return false;
                
                // Set relative angle directly in degrees
                bot.target_turret_angle = targetAngleDegrees;
                return true;
            },
            
            // Direct scan method that returns results immediately
            // Now takes an absolute angle instead of a relative angle
            scan: (absoluteAngle, arcDegrees) => {
                if (bot.isShutdown) return [];
                if (bot.scan_cooldown_remaining > 0) return [];
                
                // Perform the scan and get results directly
                return this.game.performScan(bot, absoluteAngle, arcDegrees);
            },
            
            // New method for more intuitive scanning relative to the bot's direction
            scanRelative: (relativeAngle, arcDegrees) => {
                if (bot.isShutdown) return [];
                if (bot.scan_cooldown_remaining > 0) return [];
                
                // Calculate absolute angle from bot's angle and the relative angle
                const absoluteAngle = this.game.normalizeAngle(bot.angle + relativeAngle);
                
                // Perform the scan and get results directly
                return this.game.performScan(bot, absoluteAngle, arcDegrees);
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
                // Get angle in degrees directly
                const angleDegrees = Math.atan2(dy, dx) * 180 / Math.PI;
                return angleDegrees;
            },
            
            getDistanceTo: (x, y) => {
                const dx = x - bot.x;
                const dy = y - bot.y;
                return Math.hypot(dx, dy);
            },
            
            normalizeAngle: (angleDegrees) => {
                // Normalize to -180 to 180
                return this.game.normalizeAngle(angleDegrees);
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
}
