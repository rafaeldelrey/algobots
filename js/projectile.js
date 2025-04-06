// projectile.js - Defines the Projectile class
export class Projectile {
    constructor(config) {
        this.ownerId = config.ownerId;
        this.x = config.x;
        this.y = config.y;
        this.vx = config.vx;
        this.vy = config.vy;
        this.damage = config.damage;
        this.radius = config.radius || 3;
        this.lifetime = config.lifetime || 2;
        this.color = config.color || '#ffffff';
    }
}