import { Application, Container } from "pixi.js";

export default class CenteredObjects {
    // container to center relative to
    public centeredContainers: Container[] = [];
    private app: Application;

    #center() {
        for (const container of this.centeredContainers) {
            container.pivot.x = container.width / 2;
            container.pivot.y = container.height / 2;
            container.x = this.app.screen.width / 2;
            container.y = this.app.screen.height / 2;
        }
    }

    constructor(app: Application, ...initial: Container[]) {
        this.app = app;
        this.centeredContainers = initial;

        for(const container of this.centeredContainers) {
            app.stage.addChild(container);
        }

        // Run initially too;
        this.#center();

        app.renderer.on('resize', this.#center);
    }

    destroy() {
        this.app.renderer.removeListener('resize', this.#center);
        for(const container of this.centeredContainers) {
            this.app.stage.removeChild(container);
        }
    }

    add(con: Container) {
        this.centeredContainers.push(con);
        this.app.stage.addChild(con);
        this.#center();
    }

}