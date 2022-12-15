export type Transaction = {
    amount: number;
    balance: number;
    createdAt: Date;
    externalTransactionId: number;
    id: number;
    type: TransactionType;
    updatedAt: Date;
    userId: string;
};

export enum TransactionType {
    BET_PLACED = 'BET_PLACED',
    BET_WIN = 'BET_WIN',
    DAILY_COIN = 'DAILY_COIN',
}
