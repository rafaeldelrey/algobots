// renderer.js - Handles game rendering on canvas
export class Renderer {
    constructor(game) {
        this.game = game;
        this.ctx = null;
    }
    
    setContext(ctx) {
        this.ctx = ctx;
    }
    
    render() {
        if (!this.ctx) return;
        
        const ctx = this.ctx;
        const canvas = ctx.canvas;
        
        // Clear canvas using canvas dimensions, not arena dimensions
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Save the context state before scaling
        ctx.save();
        
        // Calculate scaling factors
        const scaleX = canvas.width / this.game.config.ARENA_WIDTH;
        const scaleY = canvas.height / this.game.config.ARENA_HEIGHT;
        
        // Apply scaling to fit arena in canvas
        ctx.scale(scaleX, scaleY);
        
        // Draw grid lines (optional)
        this.drawGrid();
        
        // Draw explosions (behind bots)
        this.drawExplosions();
        
        // Draw scan effects (behind bots)
        this.drawScans();
        
        // Draw projectiles
        this.drawProjectiles();
        
        // Draw bots
        this.drawBots();
        
        // Restore the context to remove scaling
        ctx.restore();
    }
    
    drawGrid() {
        const ctx = this.ctx;
        const width = this.game.config.ARENA_WIDTH;
        const height = this.game.config.ARENA_HEIGHT;
        const gridSize = 50;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        // Draw vertical lines
        for (let x = 0; x <= width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = 0; y <= height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }
    
    drawBots() {
        const ctx = this.ctx;
        
        for (const bot of this.game.bots) {
            if (!bot.isActive) continue;
            
            // Save context state
            ctx.save();
            
            // Translate to bot position
            ctx.translate(bot.x, bot.y);
            
            // Draw bot body (triangle)
            ctx.rotate(bot.angle);
            ctx.beginPath();
            
            // Draw triangle pointing in the direction of movement
            const radius = bot.ship_radius;
            ctx.moveTo(radius * 1.5, 0);
            ctx.lineTo(-radius, -radius);
            ctx.lineTo(-radius, radius);
            ctx.closePath();
            
            // Fill with bot color
            ctx.fillStyle = bot.isShutdown ? 'darkgray' : bot.color;
            ctx.fill();
            
            // Add outline
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Reset rotation for turret (to draw it based on world coordinates)
            ctx.rotate(-bot.angle);
            
            // Draw triangular turret
            ctx.rotate(bot.turret_angle);
            ctx.beginPath();
            
            // Draw triangular turret with narrower tip
            const turretLength = radius * 1.5;
            const turretBaseWidth = 6;
            const turretTipWidth = 2;
            
            ctx.moveTo(turretLength, 0); // Tip of turret
            ctx.lineTo(0, -turretBaseWidth/2); // Base left corner
            ctx.lineTo(0, turretBaseWidth/2); // Base right corner
            ctx.closePath();
            
            ctx.fillStyle = bot.color;
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.stroke();
            
            // Restore context state
            ctx.restore();
            
            // Draw bot name (optionally)
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(bot.name, bot.x, bot.y + bot.ship_radius + 20);
            
            // Optionally draw health/heat bars above bot
            this.drawBotStatusBars(bot);
        }
    }
    
    drawBotStatusBars(bot) {
        const ctx = this.ctx;
        const barWidth = bot.ship_radius * 2;
        const barHeight = 4;
        const xPos = bot.x - barWidth / 2;
        
        // Health bar (green)
        const yPosHealth = bot.y - bot.ship_radius - 15;
        const healthWidth = (bot.armor / bot.max_armor) * barWidth;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(xPos, yPosHealth, barWidth, barHeight);
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(xPos, yPosHealth, healthWidth, barHeight);
        
        // Heat bar (orange/red)
        const yPosHeat = bot.y - bot.ship_radius - 10;
        const heatWidth = (bot.heat / bot.max_heat) * barWidth;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(xPos, yPosHeat, barWidth, barHeight);
        
        // Change color based on heat level
        if (bot.heat > bot.max_heat * 0.75) {
            ctx.fillStyle = '#F44336'; // Red
        } else {
            ctx.fillStyle = '#FF9800'; // Orange
        }
        
        ctx.fillRect(xPos, yPosHeat, heatWidth, barHeight);
        
        // Draw indicators
        if (bot.isShutdown) {
            this.drawIndicator(bot, 'SHUTDOWN', '#F44336');
        } else if (bot.isOverburn) {
            this.drawIndicator(bot, 'OVERBURN', '#FF9800');
        }
    }
    
    drawIndicator(bot, text, color) {
        const ctx = this.ctx;
        const yPos = bot.y - bot.ship_radius - 25;
        
        ctx.fillStyle = color;
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(text, bot.x, yPos);
    }
    
    drawProjectiles() {
        const ctx = this.ctx;
        
        for (const projectile of this.game.projectiles) {
            ctx.beginPath();
            ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
            ctx.fillStyle = projectile.color;
            ctx.fill();
            
            // Optional: Add a glowing effect
            ctx.shadowBlur = 10;
            ctx.shadowColor = projectile.color;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }
    
    drawExplosions() {
        const ctx = this.ctx;
        
        for (const explosion of this.game.explosions) {
            // Draw expanding circle
            ctx.beginPath();
            ctx.arc(explosion.x, explosion.y, explosion.currentRadius, 0, Math.PI * 2);
            
            // Create gradient for explosion effect
            const gradient = ctx.createRadialGradient(
                explosion.x, explosion.y, 0,
                explosion.x, explosion.y, explosion.currentRadius
            );
            
            gradient.addColorStop(0, `rgba(255, 200, 50, ${explosion.opacity})`);
            gradient.addColorStop(0.5, `rgba(255, 100, 50, ${explosion.opacity * 0.8})`);
            gradient.addColorStop(1, `rgba(255, 50, 50, 0)`);
            
            ctx.fillStyle = gradient;
            ctx.fill();
        }
    }
    
    drawScans() {
        const ctx = this.ctx;
        
        for (const scan of this.game.scans) {
            // Draw scan arc
            ctx.beginPath();
            ctx.moveTo(scan.x, scan.y);
            ctx.arc(
                scan.x, scan.y, 
                scan.range, 
                scan.angle - scan.arcWidth / 2, 
                scan.angle + scan.arcWidth / 2
            );
            ctx.lineTo(scan.x, scan.y);
            
            // Create semi-transparent fill
            ctx.fillStyle = `${scan.color}40`; // 25% opacity
            ctx.fill();
            
            // Add border
            ctx.strokeStyle = scan.color;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
}