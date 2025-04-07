// bot.js - Defines the Bot class with properties and behavior
export class Bot {
    constructor(config) {
        // Core properties
        this.id = config.id || crypto.randomUUID();
        this.name = config.name || 'Bot ' + this.id.substring(0, 4);
        this.color = config.color || '#' + Math.floor(Math.random()*16777215).toString(16);
        
        // Position and orientation (all angles in degrees now)
        this.x = config.x || 0;
        this.y = config.y || 0;
        this.angle = config.angle || 0;
        this.turret_angle = config.angle || 0; // Initialize turret aligned with body
        this.relativeTurretAngle = 0; // Turret starts facing forward relative to the body
        this.scan_angle = config.angle || 0; // New: Separate scan angle, starts aligned with body

        // Movement
        this.velocityX = 0;
        this.velocityY = 0;
        this.current_speed = 0;
        this.target_speed = 0;
        this.target_angle = this.angle;
        this.target_turret_angle = 0; // Target angle is now relative
        this.target_scan_angle = 0; // New: Target scan angle (absolute, in degrees)

        // Ship stats - Configurable with defaults
        this.max_speed = config.max_speed || 100; // pixels per second
        this.acceleration = config.acceleration || 50; // pixels per second squared
        this.braking_power = config.braking_power || 100; // pixels per second squared
        // Increased rotation speeds (converted from radians to degrees)
        this.max_ship_rotation_speed = config.max_ship_rotation_speed || 180; // degrees per second (was ~90)
        this.max_turret_rotation_speed = config.max_turret_rotation_speed || 240; // degrees per second
        
        // Combat stats
        this.ship_radius = config.ship_radius || 10; // Made bots smaller
        this.armor = config.armor !== undefined ? config.armor : 100;
        this.max_armor = config.max_armor || 100;
        this.fire_power = config.fire_power || 10;
        this.fire_cooldown = config.fire_cooldown || 0.25; // seconds
        this.fire_cooldown_remaining = 0;
        
        // Heat mechanics
        this.heat = config.heat || 0;
        this.max_heat = config.max_heat || 100;
        this.heat_generation_fire = config.heat_generation_fire || 10;
        this.heat_generation_overburn = config.heat_generation_overburn || 20; // per second
        this.heat_dissipation_rate = config.heat_dissipation_rate || 5; // per second
        this.isShutdown = false;
        
        // Overburn
        this.isOverburn = false;
        this.overburn_speed_multiplier = config.overburn_speed_multiplier || 1.5;
        this.overburn_fire_power_multiplier = config.overburn_fire_power_multiplier || 1.2;
        
        // Scanning
        this.scan_range = config.scan_range || 300;
        this.scan_arc_degrees = config.scan_arc_degrees || 60; // Arc width in degrees
        this.scan_cooldown = config.scan_cooldown || 0.25; // seconds
        this.scan_cooldown_remaining = 0;
        this.lastScanId = null;
        this.lastScanResults = null;
        
        // Projectile properties
        this.projectile_speed = config.projectile_speed || 300; // pixels per second
        this.projectile_lifetime = config.projectile_lifetime || 2; // seconds
        this.projectile_radius = config.projectile_radius || 3;
        
        // Explosion properties
        this.explosion_radius = config.explosion_radius || 50;
        this.explosion_damage = config.explosion_damage || 50;
        
        // AI related properties
        this.aiScript = config.aiScript || '';
        this.memory = {};
        this.aiError = null;
        
        // State flags
        this.isActive = true;
    }
    
    // Get a sanitized copy of bot state for AI scripts
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            x: this.x,
            y: this.y,
            angle: this.angle,
            turret_angle: this.turret_angle, // Absolute angle for info
            relativeTurretAngle: this.relativeTurretAngle, // Current relative angle
            scan_angle: this.scan_angle, // Expose scan angle to AI
            current_speed: this.current_speed,
            armor: this.armor,
            max_armor: this.max_armor,
            heat: this.heat,
            max_heat: this.max_heat,
            isShutdown: this.isShutdown,
            isOverburn: this.isOverburn,
            fire_cooldown_remaining: this.fire_cooldown_remaining,
            scan_cooldown_remaining: this.scan_cooldown_remaining
        };
    }

    // Helper method to get effective maximum speed (considering overburn)
    getMaxSpeed() {
        return this.isOverburn && !this.isShutdown ? 
            this.max_speed * this.overburn_speed_multiplier : 
            this.max_speed;
    }
}
