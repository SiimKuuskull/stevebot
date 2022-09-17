export class RiotRequestError extends Error {
    constructor(message: string, public statusCode: number) {
        super(message);
        this.statusCode = statusCode;
    }
}

export class InteractionError extends Error {
    constructor(message: string) {
        super(message);
    }
}
