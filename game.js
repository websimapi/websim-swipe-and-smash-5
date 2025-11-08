import Board from './board.js';
import InputHandler from './input.js';
import { playSound } from './audio.js';
import confetti from 'confetti';
import { OrientationHandler, ORIENTATIONS } from './orientation.js';

const config = {
    boardSize: 10,
    candyTypes: [
        'candy_red.png',
        'candy_blue.png',
        'candy_green.png',
        'candy_yellow.png',
        'candy_purple.png',
        'candy_orange.png'
    ],
    pointsPerCandy: 10,
    timerDuration: 15,
    initialSmashValue: 0,
};

let gameInstance = null; // To hold the game instance

function startGame() {
    document.getElementById('calibration-overlay').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    gameInstance = new Game();
}

class Game {
    constructor() {
        this.board = new Board(config.boardSize, config.candyTypes, this.onMatch.bind(this));
        this.score = 0;
        this.scoreElement = document.getElementById('score');
        this.isProcessing = false;

        this.smashValue = config.initialSmashValue;
        this.smashProgress = 0; // 0, 0.5
        this.smashValueElement = document.getElementById('smash-value');
        this.smashFluidElement = document.getElementById('smash-fluid');
        this.timerValue = config.timerDuration;
        this.timerElement = document.getElementById('timer');
        this.timerInterval = null;
        this.isTimerPaused = false;
        
        this.orientationHandler = new OrientationHandler(this.onOrientationChange.bind(this));
        this.inputHandler = new InputHandler(this.board.boardElement, this.onSwap.bind(this), this.onSmash.bind(this));

        // Orientation challenge elements
        this.orientationChallengeContainer = document.getElementById('orientation-challenge-container');
        this.orientationIndicator = document.getElementById('orientation-indicator');
        this.currentTargetOrientation = ORIENTATIONS.DOWN; // Start with regular phone orientation
        this.isOrientationCorrect = false;
        
        this.updateScore(0);
        this.updateSmashUI();
        this.startTimer();
        this.board.initialize();
        this.setupInitialOrientation();

        // The handler is already listening post-calibration, just check the orientation.
        this.onOrientationChange(this.orientationHandler.getCurrentOrientation());
    }

    setupInitialOrientation() {
        this.orientationIndicator.className = '';
        this.orientationIndicator.classList.add(this.currentTargetOrientation);
        this.orientationChallengeContainer.classList.remove('hidden');

        // Immediately check if the current orientation is correct
        this.onOrientationChange(this.orientationHandler.getCurrentOrientation());
    }

    scheduleFirstOrientationChallenge() {
        setTimeout(() => {
            this.startOrientationChallenge();
        }, config.orientationChallengeDelay);
    }

    startOrientationChallenge() {
        if (!this.orientationHandler.isListening) return; // Don't start if not ready

        const possibleOrientations = Object.values(ORIENTATIONS).filter(o => o !== this.board.gravityDirection);
        this.currentTargetOrientation = possibleOrientations[Math.floor(Math.random() * possibleOrientations.length)];
        
        this.orientationIndicator.className = '';
        this.orientationIndicator.classList.add(this.currentTargetOrientation);
        this.orientationChallengeContainer.classList.remove('hidden');

        // Immediately check if the current orientation is correct
        this.onOrientationChange(this.orientationHandler.getCurrentOrientation());
    }
    
    onOrientationChange(currentOrientation) {
        if (!this.currentTargetOrientation) return;

        if (currentOrientation === this.currentTargetOrientation) {
            if (!this.isOrientationCorrect) { // It just became correct
                this.isOrientationCorrect = true;
                this.orientationChallengeContainer.classList.add('matched');

                // Change gravity
                this.isProcessing = true;
                this.pauseTimer();
                this.board.setGravity(currentOrientation).then(() => {
                    this.isProcessing = false;
                    this.resumeTimer();
                });
            }
        } else {
            if (this.isOrientationCorrect) { // It just became incorrect
                 this.isOrientationCorrect = false;
                 this.orientationChallengeContainer.classList.remove('matched');
            }
        }
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            if (this.isTimerPaused) return;

            this.timerValue--;
            this.timerElement.textContent = this.timerValue;
            if (this.timerValue <= 0) {
                if (this.smashValue > 0) {
                    this.smashValue--;
                    this.updateSmashUI();
                }
                this.smashProgress = 0; // Reset progress if timer runs out
                this.updateSmashUI();

                this.resetTimer();

                // Start a new challenge when the timer resets
                this.startOrientationChallenge();
            }
        }, 1000);
    }

    resetTimer() {
        this.timerValue = config.timerDuration;
        this.timerElement.textContent = this.timerValue;
    }

    pauseTimer() {
        this.isTimerPaused = true;
    }

    resumeTimer() {
        this.isTimerPaused = false;
    }

    updateSmashUI() {
        this.smashValueElement.textContent = this.smashValue;
        const fillPercentage = this.smashProgress * 100; // 0 or 50
        this.smashFluidElement.style.height = `${fillPercentage}%`;
    }

    updateScore(points) {
        this.score += points;
        this.scoreElement.textContent = this.score;
    }

    onMatch(matchedCandies, isPlayerMove) {
        playSound('match.mp3');
        this.updateScore(matchedCandies.length * config.pointsPerCandy);
        
        if (isPlayerMove) {
            this.smashProgress += 0.5;
            this.updateSmashUI();

            if (this.smashProgress >= 1) {
                // Animate fill, update value, then animate empty
                this.smashFluidElement.style.transition = 'height 0.3s ease-in';
                this.smashFluidElement.style.height = '100%';

                setTimeout(() => {
                    if (this.smashValue < 12) {
                        this.smashValue++;
                    }
                    this.smashValueElement.textContent = this.smashValue;
                    this.smashProgress = 0;
                    
                    setTimeout(() => {
                        this.smashFluidElement.style.transition = 'height 0.5s ease-out';
                        this.updateSmashUI();
                    }, 200); // Wait a moment before draining
                }, 300); // Duration of the fill animation
            }
            
            this.resetTimer();
        }

        if (matchedCandies.length >= 5) {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    }

    async onSmash(candy) {
        if (this.isProcessing || this.smashValue <= 0 || !this.isOrientationCorrect) return;
        this.isProcessing = true;
        this.pauseTimer();

        const r = parseInt(candy.dataset.row);
        const c = parseInt(candy.dataset.col);
        const candiesToSmash = new Set();
        let smashCost = 0;

        if (this.smashValue >= 7 && this.smashValue <= 12) {
            // 3x3 area centered on the candy
            for (let i = r - 1; i <= r + 1; i++) {
                for (let j = c - 1; j <= c + 1; j++) {
                    if (this.board.isValid(i, j) && this.board.grid[i][j]) {
                        candiesToSmash.add(this.board.grid[i][j]);
                    }
                }
            }
            smashCost = 3;
        } else if (this.smashValue >= 4 && this.smashValue <= 6) {
            // 2x2 area starting from the candy (top-left)
            for (let i = r; i <= r + 1; i++) {
                for (let j = c; j <= c + 1; j++) {
                    if (this.board.isValid(i, j) && this.board.grid[i][j]) {
                        candiesToSmash.add(this.board.grid[i][j]);
                    }
                }
            }
            smashCost = 2;
        } else if (this.smashValue >= 1 && this.smashValue <= 3) {
            candiesToSmash.add(candy);
            smashCost = 1;
        }

        if (this.smashValue < smashCost || smashCost === 0) {
            this.isProcessing = false;
            this.resumeTimer();
            return;
        }
        
        this.smashValue -= smashCost;
        this.updateSmashUI();
        playSound('smash.mp3');
        
        // Pass a flag to indicate this is a smash action
        await this.board.smashCandies(Array.from(candiesToSmash));

        this.isProcessing = false;
        this.resumeTimer();
    }

    async onSwap(candy1, candy2) {
        if (this.isProcessing || !this.isOrientationCorrect) return;
        this.isProcessing = true;
        this.pauseTimer();
        
        const candy1Powerup = candy1.dataset.powerup;
        const candy2Powerup = candy2.dataset.powerup;

        if (candy1Powerup === 'rainbow' || candy2Powerup === 'rainbow') {
            const rainbowCandy = candy1Powerup === 'rainbow' ? candy1 : candy2;
            const otherCandy = candy1Powerup === 'rainbow' ? candy2 : candy1;
            
            // We don't need to swap visually, just activate
            await this.board.activateRainbowPowerup(rainbowCandy, otherCandy);
            this.isProcessing = false;
            this.resumeTimer();
            return;
        }
        
        await this.board.swapCandies(candy1, candy2);
        const isValidSwap = await this.board.processMatches(false, [candy1, candy2]);

        if (!isValidSwap) {
            // If no matches, swap back
            await this.board.swapCandies(candy1, candy2);
        }
        
        this.isProcessing = false;
        this.resumeTimer();
    }
}

window.addEventListener('load', () => {
    // Don't create game immediately. Wait for calibration.
    const calibrateButton = document.getElementById('calibrate-button');
    const tempOrientationHandler = new OrientationHandler(() => {}); // Temp handler for permission

    calibrateButton.addEventListener('click', async () => {
        // Must request permission on user gesture
        const granted = await tempOrientationHandler.requestPermission();
        if (granted) {
            // Calibrate with the current orientation values
            await tempOrientationHandler.calibrate();
            startGame(); // This creates the real game instance
            gameInstance.orientationHandler = tempOrientationHandler; // Pass the calibrated handler
            gameInstance.orientationHandler.onOrientationChange = gameInstance.onOrientationChange.bind(gameInstance);
            gameInstance.inputHandler.setOrientationHandler(gameInstance.orientationHandler, () => gameInstance.isOrientationCorrect);
            gameInstance.orientationHandler.startListening();
            gameInstance.onOrientationChange(gameInstance.orientationHandler.getCurrentOrientation()); // Initial check
        } else {
            alert("Orientation permission is required to play this game.");
        }
    });
});