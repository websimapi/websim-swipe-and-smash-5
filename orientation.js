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
        const { beta, gamma } = event;

        let newOrientation = this.currentOrientation;

        // Thresholds to determine orientation
        if (gamma < -45) {
            newOrientation = ORIENTATIONS.LEFT; // Tilted right, gravity pulls left
        } else if (gamma > 45) {
            newOrientation = ORIENTATIONS.RIGHT; // Tilted left, gravity pulls right
        } else if (beta > 45) {
            newOrientation = ORIENTATIONS.DOWN; // Portrait
        } else if (beta < -45) {
            newOrientation = ORIENTATIONS.UP; // Upside down
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