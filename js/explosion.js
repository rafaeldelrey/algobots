/**
 * Explosion class for visual and damage effects
 * This handles the expanding animation and lifetime of explosions.
 */
export class Explosion {
    constructor({ x, y, maxRadius, damage, duration = 0.5, color = '#FF5500' }) {
        this.x = x;
        this.y = y;
        this.maxRadius = maxRadius;
        this.damage = damage;
        this.duration = duration;
        this.color = color;
        
        // Animation properties
        this.currentRadius = 0;
        this.opacity = 1.0;
        this.timeElapsed = 0;
        this.isComplete = false;
    }
    
    /**
     * Update explosion state based on time passed
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        this.timeElapsed += dt;
        
        // Calculate completion percentage (0 to 1)
        const progress = Math.min(1, this.timeElapsed / this.duration);
        
        // Update radius - grows quickly at first, then slows
        this.currentRadius = this.maxRadius * Math.sqrt(progress);
        
        // Update opacity - stays bright then fades
        if (progress < 0.7) {
            this.opacity = 1.0;
        } else {
            this.opacity = 1.0 - ((progress - 0.7) / 0.3);
        }
        
        // Mark as complete when duration is reached
        if (progress >= 1) {
            this.isComplete = true;
        }
    }
    
    /**
     * Draw the explosion
     * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
     */
    render(ctx) {
        if (this.isComplete) return;
        
        // Create gradient for explosion
        const gradient = ctx.createRadialGradient(
            this.x, this.y, this.currentRadius * 0.1,
            this.x, this.y, this.currentRadius
        );
        
        // Inner color (bright core)
        gradient.addColorStop(0, `rgba(255, 255, 255, ${this.opacity})`);
        
        // Middle color (orange/red)
        gradient.addColorStop(0.3, `rgba(255, 165, 0, ${this.opacity})`);
        
        // Outer color (red/smoke)
        gradient.addColorStop(1, `rgba(200, 40, 0, 0)`);
        
        // Draw explosion
        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(this.x, this.y, this.currentRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Optional: add particle effects for more visual impact
        this.renderParticles(ctx);
    }
    
    /**
     * Optional: render particle effects around explosion
     * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
     */
    renderParticles(ctx) {
        // Skip particles for very small or nearly complete explosions
        if (this.currentRadius < 5 || this.opacity < 0.3) return;
        
        // Number of particles based on explosion size
        const particleCount = Math.floor(this.currentRadius / 3);
        
        // Draw particles
        ctx.fillStyle = `rgba(255, 100, 50, ${this.opacity * 0.7})`;
        
        for (let i = 0; i < particleCount; i++) {
            // Calculate particle position (random within explosion radius)
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * this.currentRadius * 0.9;
            const size = 2 + Math.random() * 3;
            
            const px = this.x + Math.cos(angle) * distance;
            const py = this.y + Math.sin(angle) * distance;
            
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}