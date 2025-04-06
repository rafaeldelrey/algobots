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
        
        // Bot templates will be loaded from files
        this.botTemplates = {
            human: '',
            aggressive: '',
            defensive: '',
            sniper: ''
        };
    }
    
    async loadBotTemplates() {
        try {
            // Load all bot templates asynchronously
            const responses = await Promise.all([
                fetch('bots/template_human.js'),
                fetch('bots/template_aggressive.js'),
                fetch('bots/template_defensive.js'),
                fetch('bots/template_sniper.js')
            ]);
            
            // Check if all responses are OK
            if (responses.some(response => !response.ok)) {
                throw new Error('Failed to load one or more bot templates');
            }
            
            // Get text from responses
            const [human, aggressive, defensive, sniper] = await Promise.all(
                responses.map(response => response.text())
            );
            
            // Store templates
            this.botTemplates.human = human;
            this.botTemplates.aggressive = aggressive;
            this.botTemplates.defensive = defensive;
            this.botTemplates.sniper = sniper;
            
            console.log('Bot templates loaded successfully');
            return true;
        } catch (error) {
            console.error('Error loading bot templates:', error);
            alert('Failed to load bot templates. Please check the console for details.');
            return false;
        }
    }
    
    async init() {
        // Load bot templates first
        const templatesLoaded = await this.loadBotTemplates();
        if (!templatesLoaded) {
            console.error('Could not initialize UI due to template loading failure');
            return;
        }
        
        // Set up event listeners for buttons
        document.getElementById('add-bot').addEventListener('click', () => this.addBot());
        document.getElementById('start-game').addEventListener('click', () => this.startGame());
        document.getElementById('pause-resume').addEventListener('click', () => this.togglePause());
        document.getElementById('reset').addEventListener('click', () => this.resetGame());
        document.getElementById('back-to-setup').addEventListener('click', () => this.backToSetup());
        document.getElementById('close-modal').addEventListener('click', () => this.hideGameOver());
        document.getElementById('help-button').addEventListener('click', () => this.showHelpModal());
        document.getElementById('close-help-modal').addEventListener('click', () => this.hideHelpModal());
        document.getElementById('control-bot-select').addEventListener('change', (e) => this.setControlledBot(e.target.value));
        
        // Set up speed slider event listener
        document.getElementById('speed-slider').addEventListener('input', (e) => this.setGameSpeed(e.target.value));
        
        // Set up canvas
        this.canvas = document.getElementById('game-canvas');
        this.game.setCanvas(this.canvas);
        
        // Initialize with our four bots
        this.addBot('Human', '#8BC34A', this.botTemplates.human);
        this.addBot('Aggressive', '#FF5722', this.botTemplates.aggressive);
        this.addBot('Defensive', '#2196F3', this.botTemplates.defensive);
        this.addBot('Sniper', '#9C27B0', this.botTemplates.sniper);
        
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
        // Cancel any animation frame to be safe
        if (this.game.animationFrameId) {
            cancelAnimationFrame(this.game.animationFrameId);
        }
        
        // Reset pause state
        this.isPaused = false;
        document.getElementById('pause-resume').textContent = 'Pause';
        
        // Reset game state
        this.game.reset();
        
        // Reset speed to default
        this.resetGameSpeed();
        
        // Start a new game
        this.startGame();
        
        // Hide game over modal if it's showing
        document.getElementById('game-over-modal').style.display = 'none';
    }
    
    backToSetup() {
        // Cancel any animation frame to be safe
        if (this.game.animationFrameId) {
            cancelAnimationFrame(this.game.animationFrameId);
        }
        
        this.game.reset();
        this.setupScreen.style.display = 'block';
        this.gameScreen.style.display = 'none';
        
        // Reset UI state
        this.isPaused = false;
        document.getElementById('pause-resume').textContent = 'Pause';
        
        // Reset speed to default
        this.resetGameSpeed();
        
        // Hide game over modal if it's showing
        document.getElementById('game-over-modal').style.display = 'none';
    }
    
    resetGameSpeed() {
        // Reset slider to default position
        const speedSlider = document.getElementById('speed-slider');
        speedSlider.value = 1;
        
        // Reset the game speed
        this.setGameSpeed(1);
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
    
    async showHelpModal() {
        try {
            // Fetch the help markdown content
            const response = await fetch('docs/help.md');
            if (!response.ok) {
                throw new Error('Failed to load help content');
            }
            
            const markdown = await response.text();
            
            // Convert markdown to HTML using the marked library
            const helpContent = document.getElementById('help-content');
            helpContent.innerHTML = marked.parse(markdown);
            
            // Show the modal
            document.getElementById('help-modal').style.display = 'flex';
        } catch (error) {
            console.error('Error loading help content:', error);
            alert('Failed to load help content. Please try again.');
        }
    }
    
    hideHelpModal() {
        document.getElementById('help-modal').style.display = 'none';
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
        
        // Handle turning - using degrees now instead of radians
        const rotationStep = 5; // 5 degrees per keypress
        console.log(`Rotation Step: ${rotationStep} degrees`);
        
        if (keys.a) {
            bot.target_angle -= rotationStep;
        }
        
        if (keys.d) {
            bot.target_angle += rotationStep;
        }
        
        // Handle turret rotation - using degrees now instead of radians
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
        
        const gameContainer = document.querySelector('.game-container');
        const gameUI = document.getElementById('game-ui');
        
        if (!gameContainer || !gameUI) return;
        
        // Calculate available height (container height)
        const availableHeight = gameContainer.clientHeight;
        
        // Calculate available width (container width minus UI width and gap)
        const uiWidth = gameUI.offsetWidth;
        const gap = 20; // Gap from CSS
        const availableWidth = gameContainer.clientWidth - uiWidth - gap;
        
        // Use the smaller dimension to ensure square aspect ratio
        const size = Math.min(availableHeight, availableWidth);
        
        // Set canvas dimensions
        this.canvas.width = size;
        this.canvas.height = size;
        
        // Update game configuration
        this.game.config.CANVAS_WIDTH = size;
        this.game.config.CANVAS_HEIGHT = size;
    }
    
    setGameSpeed(value) {
        // Update the speedMultiplier in the game
        this.game.setSpeedMultiplier(value);
        
        // Update the display value
        document.getElementById('speed-value').textContent = `${value}x`;
    }
}
