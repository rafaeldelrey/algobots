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
            // Scan for enemies
            api.turnTurret(memory.scanAngle);
            memory.scanAngle = (memory.scanAngle + 30) % 360;
            
            // Perform scan - directly get results
            const results = api.scan(0, 60);
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
            
            // Point turret at the target
            const angleToTarget = api.getAngleTo(memory.target.x, memory.target.y);
            api.turnTurret(angleToTarget);
            
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
            if (Math.random() < 0.1) {
                memory.state = "scan";
            }
            break;
    }
}