// ui.js - Handles UI elements and user interactions
export class UI {
    constructor(game) {
        this.game = game;
        this.setupScreen = document.getElementById('setup-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.botsList = document.getElementById('bots-list');
        this.statusPanel = document.getElementById('bots-status');
        this.canvas = null;
        this.codeEditors = new Map(); // Map of bot ID -> CodeMirror editor
        this.isPaused = false;
        
        // Sample bot templates
        this.botTemplates = {
            idle: `// This bot will just sit still and scan
function runBotAI(botInfo, api, memory) {
    // Initialize scan counter in memory
    if (!memory.scanDirection) {
        memory.scanDirection = 0;
    }
    
    // Rotate turret continuously
    api.turnTurret(memory.scanDirection);
    memory.scanDirection = (memory.scanDirection + 5) % 360;
    
    // Perform scan and fire if target detected
    const scanId = api.scan(0, 45);
    if (scanId) {
        const results = api.getScanResults(scanId);
        if (results && results.length > 0) {
            api.fire();
        }
    }
}`,
            aggressive: `// This bot will chase the nearest enemy and fire
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
            
            const scanId = api.scan(0, 60);
            if (scanId) {
                const results = api.getScanResults(scanId);
                if (results && results.length > 0) {
                    // Target the closest enemy
                    memory.target = results.reduce((closest, current) => {
                        return (!closest || current.distance < closest.distance) ? current : closest;
                    }, null);
                    
                    memory.state = "chase";
                }
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
            const turretAngleDiff = Math.abs(api.normalizeAngle(botInfo.turret_angle * 180 / Math.PI - angleToTarget));
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
}`,
            defensive: `// This bot will patrol the edges and fire when it sees enemies
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
    
    // Perform scan
    const scanId = api.scan(0, 60);
    if (scanId) {
        const results = api.getScanResults(scanId);
        if (results && results.length > 0) {
            // Target found, aim and fire
            const target = results[0];
            const angleToTarget = api.getAngleTo(target.x, target.y);
            api.turnTurret(angleToTarget);
            
            // Only fire if turret is pointing at target
            const turretAngleDiff = Math.abs(api.normalizeAngle(botInfo.turret_angle * 180 / Math.PI - angleToTarget));
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
}`
        };
    }
    
    init() {
        // Set up event listeners for buttons
        document.getElementById('add-bot').addEventListener('click', () => this.addBot());
        document.getElementById('start-game').addEventListener('click', () => this.startGame());
        document.getElementById('pause-resume').addEventListener('click', () => this.togglePause());
        document.getElementById('reset').addEventListener('click', () => this.resetGame());
        document.getElementById('back-to-setup').addEventListener('click', () => this.backToSetup());
        document.getElementById('close-modal').addEventListener('click', () => this.hideGameOver());
        document.getElementById('control-bot-select').addEventListener('change', (e) => this.setControlledBot(e.target.value));
        
        // Set up canvas
        this.canvas = document.getElementById('game-canvas');
        this.game.setCanvas(this.canvas);
        
        // Initialize with our three bots
        this.addBot('Human', '#8BC34A', this.botTemplates.idle);
        this.addBot('Aggressive', '#FF5722', this.botTemplates.aggressive);
        this.addBot('Defensive', '#2196F3', this.botTemplates.defensive);
        
        // Set up keyboard controls
        this.setupKeyboardControls();
        
        // Handle window resize
        window.addEventListener('resize', () => this.resizeCanvas());
        this.resizeCanvas();
    }
    
    addBot(name = 'New Bot', color = '#ff0000', aiScript = '') {
        // Clone the template
        const template = document.getElementById('bot-template');
        const clone = document.importNode(template.content, true);
        
        // Generate bot ID
        const botId = 'bot-' + Date.now();
        clone.querySelector('.bot-config').id = botId;
        
        // Set initial values
        clone.querySelector('.bot-name').value = name;
        clone.querySelector('.bot-color').value = color;
        
        // Add to DOM
        this.botsList.appendChild(clone);
        
        // Set up CodeMirror for syntax highlighting
        const textarea = document.querySelector(`#${botId} .bot-code`);
        const editor = CodeMirror.fromTextArea(textarea, {
            mode: 'javascript',
            theme: 'default',
            lineNumbers: true,
            indentUnit: 4,
            tabSize: 4,
            lineWrapping: true,
            autoCloseBrackets: true
        });
        
        // Set initial code
        editor.setValue(aiScript || '// Define your bot AI here\nfunction runBotAI(botInfo, api, memory) {\n    // Your code here\n}');
        
        // Store editor reference
        this.codeEditors.set(botId, editor);
        
        // Set up remove button
        const removeBtn = document.querySelector(`#${botId} .remove-bot`);
        removeBtn.addEventListener('click', () => {
            document.getElementById(botId).remove();
            this.codeEditors.delete(botId);
        });
    }
    
    startGame() {
        // Get bot configurations
        const botConfigs = [];
        
        document.querySelectorAll('.bot-config').forEach((botElem) => {
            const botId = botElem.id;
            const name = botElem.querySelector('.bot-name').value || 'Unnamed Bot';
            const color = botElem.querySelector('.bot-color').value;
            const editor = this.codeEditors.get(botId);
            const aiScript = editor ? editor.getValue() : '';
            
            botConfigs.push({ name, color, aiScript });
        });
        
        // Start the game
        this.game.start(botConfigs);
        
        // Update UI to show game screen
        this.setupScreen.style.display = 'none';
        this.gameScreen.style.display = 'block';
        
        // Populate control bot select
        const controlSelect = document.getElementById('control-bot-select');
        controlSelect.innerHTML = '<option value="">None</option>';
        
        this.game.bots.forEach(bot => {
            const option = document.createElement('option');
            option.value = bot.id;
            option.textContent = bot.name;
            controlSelect.appendChild(option);
        });
        
        // Automatically select the Human bot for control
        const humanBot = this.game.bots.find(bot => bot.name === 'Human');
        if (humanBot) {
            // Turret mode is always relative now, no need to set it.
            
            // Select it for control
            controlSelect.value = humanBot.id;
            this.setControlledBot(humanBot.id);
        }
        
        // Update bot status
        this.updateBotsStatus(this.game.bots);
        
        // Resize canvas
        this.resizeCanvas();
    }
    
    togglePause() {
        const btn = document.getElementById('pause-resume');
        
        if (this.isPaused) {
            this.game.resume();
            btn.textContent = 'Pause';
        } else {
            this.game.pause();
            btn.textContent = 'Resume';
        }
        
        this.isPaused = !this.isPaused;
    }
    
    resetGame() {
        this.game.reset();
        this.startGame();
    }
    
    backToSetup() {
        this.game.reset();
        this.setupScreen.style.display = 'block';
        this.gameScreen.style.display = 'none';
        this.isPaused = false;
        document.getElementById('pause-resume').textContent = 'Pause';
    }
    
    updateBotsStatus(bots) {
        // Clear current status
        this.statusPanel.innerHTML = '';
        
        // Add each bot's status
        for (const bot of bots) {
            const botDiv = document.createElement('div');
            botDiv.className = 'bot-status';
            botDiv.style.borderLeft = `4px solid ${bot.color}`;
            
            // Header with name and status
            const header = document.createElement('div');
            header.className = 'status-header';
            
            const name = document.createElement('span');
            name.textContent = bot.name;
            
            const status = document.createElement('span');
            status.textContent = bot.isActive ? 'Active' : 'Destroyed';
            status.style.color = bot.isActive ? '#4CAF50' : '#F44336';
            
            header.appendChild(name);
            header.appendChild(status);
            botDiv.appendChild(header);
            
            // Status bars
            if (bot.isActive) {
                const bars = document.createElement('div');
                bars.className = 'status-bars';
                
                // Armor bar
                const armorBar = document.createElement('div');
                armorBar.className = 'status-bar';
                
                const armorFill = document.createElement('div');
                armorFill.className = 'bar-fill armor-bar';
                armorFill.style.width = `${(bot.armor / bot.max_armor) * 100}%`;
                
                armorBar.appendChild(armorFill);
                bars.appendChild(armorBar);
                
                // Heat bar
                const heatBar = document.createElement('div');
                heatBar.className = 'status-bar';
                
                const heatFill = document.createElement('div');
                heatFill.className = 'bar-fill heat-bar';
                heatFill.style.width = `${(bot.heat / bot.max_heat) * 100}%`;
                
                heatBar.appendChild(heatFill);
                bars.appendChild(heatBar);
                
                botDiv.appendChild(bars);
                
                // Status indicators
                const indicators = document.createElement('div');
                indicators.className = 'status-indicators';
                
                if (bot.isShutdown) {
                    const shutdown = document.createElement('span');
                    shutdown.className = 'indicator shutdown';
                    shutdown.textContent = 'SHUTDOWN';
                    indicators.appendChild(shutdown);
                }
                
                if (bot.isOverburn) {
                    const overburn = document.createElement('span');
                    overburn.className = 'indicator overburn';
                    overburn.textContent = 'OVERBURN';
                    indicators.appendChild(overburn);
                }
                
                if (bot.aiError) {
                    const error = document.createElement('span');
                    error.className = 'indicator error';
                    error.textContent = 'AI ERROR';
                    error.title = bot.aiError;
                    indicators.appendChild(error);
                }
                
                botDiv.appendChild(indicators);
            }
            
            this.statusPanel.appendChild(botDiv);
        }
    }
    
    showGameOver(winner) {
        const modal = document.getElementById('game-over-modal');
        const result = document.getElementById('game-result');
        
        if (winner) {
            result.textContent = `${winner.name} is the winner!`;
            result.style.color = winner.color;
        } else {
            result.textContent = 'Game over! It\'s a draw.';
            result.style.color = '#333';
        }
        
        modal.style.display = 'flex';
    }
    
    hideGameOver() {
        document.getElementById('game-over-modal').style.display = 'none';
    }
    
    setControlledBot(botId) {
        this.game.controlledBotId = botId || null;
    }
    
    setupKeyboardControls() {
        // Track pressed keys
        const keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            q: false,
            e: false,
            space: false,
            shift: false
        };
        
        // Key down event
        window.addEventListener('keydown', (e) => {
            if (!this.game.controlledBotId) return;
            
            switch (e.key.toLowerCase()) {
                case 'w': keys.w = true; break;
                case 'a': keys.a = true; break;
                case 's': keys.s = true; break;
                case 'd': keys.d = true; break;
                case 'q': keys.q = true; break;
                case 'e': keys.e = true; break;
                case ' ': keys.space = true; break;
                case 'shift': keys.shift = true; break;
            }
            
            this.processKeyboardControls(keys);
        });
        
        // Key up event
        window.addEventListener('keyup', (e) => {
            if (!this.game.controlledBotId) return;
            
            switch (e.key.toLowerCase()) {
                case 'w': keys.w = false; break;
                case 'a': keys.a = false; break;
                case 's': keys.s = false; break;
                case 'd': keys.d = false; break;
                case 'q': keys.q = false; break;
                case 'e': keys.e = false; break;
                case ' ': keys.space = false; break;
                case 'shift': keys.shift = false; break;
            }
            
            this.processKeyboardControls(keys);
        });
    }
    
    processKeyboardControls(keys) {
        if (!this.game.controlledBotId) return;
        
        // Find the controlled bot
        const bot = this.game.bots.find(b => b.id === this.game.controlledBotId);
        if (!bot || !bot.isActive) return;
        
        // Movement controls
        if (keys.w) {
            bot.target_speed = bot.getMaxSpeed();
        } else if (keys.s) {
            bot.target_speed = 0; // Brake
        }
        
        // Apply overburn
        bot.isOverburn = keys.shift;
        
        // Handle turning
        const rotationStep = Math.PI / 36; // 5 degrees in radians
        
        if (keys.a) {
            bot.target_angle -= rotationStep;
        }
        
        if (keys.d) {
            bot.target_angle += rotationStep;
        }
        
        // Handle turret rotation
        if (keys.q) {
            bot.target_turret_angle -= rotationStep;
        }
        
        if (keys.e) {
            bot.target_turret_angle += rotationStep;
        }
        
        // Handle firing
        if (keys.space && bot.fire_cooldown_remaining <= 0 && !bot.isShutdown) {
            this.game.fireProjectile(bot);
        }
    }
    
    resizeCanvas() {
        if (!this.canvas) return;
        
        const container = this.canvas.parentElement;
        const containerWidth = container.clientWidth;
        
        // Set canvas size to match container width while maintaining aspect ratio
        this.canvas.width = containerWidth;
        this.canvas.height = containerWidth * (this.game.config.ARENA_HEIGHT / this.game.config.ARENA_WIDTH);
        
        // Update game configuration if needed
        this.game.config.CANVAS_WIDTH = this.canvas.width;
        this.game.config.CANVAS_HEIGHT = this.canvas.height;
    }
}
