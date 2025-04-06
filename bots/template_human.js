// Simple Human Bot using scanning and basic targeting
function runBotAI(botInfo, api, memory) {
  // Constants for bot behavior
  const facingTolerance = 5; // Degrees (was previously in radians)
  const shootingDistance = 250; // Distance within which to start shooting
  const tooCloseDistance = 80; // Distance below which to stop thrusting
  
  // Initialize scan angle if not already set
  if (!memory.scanAngle) {
    memory.scanAngle = botInfo.angle; // Start scanning in front of the bot
  }
  
  // Increment scan angle for the next scan (independent of turret)
  memory.scanAngle = (memory.scanAngle + 10) % 360;
  
  // Perform a scan using the absolute scan angle
  const enemies = api.scan(memory.scanAngle, 45);
  
  // Check if scan found enemies
  if (enemies && enemies.length > 0) {
    // Found enemy - get the closest one
    const enemy = enemies.reduce((closest, current) => {
      return (!closest || current.distance < closest.distance) ? current : closest;
    }, null);
    
    // Calculate angle to enemy
    const angleToTarget = api.getAngleTo(enemy.x, enemy.y);
    
    // Point turret at enemy (need to calculate relative angle)
    const relativeAngle = api.normalizeAngle(angleToTarget - botInfo.angle);
    api.turnTurret(relativeAngle);
    
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
    
    // Gradually rotate turret for visual feedback
    const turretScanAngle = (botInfo.relativeTurretAngle + 10) % 360;
    api.turnTurret(turretScanAngle);
    
    // Occasional movement
    if (Math.random() < 0.05) {
      api.thrust(0.5);
    }
  }
}