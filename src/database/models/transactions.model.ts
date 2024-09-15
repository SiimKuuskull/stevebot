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
    BALANCE_CREATED = 'BALANCE_CREATED',
    BANKRUPTCY = 'BANKRUPTCY',
    BET_PLACED = 'BET_PLACED',
    BET_WIN = 'BET_WIN',
    DAILY_COIN = 'DAILY_COIN',
    LOAN_PAYBACK = 'LOAN_PAYBACK',
    LOAN_RECEIVED = 'LOAN_RECEIVED',
}
