# Algo Bots 2D - AI API Documentation

This document provides comprehensive documentation for the API available to AI scripts in Algo Bots 2D. Use this reference to create your own custom bot behaviors.

## Table of Contents

1. [Introduction](#introduction)
2. [AI Function Structure](#ai-function-structure)
3. [Bot Information](#bot-information)
4. [API Methods](#api-methods)
5. [Memory](#memory)
6. [Examples](#examples)

## Introduction

In Algo Bots 2D, each bot's behavior is controlled by a JavaScript function that you define. This function is executed once per game tick and allows you to make decisions based on the bot's current state and environment.

**Important Note:** All angles in Algo Bots 2D are expressed in degrees, not radians. This makes the API more intuitive and easier to use without mathematical conversion.

## AI Function Structure

Your AI must be defined as a function named `runBotAI` with the following signature:

```javascript
function runBotAI(botInfo, api, memory) {
    // Your AI code here
}
```

Parameters:

- `botInfo`: An object containing read-only information about your bot's current state
- `api`: An object providing methods to control your bot
- `memory`: A persistent object for storing data between function calls

## Bot Information

The `botInfo` parameter contains the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `id` | String | Unique identifier for this bot |
| `name` | String | Display name of the bot |
| `x` | Number | X coordinate position |
| `y` | Number | Y coordinate position |
| `angle` | Number | Current hull rotation angle (in degrees) |
| `turret_angle` | Number | Current absolute turret angle (in degrees) |
| `relativeTurretAngle` | Number | Current relative angle between hull and turret (in degrees) |
| `current_speed` | Number | Current movement speed in pixels per second |
| `armor` | Number | Current armor value |
| `max_armor` | Number | Maximum armor value |
| `heat` | Number | Current heat level |
| `max_heat` | Number | Heat threshold where shutdown occurs |
| `isShutdown` | Boolean | Whether the bot is currently shutdown due to overheating |
| `isOverburn` | Boolean | Whether overburn mode is currently active |
| `fire_cooldown_remaining` | Number | Seconds remaining before the bot can fire again |
| `scan_cooldown_remaining` | Number | Seconds remaining before the bot can scan again |

## API Methods

The `api` parameter provides the following methods:

### Movement

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `thrust(amount)` | amount: Number (0-1) | Boolean | Accelerates the bot. Amount is a value from 0-1 representing percentage of max speed. |
| `brake()` | None | Boolean | Sets target speed to zero, causing the bot to slow down and stop. |
| `turn(targetAngleDegrees)` | targetAngleDegrees: Number | Boolean | Rotates the hull toward the specified absolute angle in degrees. |

### Combat

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `turnTurret(targetAngleDegrees)` | targetAngleDegrees: Number | Boolean | Rotates the turret toward the specified angle in degrees (relative to the hull). |
| `fire()` | None | Boolean | Fires the bot's weapon. Returns false if on cooldown or overheated. |
| `overburn(enable)` | enable: Boolean | Boolean | Toggles overburn mode which increases speed and weapon power at the cost of generating more heat. |

### Sensors

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `scan(relativeAngleDegrees, arcDegrees)` | relativeAngleDegrees: Number, arcDegrees: Number | Array | Scans for enemies in the specified cone. Returns an array of enemy objects if enemies are detected, or an empty array if none found or on cooldown. Angle is relative to turret direction. |

### Utility

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `getAngleTo(x, y)` | x: Number, y: Number | Number | Returns the angle in degrees from the bot to the specified coordinates. |
| `getDistanceTo(x, y)` | x: Number, y: Number | Number | Returns the distance in pixels from the bot to the specified coordinates. |
| `normalizeAngle(angleDegrees)` | angleDegrees: Number | Number | Normalizes an angle to be within -180 to 180 degrees. |
| `getArenaSize()` | None | Object | Returns an object with `width` and `height` properties representing the arena dimensions. |

## Memory

The `memory` object persists between function calls and can be used to store state information. It is initially an empty object, and you can add any properties you need.

Example:
```javascript
// Initialize memory
if (!memory.state) {
    memory.state = "patrol";
    memory.target = null;
}
```

## Examples

### Basic Patrol Bot
```javascript
function runBotAI(botInfo, api, memory) {
    // Initialize patrol points if not already set
    if (!memory.patrolIndex) {
        memory.patrolIndex = 0;
        memory.patrolPoints = [
            { x: 100, y: 100 },
            { x: 700, y: 100 },
            { x: 700, y: 500 },
            { x: 100, y: 500 }
        ];
    }
    
    // Get current patrol point
    const target = memory.patrolPoints[memory.patrolIndex];
    
    // Calculate distance and angle to target
    const distance = api.getDistanceTo(target.x, target.y);
    const angle = api.getAngleTo(target.x, target.y);
    
    // Turn toward target
    api.turn(angle);
    
    // Scan while moving
    api.turnTurret((botInfo.relativeTurretAngle + 5) % 360);
    
    // Move to target
    if (distance > 20) {
        api.thrust(0.5);
    } else {
        // Move to next patrol point
        memory.patrolIndex = (memory.patrolIndex + 1) % memory.patrolPoints.length;
    }
    
    // Basic scanning and shooting - using direct scan method
    const enemies = api.scan(0, 30);
    if (enemies.length > 0) {
        api.fire();
    }
}
```

### Aggressive Hunter Bot
```javascript
function runBotAI(botInfo, api, memory) {
    // Initialize memory
    if (!memory.state) {
        memory.state = "scan";
        memory.scanAngle = 0;
        memory.target = null;
    }
    
    // State machine
    switch (memory.state) {
        case "scan":
            // Rotate turret to scan
            api.turnTurret(memory.scanAngle);
            memory.scanAngle = (memory.scanAngle + 15) % 360;
            
            // Perform scan - using the simplified API
            const results = api.scan(0, 45);
            if (results.length > 0) {
                // Found an enemy, track it
                memory.target = results[0];
                memory.state = "pursue";
            }
            break;
            
        case "pursue":
            // If we've been pursuing too long without a scan, go back to scanning
            if (!memory.target || Math.random() < 0.01) {
                memory.state = "scan";
                break;
            }
            
            // Calculate angle to last known position
            const angleToTarget = api.getAngleTo(memory.target.x, memory.target.y);
            
            // Aim turret
            api.turnTurret(angleToTarget);
            
            // Turn hull toward target
            api.turn(angleToTarget);
            
            // Move toward target
            api.thrust(0.8);
            
            // Fire if we're pointing at the target
            const turretDiff = Math.abs(api.normalizeAngle(botInfo.turret_angle - angleToTarget));
            if (turretDiff < 10) {
                api.fire();
                
                // Use overburn occasionally
                if (botInfo.heat < botInfo.max_heat * 0.7) {
                    api.overburn(true);
                } else {
                    api.overburn(false);
                }
            }
            
            // Perform another scan to update target position
            const newResults = api.scan(0, 30);
            if (newResults.length > 0) {
                memory.target = newResults[0];
            }
            break;
    }
}
```

## Tips for Bot Development

1. **Heat Management**: Monitor your bot's heat level and disable overburn before reaching shutdown.

2. **Target Leading**: For moving targets, aim slightly ahead of their position based on their velocity and distance.

3. **State Machines**: Use memory to implement state machines for more complex behaviors.

4. **Defensive Tactics**: Consider backing away from enemies when they get too close.

5. **Arena Awareness**: Use the `getArenaSize()` method to avoid getting trapped in corners.

---

This documentation covers the core API available to your AI scripts. Experiment with different strategies and bot behaviors to create the ultimate fighting machine!