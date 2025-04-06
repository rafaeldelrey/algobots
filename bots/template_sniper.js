// Ultra-Simplified Sniper Bot - Uses direct scanning and firing logic without relying on memory
function runBotAI(botInfo, api, memory) {
    // Constants for bot behavior
    const MAX_FIRING_DISTANCE = 500; // Maximum distance for firing
    const TURRET_AIM_TOLERANCE = 5; // Degrees of tolerance for firing
    const POSITION_TOLERANCE = 15; // How close we need to be to our position
    const WALL_DISTANCE = 10; // Distance from the north wall
    const HEAT_THRESHOLD = botInfo.max_heat * 0.7; // Heat threshold before we stop overburn
    
    // Get arena dimensions
    const arena = api.getArenaSize();
    
    // Calculate our optimal sniper position (middle of north wall)
    const sniperPosition = {
        x: arena.width / 2,
        y: WALL_DISTANCE
    };
    
    // Step 1: First priority - ensure we're in the right position
    const distanceFromPost = api.getDistanceTo(sniperPosition.x, sniperPosition.y);
    if (distanceFromPost > POSITION_TOLERANCE) {
        // We're out of position - move back
        const angleToPosition = api.getAngleTo(sniperPosition.x, sniperPosition.y);
        api.turn(angleToPosition);
        api.thrust(0.8);
        return; // Focus on movement first
    }
    
    // Step 2: If we are within the post position tolerance, stop moving
    if (distanceFromPost <= POSITION_TOLERANCE) {
        api.turn(90);
        api.brake(); // Ensure we're fully stopped
    //     // If we are not already facing south, turn to face south
    //     if (Math.abs(api.normalizeAngle(botInfo.angle - 180)) != 90) {
    //         api.turn(90); // Turn to face south
    //         return; // Wait until we're facing south
    //     }
    //     // If we are moving, brake to stop
    //     if (botInfo.speed > 0) {
    //         api.brake();
    //         return; // Wait until we're fully stopped
    //     }
    }

    // Step 3: Perform a wide scan to the south (180 degree arc)
    const scanResults = api.scan(90, 180); // Centered on 90° with 180° arc (covers entire south half)
    
    // Step 4: If we found enemies, target the closest one
    if (scanResults.length > 0) {
        // Find the closest target
        const target = scanResults.reduce((closest, current) => {
            return (!closest || current.distance < closest.distance) ? current : closest;
        });
        
        // Calculate angle to target
        const angleToTarget = api.getAngleTo(target.x, target.y);
        
        // Aim turret at target
        const relativeAngle = api.normalizeAngle(angleToTarget - botInfo.angle);
        
        // Take into consideration the target speed and direction
        const targetSpeed = target.speed || 0;
        const leadAngle = api.normalizeAngle(relativeAngle + (targetSpeed > 0 ? 5 : 0)); // Small lead for moving targets
        api.turnTurret(leadAngle);
        
        // Check if we're aimed accurately enough
        const turretAngleDiff = Math.abs(api.normalizeAngle(botInfo.turret_angle - angleToTarget));
        
        // Step 5: Fire if conditions are met (aimed well and not overheated)
        if (turretAngleDiff < TURRET_AIM_TOLERANCE && target.distance <= MAX_FIRING_DISTANCE) {
            // If we're not overheated, fire
            if (botInfo.heat < HEAT_THRESHOLD)
                // Fire!
                api.fire();
        }
    } else {
        // No targets found, disable overburn
        api.overburn(false);
    }
}