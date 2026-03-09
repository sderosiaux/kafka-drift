export class InputManager {
  private keys = new Set<string>();
  private justPressed = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  isDown(code: string) { return this.keys.has(code); }
  wasPressed(code: string) { return this.justPressed.has(code); }
  endFrame() { this.justPressed.clear(); }
}

export const input = new InputManager();
