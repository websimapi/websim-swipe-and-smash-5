const ORIENTATIONS = {
    DOWN: 'down', // Portrait
    RIGHT: 'right', // Landscape, tilted left
    LEFT: 'left', // Landscape, tilted right
    UP: 'up', // Portrait, upside down
};

class OrientationHandler {
    constructor(onOrientationChange) {
        this.onOrientationChange = onOrientationChange;
        this.currentOrientation = ORIENTATIONS.DOWN;
        this.permissionGranted = false;
        this.isListening = false;
        this.betaOffset = 0;
        this.gammaOffset = 0;
        this.lastBeta = null;
        this.lastGamma = null;

        // Ensure 'this' context is correct in event handler
        this.handleOrientation = this.handleOrientation.bind(this);
    }

    // Must be called from a user gesture
    async requestPermission() {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                    this.permissionGranted = true;
                }
            } catch (error) {
                console.error("DeviceOrientation permission request failed.", error);
                this.permissionGranted = false;
            }
        } else {
            // Non-iOS 13+ browsers
            this.permissionGranted = true;
        }
        return this.permissionGranted;
    }

    async calibrate() {
        return new Promise(resolve => {
            const tempListener = (event) => {
                this.betaOffset = event.beta || 0;
                this.gammaOffset = event.gamma || 0;
                console.log(`Calibrated with beta: ${this.betaOffset}, gamma: ${this.gammaOffset}`);
                window.removeEventListener('deviceorientation', tempListener);
                resolve();
            };
            window.addEventListener('deviceorientation', tempListener);
            // Timeout to prevent getting stuck if no event fires
            setTimeout(() => {
                window.removeEventListener('deviceorientation', tempListener);
                if (this.betaOffset === 0 && this.gammaOffset === 0) {
                     console.warn("Calibration timed out, using default offsets.");
                }
                resolve();
            }, 500);
        });
    }

    startListening() {
        if (!this.permissionGranted || this.isListening) return;
        window.addEventListener('deviceorientation', this.handleOrientation);
        this.isListening = true;
    }

    stopListening() {
        if (!this.isListening) return;
        window.removeEventListener('deviceorientation', this.handleOrientation);
        this.isListening = false;
    }

    handleOrientation(event) {
        // beta: front-back tilt (-180 to 180)
        // gamma: left-right tilt (-90 to 90)
        
        if (event.beta === null || event.gamma === null) return;

        // Apply calibration offset to get relative values
        const beta = event.beta - this.betaOffset;
        const gamma = event.gamma - this.gammaOffset;

        let newOrientation = this.currentOrientation;

        // Check for landscape first, as gamma is less ambiguous
        if (gamma < -45) { // Tilted right from calibrated position
            newOrientation = ORIENTATIONS.LEFT; 
        } else if (gamma > 45) { // Tilted left from calibrated position
            newOrientation = ORIENTATIONS.RIGHT;
        } else {
            // If not landscape, check for portrait vs upside-down
            // An upside-down rotation is a ~180 degree change in beta
            if (Math.abs(beta) > 135) {
                 newOrientation = ORIENTATIONS.UP; // Upside down
            } else {
                 newOrientation = ORIENTATIONS.DOWN; // Portrait (close to calibrated position)
            }
        }

        if (newOrientation !== this.currentOrientation) {
            this.currentOrientation = newOrientation;
            this.onOrientationChange(this.currentOrientation);
        }
    }

    getCurrentOrientation() {
        return this.currentOrientation;
    }
}

export { OrientationHandler, ORIENTATIONS };