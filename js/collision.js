// collision.js - Handles collision detection and response
export class Collision {
    constructor(game) {
        this.game = game;
    }

    detectCollisions() {
        this.detectBotBotCollisions();
        this.detectBotProjectileCollisions();
    }

    detectBotBotCollisions() {
        const bots = this.game.bots;
        
        // Check all pairs of bots
        for (let i = 0; i < bots.length; i++) {
            const bot1 = bots[i];
            if (!bot1.isActive) continue;
            
            for (let j = i + 1; j < bots.length; j++) {
                const bot2 = bots[j];
                if (!bot2.isActive) continue;
                
                // Calculate distance between bots
                const dx = bot2.x - bot1.x;
                const dy = bot2.y - bot1.y;
                const distance = Math.hypot(dx, dy);
                
                // Check if collision occurred
                const minDistance = bot1.ship_radius + bot2.ship_radius;
                if (distance < minDistance) {
                    // Calculate collision response
                    const overlap = minDistance - distance;
                    
                    // Normalize direction vector
                    const nx = dx / distance;
                    const ny = dy / distance;
                    
                    // Move both bots away from each other along collision axis
                    const moveAmount = overlap * 0.5;
                    bot1.x -= nx * moveAmount;
                    bot1.y -= ny * moveAmount;
                    bot2.x += nx * moveAmount;
                    bot2.y += ny * moveAmount;
                    
                    // Optional: Apply damage based on relative velocity
                    const relativeVelocityX = bot2.velocityX - bot1.velocityX;
                    const relativeVelocityY = bot2.velocityY - bot1.velocityY;
                    const impactSpeed = Math.hypot(relativeVelocityX, relativeVelocityY);
                    
                    if (impactSpeed > 50) { // Only apply damage for significant collisions
                        const damage = impactSpeed * 0.1; // Scale damage based on impact speed
                        this.game.damageBot(bot1, damage);
                        this.game.damageBot(bot2, damage);
                    }
                }
            }
        }
    }

    detectBotProjectileCollisions() {
        const bots = this.game.bots;
        const projectiles = this.game.projectiles;
        
        // Check each projectile against each bot
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const projectile = projectiles[i];
            
            for (let j = 0; j < bots.length; j++) {
                const bot = bots[j];
                
                // Skip if bot is inactive or if projectile belongs to this bot
                if (!bot.isActive || projectile.ownerId === bot.id) continue;
                
                // Calculate distance
                const dx = bot.x - projectile.x;
                const dy = bot.y - projectile.y;
                const distance = Math.hypot(dx, dy);
                
                // Check for collision
                if (distance < bot.ship_radius + projectile.radius) {
                    // Apply damage to bot
                    this.game.damageBot(bot, projectile.damage);
                    
                    // Remove projectile
                    projectiles.splice(i, 1);
                    break;
                }
            }
        }
    }
}