// Sniper Bot - Sits at the middle of the north wall and fires at targets
function runBotAI(botInfo, api, memory) {
    // Initialize memory
    if (!memory.initialized) {
        memory.initialized = true;
        memory.state = "move_to_position";
        memory.scanAngle = 0;
        memory.targetCooldown = 0;
        memory.target = null;
    }
    
    // Get arena dimensions
    const arena = api.getArenaSize();
    
    // Calculate middle of north wall position
    const northWallPosition = {
        x: arena.width / 2,
        y: 40 // Stay slightly away from the wall
    };
    
    // Decrease target cooldown if we have one
    if (memory.targetCooldown > 0) {
        memory.targetCooldown -= 0.1;
    }
    
    // State machine for the sniper bot
    switch (memory.state) {
        case "move_to_position":
            // Get distance and angle to our sniper position
            const distToPosition = api.getDistanceTo(northWallPosition.x, northWallPosition.y);
            const angleToPosition = api.getAngleTo(northWallPosition.x, northWallPosition.y);
            
            // Face towards the position
            api.turn(angleToPosition);
            
            // Move to the position if not close enough
            if (distToPosition > 10) {
                api.thrust(0.6);
            } else {
                api.brake();
                // Once in position, switch to south-facing orientation
                api.turn(90); // Face south (looking down into the arena)
                memory.state = "scanning";
            }
            break;
            
        case "scanning":
            // Ensure we stay at the north wall position
            const currentDistToPosition = api.getDistanceTo(northWallPosition.x, northWallPosition.y);
            if (currentDistToPosition > 15) {
                // We've been pushed away, go back
                memory.state = "move_to_position";
                break;
            }
            
            // Scan by sweeping the turret
            api.turnTurret(memory.scanAngle);
            memory.scanAngle = (memory.scanAngle + 4) % 360;
            
            // Perform scan with a wide arc
            const scanResults = api.scan(0, 90);
            
            // If we find enemies, select the closest one as target
            if (scanResults.length > 0) {
                memory.target = scanResults.reduce((closest, current) => {
                    return (!closest || current.distance < closest.distance) ? current : closest;
                }, null);
                
                memory.state = "targeting";
            }
            break;
            
        case "targeting":
            // Ensure we stay at our position
            const distanceFromPost = api.getDistanceTo(northWallPosition.x, northWallPosition.y);
            if (distanceFromPost > 15) {
                memory.state = "move_to_position";
                break;
            }
            
            // If we've lost the target or it's time to scan again
            if (!memory.target || memory.targetCooldown <= 0) {
                memory.state = "scanning";
                memory.targetCooldown = 0;
                break;
            }
            
            // Aim at target
            const angleToTarget = api.getAngleTo(memory.target.x, memory.target.y);
            api.turnTurret(angleToTarget);
            
            // Calculate angle difference
            const turretAngleDiff = Math.abs(api.normalizeAngle(botInfo.turret_angle - angleToTarget));
            
            // Fire if the turret is pointing at the target with good accuracy
            if (turretAngleDiff < 5) {
                // Use overburn for more damage if heat is manageable
                if (botInfo.heat < botInfo.max_heat * 0.7) {
                    api.overburn(true);
                } else {
                    api.overburn(false);
                }
                
                api.fire();
            }
            
            // Periodically scan for new targets
            memory.targetCooldown = 2;
            
            // Scan for updated target position
            const newScanResults = api.scan(angleToTarget, 20);
            if (newScanResults.length > 0) {
                memory.target = newScanResults[0];
            } else {
                // If lost target during precise scan, go back to wide scanning
                memory.state = "scanning";
            }
            break;
    }
    
    // Heat management - disable overburn if we're getting too hot
    if (botInfo.heat > botInfo.max_heat * 0.8) {
        api.overburn(false);
    }
}