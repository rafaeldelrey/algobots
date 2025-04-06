// main.js - Entry point for Algo Bots 2D
import { Game } from './game.js';
import { UI } from './ui.js';

// Create instances when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize game and UI components
    const game = new Game();
    const ui = new UI(game);
    
    // Connect game and UI
    game.setUICallbacks({
        updateBotsStatus: ui.updateBotsStatus.bind(ui),
        showGameOver: ui.showGameOver.bind(ui)
    });
    
    // Handle window resize to adjust canvas dimensions
    window.addEventListener('resize', () => {
        ui.resizeCanvas();
    });
    
    // Initialize the UI
    ui.init();
});