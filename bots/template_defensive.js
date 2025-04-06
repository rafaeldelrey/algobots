// This bot will patrol the edges and fire when it sees enemies
function runBotAI(botInfo, api, memory) {
    // Initialize memory
    if (!memory.state) {
        memory.state = "patrol";
        memory.patrolPoint = 0;
        memory.scanAngle = 0;
    }
    
    // Get arena size
    const arena = api.getArenaSize();
    
    // Define patrol points (near the edges)
    const patrolPoints = [
        { x: 100, y: 100 },
        { x: arena.width - 100, y: 100 },
        { x: arena.width - 100, y: arena.height - 100 },
        { x: 100, y: arena.height - 100 }
    ];
    
    // Always scan by rotating the turret
    api.turnTurret(memory.scanAngle);
    memory.scanAngle = (memory.scanAngle + 10) % 360;
    
    // Perform scan - directly get results
    const enemies = api.scan(0, 60);
    if (enemies && enemies.length > 0) {
        // Target found, aim and fire
        const target = enemies[0];
        const angleToTarget = api.getAngleTo(target.x, target.y);
        api.turnTurret(angleToTarget);
        
        // Only fire if turret is pointing at target
        const turretAngleDiff = Math.abs(api.normalizeAngle(botInfo.turret_angle - angleToTarget));
        if (turretAngleDiff < 15) {
            api.fire();
        }
        
        // Back away if target is too close
        const distToTarget = api.getDistanceTo(target.x, target.y);
        if (distToTarget < 150) {
            const escapeAngle = api.normalizeAngle(angleToTarget + 180);
            api.turn(escapeAngle);
            api.thrust(1.0);
            return;
        }
    }
    
    // Continue patrolling
    const currentPatrol = patrolPoints[memory.patrolPoint];
    const distToPatrol = api.getDistanceTo(currentPatrol.x, currentPatrol.y);
    const angleToPatrol = api.getAngleTo(currentPatrol.x, currentPatrol.y);
    
    // Move to patrol point
    api.turn(angleToPatrol);
    
    if (distToPatrol > 50) {
        api.thrust(0.5);
    } else {
        // Move to next patrol point
        memory.patrolPoint = (memory.patrolPoint + 1) % patrolPoints.length;
    }
    
    // Disable overburn to avoid overheating
    api.overburn(false);
}