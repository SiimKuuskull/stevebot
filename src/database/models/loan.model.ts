export type Loan = {
    id: number;
    userId: string;
    userName: string;
    amount: number;
    interest: number;
    createdAt: Date;
    updatedAt: Date;
    deadline: Date;
    payback: LoanPayBack;
};

export enum LoanPayBack {
    RESOLVED = 'RESOLVED',
    UNRESOLVED = 'UNRESOLVED',
    WIPED = 'WIPED',
}
