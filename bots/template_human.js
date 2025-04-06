// Simple Human Bot using scanning and basic targeting
function runBotAI(botInfo, api, memory) {
  // Constants for bot behavior
  const facingTolerance = 5; // Degrees (was previously in radians)
  const shootingDistance = 250; // Distance within which to start shooting
  const tooCloseDistance = 80; // Distance below which to stop thrusting
  
  // Perform a scan in front of the bot - directly get results
  const enemies = api.scan(0, 45);
  
  // Check if scan found enemies
  if (enemies && enemies.length > 0) {
    // Found enemy - get the closest one
    const enemy = enemies.reduce((closest, current) => {
      return (!closest || current.distance < closest.distance) ? current : closest;
    }, null);
    
    // Calculate angle to enemy
    const angleToTarget = api.getAngleTo(enemy.x, enemy.y);
    
    // Point turret at enemy
    api.turnTurret(angleToTarget);
    
    // Get angle difference
    const turretAngleDiff = Math.abs(api.normalizeAngle(botInfo.turret_angle - angleToTarget));
    
    // If we're facing the enemy...
    if (turretAngleDiff < facingTolerance) {
      // Close enough to shoot
      if (enemy.distance < shootingDistance) {
        api.fire();
      }
      
      // Turn ship toward enemy
      api.turn(angleToTarget);
      
      // Move toward enemy if not too close
      if (enemy.distance > tooCloseDistance) {
        api.thrust(0.7);
      } else {
        api.brake();
      }
    }
  } else {
    // No enemy detected - simple patrol behavior
    if (!memory.patrolAngle) {
      memory.patrolAngle = 0;
    }
    
    // Gradually rotate
    api.turnTurret(memory.patrolAngle);
    memory.patrolAngle = (memory.patrolAngle + 10) % 360;
    
    // Occasional movement
    if (Math.random() < 0.05) {
      api.thrust(0.5);
    }
  }
}