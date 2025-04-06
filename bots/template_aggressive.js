// This bot will chase the nearest enemy and fire
function runBotAI(botInfo, api, memory) {
    // Initialize memory
    if (!memory.state) {
        memory.state = "scan";
        memory.target = null;
        memory.scanAngle = 0;
    }
    
    // Get arena boundaries
    const arena = api.getArenaSize();
    
    // State machine
    switch (memory.state) {
        case "scan":
            // Rotate turret for visual feedback (not related to scanning)
            api.turnTurret(memory.scanAngle);
            
            // Update scan angle independently (separate from turret)
            memory.scanAngle = (memory.scanAngle + 30) % 360;
            
            // Perform scan with absolute angle - directly get results
            const results = api.scan(memory.scanAngle, 60);
            
            if (results && results.length > 0) {
                // Target the closest enemy
                memory.target = results.reduce((closest, current) => {
                    return (!closest || current.distance < closest.distance) ? current : closest;
                }, null);
                
                memory.state = "chase";
            }
            break;
            
        case "chase":
            // If no target or target is old, go back to scanning
            if (!memory.target || Math.random() < 0.01) {
                memory.state = "scan";
                break;
            }
            
            // Calculate angle to target
            const angleToTarget = api.getAngleTo(memory.target.x, memory.target.y);
            
            // Point turret at the target (need to calculate relative angle)
            const relativeAngle = api.normalizeAngle(angleToTarget - botInfo.angle);
            api.turnTurret(relativeAngle);
            
            // Move toward the target
            api.turn(angleToTarget);
            
            // Get close but not too close
            const distToTarget = api.getDistanceTo(memory.target.x, memory.target.y);
            if (distToTarget > 200) {
                api.thrust(1.0);
            } else if (distToTarget > 100) {
                api.thrust(0.5);
            } else {
                api.brake();
            }
            
            // Fire if turret is pointing approximately at target
            const turretAngleDiff = Math.abs(api.normalizeAngle(botInfo.turret_angle - angleToTarget));
            if (turretAngleDiff < 10) {
                api.fire();
                
                // Use overburn occasionally
                if (botInfo.heat < botInfo.max_heat * 0.7 && Math.random() < 0.1) {
                    api.overburn(true);
                } else {
                    api.overburn(false);
                }
            }
            
            // Scan occasionally to find new targets
            // Now performs scan at the angle toward the target for precision
            if (Math.random() < 0.1) {
                const newResults = api.scan(angleToTarget, 30);
                if (newResults.length > 0) {
                    memory.target = newResults[0];
                } else {
                    memory.state = "scan"; // Lost the target, go back to scanning
                }
            }
            break;
    }
}