import { map } from 'bluebird';
import { LoanPayBack } from '../../../../database/models/loan.model';
import { updateLateLoanBalance } from '../../../../database/queries/balance.query';
import { findUnresolvedLoans } from '../../../../database/queries/loans.query';
import { log } from '../../../../tools/logger';
import { sendPrivateMessageToGambler } from '../../utils';

export const loanShark = {
    interval: 86400,
    execute: async () => {
        const activeLoans = await findUnresolvedLoans();
        if (activeLoans) {
            await map(activeLoans, async (loan) => {
                const deadline = loan?.deadline.getTime();
                if (loan?.payback === LoanPayBack.UNRESOLVED) {
                    if (deadline > Date.now()) {
                        sendPrivateMessageToGambler(
                            `Meeldetuletus: võlgned Suurele Muumile ${
                                loan.amount + loan.amount * loan.interest
                            }, tagasimakse tähtaeg on: ${loan.deadline} `,
                            loan.userName,
                        );
                    }
                }
                if (deadline <= Date.now()) {
                    await updateLateLoanBalance(loan.userId);
                    sendPrivateMessageToGambler(
                        `Meeldetuletus: võlgned Suurele Muumile ${
                            loan.amount + loan.amount * loan.interest
                        }, tagasimakse tähtaeg oli: ${loan.deadline}. Teie järgmisel neljal võidul on väiksem kasum.`,
                        loan.userName,
                    );
                }
            });
        }
    },
};
