// explosion.js - Defines the Explosion class for visual effects
    export class Explosion {
        constructor(config) {
            this.x = config.x;
            this.y = config.y;
            this.maxRadius = config.maxRadius;
            this.damage = config.damage || 0; // Explosions can optionally do damage
            this.duration = config.duration || 0.5; // Default duration 0.5 seconds

            this.currentRadius = 0;
            this.opacity = 1;
            this.expansionRate = this.maxRadius / this.duration; // Calculate rate based on duration
            this.lifeTimer = this.duration;
            this.isComplete = false;
        }

        update(dt) {
            if (this.isComplete) return;

            this.lifeTimer -= dt;
            this.currentRadius += this.expansionRate * dt;
            this.opacity = Math.max(0, this.lifeTimer / this.duration); // Fade out based on remaining life

            if (this.lifeTimer <= 0 || this.currentRadius >= this.maxRadius) {
                this.isComplete = true;
                this.currentRadius = this.maxRadius; // Clamp radius
                this.opacity = 0; // Ensure fully transparent
            }
        }
    }
