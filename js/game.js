// game.js - Core game logic for Algo Bots 2D
import { Bot } from './bot.js';
import { Projectile } from './projectile.js';
import { Collision } from './collision.js';
import { AIManager } from './ai_manager.js';
import { Renderer } from './renderer.js';
import { Explosion } from './explosion.js'; // Import the new Explosion class

// Game states
const GameState = {
    SETUP: 'setup',
    RUNNING: 'running',
    PAUSED: 'paused',
    GAME_OVER: 'gameover'
};

export class Game {
    constructor() {
        // Game configuration
        this.config = {
            ARENA_WIDTH: 800,
            ARENA_HEIGHT: 800,
            FPS_CAP: 60,
            MIN_BOT_DISTANCE: 100 // Minimum distance between bots at placement
        };
        
        // Game state
        this.state = GameState.SETUP;
        this.bots = [];
        this.projectiles = [];
        this.explosions = [];
        this.scans = [];
        this.lastFrameTime = 0;
        this.animationFrameId = null;
        this.controlledBotId = null;
        this.speedMultiplier = 1.0; // Default speed multiplier
        this.uiCallbacks = {
            updateBotsStatus: () => {},
            showGameOver: () => {}
        };
        
        // Initialize subsystems
        this.collision = new Collision(this);
        this.aiManager = new AIManager(this);
        this.renderer = new Renderer(this);
        
        // Bind methods
        this.gameLoop = this.gameLoop.bind(this);
    }
    
    setUICallbacks(callbacks) {
        this.uiCallbacks = { ...this.uiCallbacks, ...callbacks };
    }
    
    setCanvas(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.renderer.setContext(this.ctx);
    }
    
    // Utility functions for angle conversions
    degreesToRadians(degrees) {
        return degrees * Math.PI / 180;
    }
    
    radiansToDegrees(radians) {
        return radians * 180 / Math.PI;
    }
    
    // Utility function to normalize angle to [-180, 180] degrees
    normalizeAngle(angleDegrees) {
        let angle = angleDegrees;
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        return angle;
    }
    
    // Start the game
    start(botConfigs) {
        if (this.state !== GameState.SETUP) return;
        if (!botConfigs || botConfigs.length < 2) {
            console.error('At least 2 bots required to start the game');
            return;
        }
        
        // Reset game
        this.bots = [];
        this.projectiles = [];
        this.explosions = [];
        this.scans = [];
        
        // Create bots from configurations
        this.createBots(botConfigs);
        
        // Start game loop
        this.state = GameState.RUNNING;
        this.lastFrameTime = performance.now();
        this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }
    
    createBots(botConfigs) {
        for (let config of botConfigs) {
            // Generate bot position with minimum separation
            let position;
            let attempts = 0;
            const maxAttempts = 100;
            
            do {
                position = {
                    x: Math.random() * (this.config.ARENA_WIDTH - 100) + 50,
                    y: Math.random() * (this.config.ARENA_HEIGHT - 100) + 50
                };
                attempts++;
            } while (
                attempts < maxAttempts && 
                this.bots.some(bot => 
                    Math.hypot(bot.x - position.x, bot.y - position.y) < this.config.MIN_BOT_DISTANCE
                )
            );
            
            // Create bot with random angle, but with turret initially aligned with the tank body
            const randomAngle = Math.random() * 360;
            const bot = new Bot({
                id: crypto.randomUUID(),
                name: config.name,
                color: config.color,
                x: position.x,
                y: position.y,
                angle: randomAngle,
                turret_angle: randomAngle, // Turret starts aligned with tank body
                aiScript: config.aiScript
            });
            
            this.bots.push(bot);
        }
    }
    
    // Game loop
    gameLoop(timestamp) {
        if (this.state !== GameState.RUNNING) return;
        
        // Calculate delta time (in seconds)
        let dt = Math.min((timestamp - this.lastFrameTime) / 1000, 1/30); // Cap at 30 FPS equivalent
        
        // Apply speed multiplier to delta time
        dt *= this.speedMultiplier;
        
        this.lastFrameTime = timestamp;
        
        // Process AI for each bot
        this.aiManager.processBots(dt);
        
        // Update game entities
        this.updateBots(dt);
        this.updateProjectiles(dt);
        this.updateExplosions(dt);
        this.updateScans(dt);
        
        // Check collisions
        this.collision.detectCollisions();
        
        // Check win condition
        this.checkWinCondition();
        
        // Render the game
        this.renderer.render();
        
        // Update UI
        this.uiCallbacks.updateBotsStatus(this.bots);
        
        // Continue game loop
        this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }
    
    updateBots(dt) {
        for (const bot of this.bots) {
            if (!bot.isActive) continue;
            
            // Update heat
            if (bot.isOverburn) {
                bot.heat += bot.heat_generation_overburn * dt;
            }
            
            bot.heat = Math.max(0, bot.heat - bot.heat_dissipation_rate * dt);
            
            // Check for shutdown state
            if (bot.heat >= bot.max_heat) {
                bot.isShutdown = true;
            } else if (bot.isShutdown && bot.heat < 0.9 * bot.max_heat) {
                bot.isShutdown = false;
            }
            
            // Skip movement updates if shutdown
            if (bot.isShutdown) continue;
            
            // Rotate ship
            const angleDiff = this.normalizeAngle(bot.target_angle - bot.angle);
            const maxRotation = bot.max_ship_rotation_speed * dt;
            
            if (Math.abs(angleDiff) <= maxRotation) {
                bot.angle = bot.target_angle;
            } else {
                bot.angle += maxRotation * Math.sign(angleDiff);
            }

            // Rotate turret (always relative to the ship now)
            // target_turret_angle is the desired *relative* angle
            const relativeDiff = this.normalizeAngle(bot.target_turret_angle - bot.relativeTurretAngle);
            const maxTurretRotation = bot.max_turret_rotation_speed * dt;

            if (Math.abs(relativeDiff) <= maxTurretRotation) {
                bot.relativeTurretAngle = bot.target_turret_angle;
            } else {
                bot.relativeTurretAngle += maxTurretRotation * Math.sign(relativeDiff);
            }

            // Calculate absolute turret angle from ship angle and relative angle
            bot.turret_angle = this.normalizeAngle(bot.angle + bot.relativeTurretAngle);
            
            // NEW: Update scan angle (independent of turret)
            // Simply set scan_angle to target_scan_angle directly, no gradual rotation
            // This allows instant scanning in any direction
            bot.scan_angle = bot.target_scan_angle;

            // Update speed
            const speedDiff = bot.target_speed - bot.current_speed;
            if (Math.abs(speedDiff) < 0.1) {
                bot.current_speed = bot.target_speed;
            } else if (speedDiff > 0) {
                // Accelerating
                bot.current_speed += bot.acceleration * dt;
                if (bot.current_speed > bot.target_speed) {
                    bot.current_speed = bot.target_speed;
                }
            } else {
                // Braking
                bot.current_speed -= bot.braking_power * dt;
                if (bot.current_speed < 0) {
                    bot.current_speed = 0;
                }
            }
            
            // Apply passive deceleration if not at target speed
            if (bot.target_speed === 0 && bot.current_speed > 0) {
                bot.current_speed = Math.max(0, bot.current_speed - (bot.braking_power * 0.5) * dt);
            }
            
            // Calculate velocity components
            bot.velocityX = Math.cos(this.degreesToRadians(bot.angle)) * bot.current_speed;
            bot.velocityY = Math.sin(this.degreesToRadians(bot.angle)) * bot.current_speed;
            
            // Update position
            bot.x += bot.velocityX * dt;
            bot.y += bot.velocityY * dt;
            
            // Boundary checks
            if (bot.x - bot.ship_radius < 0) {
                bot.x = bot.ship_radius;
                bot.velocityX = 0;
            }
            if (bot.x + bot.ship_radius > this.config.ARENA_WIDTH) {
                bot.x = this.config.ARENA_WIDTH - bot.ship_radius;
                bot.velocityX = 0;
            }
            if (bot.y - bot.ship_radius < 0) {
                bot.y = bot.ship_radius;
                bot.velocityY = 0;
            }
            if (bot.y + bot.ship_radius > this.config.ARENA_HEIGHT) {
                bot.y = this.config.ARENA_HEIGHT - bot.ship_radius;
                bot.velocityY = 0;
            }
            
            // Update cooldowns
            bot.fire_cooldown_remaining = Math.max(0, bot.fire_cooldown_remaining - dt);
            bot.scan_cooldown_remaining = Math.max(0, bot.scan_cooldown_remaining - dt);
        }
    }
    
    updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            
            // Previous position for collision detection
            const prevX = proj.x;
            const prevY = proj.y;
            
            // Update position
            proj.x += proj.vx * dt;
            proj.y += proj.vy * dt;
            
            // Check if projectile is hitting arena boundaries
            let hitWall = false;
            let wallPosition = { x: proj.x, y: proj.y };
            
            // Check horizontal walls
            if (proj.x < 0) {
                wallPosition.x = 0;
                hitWall = true;
            } else if (proj.x > this.config.ARENA_WIDTH) {
                wallPosition.x = this.config.ARENA_WIDTH;
                hitWall = true;
            }
            
            // Check vertical walls
            if (proj.y < 0) {
                wallPosition.y = 0;
                hitWall = true;
            } else if (proj.y > this.config.ARENA_HEIGHT) {
                wallPosition.y = this.config.ARENA_HEIGHT;
                hitWall = true;
            }
            
            // Create explosion if projectile hit a wall
            if (hitWall) {
                // Create smaller explosion for wall impacts
                this.createExplosion(
                    wallPosition.x,
                    wallPosition.y,
                    proj.radius * 3, // Smaller than bot explosions
                    proj.damage / 3, // Reduced damage
                    0.3 // Shorter duration
                );
                
                // Remove the projectile that hit the wall
                this.projectiles.splice(i, 1);
                continue;
            }
            
            // Check if projectile is way outside arena boundaries (safety check)
            if (
                proj.x < -proj.radius * 10 || 
                proj.x > this.config.ARENA_WIDTH + proj.radius * 10 ||
                proj.y < -proj.radius * 10 || 
                proj.y > this.config.ARENA_HEIGHT + proj.radius * 10
            ) {
                this.projectiles.splice(i, 1);
                continue;
            }
            
            // Check lifetime
            proj.lifetime -= dt;
            if (proj.lifetime <= 0) {
                this.projectiles.splice(i, 1);
            }
        }
    }
    
    updateExplosions(dt) {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const explosion = this.explosions[i];
            
            // Update explosion using its own method
            explosion.update(dt);
            
            // Remove explosion if it's complete
            if (explosion.isComplete) {
                this.explosions.splice(i, 1);
            }
        }
    }
    
    updateScans(dt) {
        for (let i = this.scans.length - 1; i >= 0; i--) {
            const scan = this.scans[i];
            
            // Update scan duration
            scan.duration -= dt;
            
            // Find the bot that created this scan and update scan position
            const sourceBot = this.bots.find(bot => bot.id === scan.botId);
            if (sourceBot && sourceBot.isActive) {
                // Update scan position to follow the bot
                scan.x = sourceBot.x;
                scan.y = sourceBot.y;
                
                // Use the independent scan angle instead of turret angle
                scan.angle = sourceBot.scan_angle;
            }
            
            // Remove scan if it's done
            if (scan.duration <= 0) {
                this.scans.splice(i, 1);
            }
        }
    }
    
    fireProjectile(bot) {
        if (bot.isShutdown || bot.fire_cooldown_remaining > 0) {
            return false;
        }
        
        // Calculate projectile spawn position at turret muzzle
        const muzzleLength = bot.ship_radius * 1.5;
        const x = bot.x + Math.cos(this.degreesToRadians(bot.turret_angle)) * muzzleLength;
        const y = bot.y + Math.sin(this.degreesToRadians(bot.turret_angle)) * muzzleLength;
        
        // Determine projectile damage (adjusted for overburn if active)
        let damage = bot.fire_power;
        if (bot.isOverburn) {
            damage *= bot.overburn_fire_power_multiplier;
        }
        
        // Create projectile
        const projectile = new Projectile({
            ownerId: bot.id,
            x: x,
            y: y,
            vx: Math.cos(this.degreesToRadians(bot.turret_angle)) * bot.projectile_speed,
            vy: Math.sin(this.degreesToRadians(bot.turret_angle)) * bot.projectile_speed,
            damage: damage,
            radius: bot.projectile_radius,
            lifetime: bot.projectile_lifetime,
            color: bot.color
        });
        
        // Add projectile to game
        this.projectiles.push(projectile);
        
        // Start cooldown
        bot.fire_cooldown_remaining = bot.fire_cooldown;
        
        // Generate heat
        bot.heat += bot.heat_generation_fire;
        
        return true;
    }
    
    performScan(bot, absoluteAngle, arcDegrees = 60) {
        if (bot.isShutdown || bot.scan_cooldown_remaining > 0) {
            return [];
        }
        
        // Set the bot's scan angle to the specified absolute angle
        bot.target_scan_angle = absoluteAngle;
        bot.scan_angle = absoluteAngle; // Immediately set the scan angle
        
        // Debug output to see scanning parameters
        console.log(`Bot ${bot.name} scanning: angle=${absoluteAngle}°, arc=${arcDegrees}°`);
        
        // Create scan object for visual effect
        const scan = {
            botId: bot.id,
            x: bot.x,
            y: bot.y,
            angle: absoluteAngle, // Use the absolute scan angle directly
            arcWidth: arcDegrees,
            range: bot.scan_range,
            duration: 0.15, // Very brief flash (0.15 seconds) to indicate instantaneous scan
            color: bot.color,
            results: []
        };
        
        // Find bots in scan area
        const results = [];
        for (const targetBot of this.bots) {
            // Skip self and inactive bots
            if (targetBot.id === bot.id || !targetBot.isActive) continue;
            
            // Calculate distance to target
            const dx = targetBot.x - bot.x;
            const dy = targetBot.y - bot.y;
            const distance = Math.hypot(dx, dy);
            
            // Check if target is in range
            if (distance > bot.scan_range) continue;
            
            // Calculate angle to target in degrees
            const angleToTarget = Math.atan2(dy, dx) * 180 / Math.PI;
            
            // Check if target is within scan arc - more robust calculation
            // Normalize both angles to [0, 360) for easier comparison
            let normalizedScanAngle = absoluteAngle % 360;
            if (normalizedScanAngle < 0) normalizedScanAngle += 360;
            
            let normalizedTargetAngle = angleToTarget % 360;
            if (normalizedTargetAngle < 0) normalizedTargetAngle += 360;
            
            // Calculate the smallest angle between them (considering wrap-around)
            let diff1 = Math.abs(normalizedTargetAngle - normalizedScanAngle);
            let diff2 = 360 - diff1;
            const angleDiff = Math.min(diff1, diff2);
            
            // Check if within half the arc width
            const halfArc = arcDegrees / 2;
            if (angleDiff <= halfArc) {
                console.log(`Bot ${bot.name} detected ${targetBot.name} at distance ${distance.toFixed(1)}, angle diff: ${angleDiff.toFixed(1)}°`);
                
                // Add target to scan results
                results.push({
                    id: targetBot.id,
                    x: targetBot.x,
                    y: targetBot.y,
                    angle: targetBot.angle,
                    velocity: {
                        x: targetBot.velocityX,
                        y: targetBot.velocityY,
                        speed: targetBot.current_speed
                    },
                    distance: distance
                });
                
                // Also add to scan visual effect
                scan.results.push(results[results.length - 1]);
            }
        }
        
        // Add scan to game for visual effect
        this.scans.push(scan);
        
        // Start cooldown
        bot.scan_cooldown_remaining = bot.scan_cooldown;
        
        // Return the results immediately
        return results;
    }
    
    createExplosion(x, y, maxRadius, damage, duration = 0.5) {
        // Use the Explosion class constructor
        const explosion = new Explosion({
            x: x,
            y: y,
            maxRadius: maxRadius,
            damage: damage,
            duration: duration
        });
        
        this.explosions.push(explosion);
        
        // Apply damage to bots in explosion radius
        for (const bot of this.bots) {
            if (!bot.isActive) continue;
            
            const dx = bot.x - x;
            const dy = bot.y - y;
            const distance = Math.hypot(dx, dy);
            
            // Check if bot is within max explosion radius
            if (distance <= maxRadius) {
                // Calculate damage based on distance (linear falloff)
                const damageMultiplier = 1 - (distance / maxRadius);
                const actualDamage = damage * damageMultiplier;
                
                this.damageBot(bot, actualDamage);
            }
        }
    }
    
    damageBot(bot, amount) {
        bot.armor -= amount;
        
        // Check if bot is destroyed
        if (bot.armor <= 0) {
            bot.armor = 0;
            bot.isActive = false;
            
            // Create explosion at bot position
            this.createExplosion(bot.x, bot.y, bot.explosion_radius, bot.explosion_damage);
        }
    }
    
    checkWinCondition() {
        // Count active bots
        const activeBots = this.bots.filter(bot => bot.isActive);
        
        // If 0 or 1 bot remains, game is over
        if (activeBots.length <= 1) {
            this.state = GameState.GAME_OVER;
            
            // Determine winner
            const winner = activeBots.length === 1 ? activeBots[0] : null;
            
            // Show game over screen
            this.uiCallbacks.showGameOver(winner);
            
            // Stop game loop
            cancelAnimationFrame(this.animationFrameId);
        }
    }
    
    pause() {
        if (this.state === GameState.RUNNING) {
            this.state = GameState.PAUSED;
            // Make sure to cancel any existing animation frame
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
        }
    }
    
    resume() {
        if (this.state === GameState.PAUSED) {
            this.state = GameState.RUNNING;
            // Reset the last frame time to now to avoid large dt values
            this.lastFrameTime = performance.now();
            // Restart the game loop
            this.animationFrameId = requestAnimationFrame(this.gameLoop);
        }
    }
    
    reset() {
        // Stop current game loop
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Reset state
        this.state = GameState.SETUP;
        this.bots = [];
        this.projectiles = [];
        this.explosions = [];
        this.scans = [];
        this.controlledBotId = null;
    }
    
    // Set game speed multiplier
    setSpeedMultiplier(multiplier) {
        this.speedMultiplier = Math.max(0.25, Math.min(3, parseFloat(multiplier)));
    }
}
