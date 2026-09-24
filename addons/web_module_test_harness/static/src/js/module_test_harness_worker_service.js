/** @odoo-module */

import {registry} from "@web/core/registry";

const BUS_WORKER_STATE = Object.freeze({
    CONNECTED: "CONNECTED",
    DISCONNECTED: "DISCONNECTED",
    IDLE: "IDLE",
});

class HarnessWorkerService {
    constructor() {
        this.connectionInitializedDeferred = Promise.resolve();
        /** @type {Set<(event: { data: { type: string, data?: unknown } }) => void>} */
        this.handlers = new Set();
    }

    async ensureWorkerStarted() {
        return undefined;
    }

    async registerHandler(handler) {
        this.handlers.add(handler);
    }

    async send(action, _data) {
        switch (action) {
            case "BUS:INITIALIZE_CONNECTION":
                this._emit("BUS:WORKER_STATE_UPDATED", BUS_WORKER_STATE.IDLE);
                this._emit("BUS:INITIALIZED");
                return;
            case "BUS:START":
                this._emit("BUS:WORKER_STATE_UPDATED", BUS_WORKER_STATE.CONNECTED);
                this._emit("BUS:CONNECT");
                return;
            case "BUS:STOP":
            case "BUS:LEAVE":
                this._emit("BUS:WORKER_STATE_UPDATED", BUS_WORKER_STATE.DISCONNECTED);
                this._emit("BUS:DISCONNECT");
                return;
            case "ELECTION:REGISTER":
                this._emit("ELECTION:ASSIGN_MASTER");
                return;
            case "ELECTION:UNREGISTER":
                this._emit("ELECTION:UNASSIGN_MASTER");
                return;
            case "ELECTION:IS_MASTER?":
                this._emit("ELECTION:IS_MASTER_RESPONSE", {answer: true});
                return;
            case "ELECTION:HEARTBEAT":
            case "BUS:ADD_CHANNEL":
            case "BUS:DELETE_CHANNEL":
            case "BUS:FORCE_UPDATE_CHANNELS":
            case "BUS:SEND":
            case "BUS:SET_LOGGING_ENABLED":
            case "BUS:REQUEST_LOGS":
                return;
        }
    }

    _emit(type, data) {
        for (const handler of this.handlers) {
            handler({data: {type, data}});
        }
    }
}

const harnessWorkerService = {
    start() {
        return new HarnessWorkerService();
    },
};

registry
    .category("services")
    .add("worker_service", harnessWorkerService, {force: true});
